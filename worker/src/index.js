const MODEL = "@cf/zai-org/glm-4.7-flash";

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "")
    .split(",").map(origin => origin.trim()).filter(origin => origin && origin !== "*");
}

function corsHeaders(env, requestOrigin) {
  const allow = allowedOrigins(env).includes(requestOrigin) ? requestOrigin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, env, requestOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env, requestOrigin) }
  });
}

function safeText(value, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseModelJson(output) {
  let text = typeof output === "string" ? output : output?.response;
  if (!text && output?.choices?.[0]?.message?.content) text = output.choices[0].message.content;
  if (typeof text !== "string") throw new Error("The model returned no text.");
  text = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model response was not JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

async function runModel(env, system, user, maxTokens = 600) {
  const output = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_completion_tokens: maxTokens,
    temperature: 0
  });
  return parseModelJson(output);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!origin || !allowedOrigins(env).includes(origin)) {
      return json({ error: "Set ALLOWED_ORIGINS to this site's exact origin before using the AI Worker." }, 403, env, origin);
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, origin) });

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, aiBound: Boolean(env.AI), model: MODEL, service: "Stockroom hosted AI" }, 200, env, origin);
    }
    if (request.method !== "POST" || !["/v1/search", "/v1/autofill"].includes(url.pathname)) {
      return json({ error: "Not found." }, 404, env, origin);
    }
    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 24000) return json({ error: "Request is too large." }, 413, env, origin);
      body = JSON.parse(raw);
    }
    catch { return json({ error: "Expected a JSON request." }, 400, env, origin); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Expected a JSON object." }, 400, env, origin);
    }

    try {
      if (url.pathname === "/v1/search") {
        const query = safeText(body.query, 240);
        const items = Array.isArray(body.items) ? body.items.slice(0, 80).map(item => ({
          id: safeText(item?.id, 80),
          name: safeText(item?.name, 100),
          category: safeText(item?.category, 60),
          unit: safeText(item?.unit, 24)
        })).filter(item => item.id && item.name) : [];
        if (!query || !items.length) return json({ error: "Add a search phrase and at least one item." }, 400, env, origin);

        const result = await runModel(env,
          "You are a product search ranker. Rank only the supplied inventory items by relevance to the user's phrase. Never invent or alter IDs. Return only JSON in this shape: {\"matches\":[{\"id\":\"provided id\",\"score\":0.0}]}. Include at most 8 unique IDs. Do not include explanations.",
          JSON.stringify({ query, items }), 140);
        const validIds = new Set(items.map(item => item.id));
        const seen = new Set();
        const matches = (Array.isArray(result.matches) ? result.matches : [])
          .filter(match => validIds.has(String(match.id)) && !seen.has(String(match.id)) && seen.add(String(match.id)))
          .slice(0, 8)
          .map(match => ({ id: String(match.id), score: Number.isFinite(Number(match.score)) ? Number(match.score) : null }));
        return json({ matches, model: MODEL }, 200, env, origin);
      }

      const description = safeText(body.description, 320);
      const categories = Array.isArray(body.categories) ? body.categories.map(c => safeText(c, 50)).filter(Boolean).slice(0, 30) : [];
      if (!description) return json({ error: "Describe the product first." }, 400, env, origin);
      const result = await runModel(env,
        "You help a shop set up a product record. Return only JSON with keys name, category, unit, packUnit, packSize, outerUnit, outerCount. Suggest a category from the supplied list when suitable. Extract package quantities only when clear from the description; otherwise use empty strings. Choose a practical smallest count unit such as piece, tablet, g, or ml. Never return price, cost, stock quantity, barcode, expiry, or dosage. Do not claim facts that are not in the description. These are suggestions that a human will review.",
        JSON.stringify({ description, availableCategories: categories }), 180);
      const suggestion = {
        name: safeText(result.name, 100) || description,
        category: safeText(result.category, 50),
        unit: safeText(result.unit, 24),
        packUnit: safeText(result.packUnit, 32),
        packSize: Number(result.packSize) > 0 && Number(result.packSize) < 1000000 ? Number(result.packSize) : "",
        outerUnit: safeText(result.outerUnit, 32),
        outerCount: Number(result.outerCount) > 0 && Number(result.outerCount) < 10000 ? Number(result.outerCount) : ""
      };
      return json({ suggestion, model: MODEL }, 200, env, origin);
    } catch (error) {
      console.error("Workers AI request failed", error);
      const detail = safeText(error?.message || "", 220);
      return json({ error: detail ? `The AI model failed: ${detail}` : "The AI model request failed. Check the Worker logs for details." }, 502, env, origin);
    }
  }
};

