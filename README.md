# Stockroom

A friendly, static inventory and checkout app for a small shop or warehouse. It runs in the browser and can be hosted on GitHub Pages; it does not need a server, database, build step, API key, or sign-in.

## Put it on GitHub Pages

1. Create a GitHub repository for the site.
2. Copy the **contents** of this folder into the repository root, including `index.html`, this README, and `.github/workflows/pages.yml`.
3. Push the files to the repository's `main` branch.
4. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source.
5. The included workflow publishes the site. Its address appears in **Settings → Pages** after the first successful run.

You can also publish `index.html` from a branch configured with GitHub Pages. The app itself is a single HTML file and works from the repository root.

## What’s included

- Overview with stock value, today's sales, low-stock notices, expiring products, and recent inventory changes.
- Product catalog with search by name, SKU, barcode, category, and storage location; filter by category or stock level.
- Editable products with section, row, column, rack, quantity, minimum stock, sell and cost price, unit, variant or dosage, barcode, and expiry date.
- Product name suggestions mapped to category, unit, dosage, icon, and SKU defaults; duplicate name, SKU, barcode, and complete shelf-position checks while adding or editing.
- Packaging conversions track stock in the smallest unit (such as grams, millilitres, or pieces) while receiving and selling by loose unit, pack, dozen, carton, or another configured size. Sales can use a smaller unit and a quantity such as 500 ml; they do not have to be sold as a full carton.
- Receiving and correcting stock, with an activity trail.
- Checkout with a cart, payment method, customer note, stock deduction, saved bills, and printable receipt.
- Barcode lookup by typing or using a USB scanner. Camera scanning is offered when the browser supports the native `BarcodeDetector` API and camera access.
- Search frequency tracking, JSON backup/restore, and CSV export.
- Excel friendly CSV sheets for inventory, sales, and activity, with inventory CSV import.
- An optional live autosave JSON file on the computer (Chrome/Edge File System Access API), alongside browser storage.
- A starter list of common grocery, pharmacy, personal care, and household products to set up quickly.
- Optional hosted AI search and product setup suggestions through a Cloudflare Worker; no API key is placed in the GitHub Pages code.
- Shop name, currency symbol, alert threshold, categories, and storage sections can be customized.
- Responsive layout for desktop and mobile.

## Data and privacy

Products, bills, settings, activity, and search counts are saved in the current browser profile using `localStorage`, so refreshing the page does not clear them. In **Settings → Autosave on this computer**, Chrome and Edge can also connect a JSON file that Stockroom updates after each change. Other browsers use browser storage and manual downloads. The file picker needs your permission and the file should remain in a location your computer can write to.

The CSV buttons create separate inventory, sales, and activity sheets that open in Excel. Inventory CSV import uses the exported inventory headings (`name`, `sku`, `barcode`, `category`, `section`, `row`, `column`, `rack`, `quantity`, `unit`, `minimum`, `price`, `price_unit`, `cost`, `dosage`, `expiry`, `pack_unit`, `pack_size`, `outer_unit`, `outer_count`). Quantity is stored in the smallest unit; package sizes tell the app how to convert cartons and packs. Rows with a matching barcode or SKU update that product; other duplicate rows are skipped. JSON backups include all app data and can move it to another browser or device.

This static GitHub Pages app does not sync to a cloud account or share data across staff devices. Cloud sync needs a backend service or a connected cloud provider. The local autosave file is the automatic backup option in this version.

The dashboard starts with sample products. The **Common items** list in Inventory lets you add familiar grocery, pharmacy, personal care, and household product templates; fill in the actual quantities, prices, barcodes, expiry dates, and locations for your shop. Remove or edit the sample records before using it for live stock. This is a lightweight single-device tracker, not a hosted multi-user point-of-sale service; use your existing accounting and tax process for official records.

Camera access needs a secure context (GitHub Pages uses HTTPS) and browser permission. If camera scanning is unavailable, a USB barcode scanner that types into a field or manual barcode entry works instead. The optional display font is loaded from Google Fonts; the site uses system sans-serif fonts if it cannot load.

## Enable AI with GitHub Pages

GitHub Pages serves static files; it cannot safely hold an AI provider key or run model inference. The recommended setup for this app is **GitHub Pages for the website + a Cloudflare Worker for AI requests**. The Worker calls Cloudflare Workers AI through a server-side `AI` binding, so no provider API key is shipped in the site. The app already calls the Worker for AI Search and product setup.

### Deploy the Worker once

1. Create or sign in to a Cloudflare account. Cloudflare's [Workers AI setup guide](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/) lists the prerequisites; the Wrangler path needs Node.js.
2. Set `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` to the exact origins you will use, separated by commas and with no paths or trailing slashes. For a project site like `https://OWNER.github.io/stockroom/`, use `https://OWNER.github.io`; for a custom domain, use its origin, such as `https://stock.example.com`. The sample also includes `http://localhost:8000` for local testing. Remove origins you do not use; the Worker rejects `*` and unset origins.
3. From the `worker/` directory, run `npx wrangler login` once and then `npx wrangler deploy`. Wrangler uses the configured [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) named `AI`. Alternatively, create a Worker in the Cloudflare dashboard from `worker/src/index.js`, add the Workers AI binding `AI`, set the `ALLOWED_ORIGINS` variable, and deploy it.
4. Copy the resulting `https://...workers.dev` URL into `ai-config.js` as `window.STOCKROOM_AI_ENDPOINT`, then push that change to GitHub. It configures every visitor's browser. You can instead save the Worker URL in **Stockroom → Settings → Hosted AI connection** to configure only the current browser.
5. Open Settings and choose **Test connection**. It checks the Worker and confirms that the AI binding is attached.

For a local AI test, serve the site over `http://localhost:8000` (for example, run `python -m http.server 8000` from the site folder), make sure that origin is in `ALLOWED_ORIGINS`, and set the Worker URL in `ai-config.js`. Opening `index.html` directly as a `file://` URL is not supported for hosted AI because it does not have the allowed web origin. The inventory interface itself still runs locally without the Worker; only hosted AI features need this connection.

Cloudflare currently lists GLM-4.7-Flash among models available on Workers Free and documents a shared 10,000-Neuron daily free allocation. It is a usage limit, not unlimited inference; check [current pricing and limits](https://developers.cloudflare.com/workers-ai/platform/pricing/).

AI Search sends the search phrase plus product names, categories, and base units so the model can rank inventory and starter items. Product setup sends the typed description and category names for suggestions. Prices, costs, stock counts, barcodes, expiry dates, and shelf positions are not included. Inventory and sales continue to stay in each browser; this AI connection does not add cloud data sync. The model does not browse the web or query an external product database, so review generated package suggestions before saving.

`ALLOWED_ORIGINS` is a browser CORS check, not login or full API authentication: a public Worker URL can still be called directly by non-browser clients. Monitor usage in Cloudflare, and add authentication or bot/rate-limit controls before opening this endpoint to a broad public audience. If the Worker is unavailable or the account reaches its AI allowance, regular search and manual product entry still work.

