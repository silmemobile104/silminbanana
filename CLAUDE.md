# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # or `npm run dev` — identical, both run `node src/server.js`. No watcher.
npm run seed       # Wipes and reseeds branches/users/products/stock (src/scripts/seed.js)
```

There is **no test suite, no linter, and no build step**. Don't look for one, and don't add npm scripts referencing tools that aren't in `package.json`. Verification is done by running the server and exercising the UI at `http://localhost:3000`.

One-off maintenance scripts are run directly and each connects to Mongo on its own:

```bash
node src/scripts/dropSkuIndex.js              # Drop legacy sku_1 index from products
node src/scripts/migrate_sales_credit.js      # Backfill credit fields on existing sales
node src/scripts/fix_audits.js                # Repair malformed DailyAudit documents
node src/scripts/update_admin_role_perm.js    # Grant a new menu key to the admin role
```

The `update_*_role_*.js` scripts are the established pattern for granting a newly added menu key to the `admin` role in existing databases. When you add a menu, copy one of them rather than editing the DB by hand.

## Environment

`src/config/db.js` reads `MONGO_URI` (falling back to `MONGODB_URI`). Note that **`src/scripts/seed.js` reads only `MONGODB_URI`** — set both, or fix the script, or the seed silently misbehaves (see gotcha below). Also required: `JWT_SECRET`. Optional: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` / `GOOGLE_DRIVE_FOLDER_ID` for audit IMEI photo upload.

`.env.example` is **git-tracked** while `.gitignore` covers only `node_modules` and `.env` — keep placeholder values in it, never real credentials.

## Architecture

Express + Mongoose monolith serving a vanilla-JS single-page app. No framework, no bundler, no transpilation — `public/` is served as static files and the browser runs the source directly.

**Request path:** `src/routes/*Routes.js` → `authenticateToken` → `src/controllers/*Controller.js` → Mongoose model → JSON. Every response follows `{ success: boolean, message?, ...data }`. Controllers pass errors to `next(err)`; `src/middleware/errorHandler.js` is the single formatter.

`src/server.js` mounts all routes under `/api/*`, then falls through to `app.get('*')` serving `index.html` for SPA routing. Static files are served with aggressive no-cache headers, so a hard refresh always picks up frontend edits.

**Boot sequence** (`server.js:32`) runs three idempotent steps after connecting: `autoSeedIfEmpty()` (populates 5 Thai branches, master options, 6 demo users, products, stock, and a demo audit — but only when `User.countDocuments()` is 0), `seedDefaultRolesIfEmpty()` (creates the `admin` role with every menu key), and `repairData()` (runs the one-to-one stock migration on every start). Adding startup repair work means adding it to `repairData`.

### Domain model

The system is a multi-branch phone retailer with IMEI-level tracking. The load-bearing invariant: **one `Stock` document = one physical device**, keyed by `imei`. Quantities are never stored as counts — a "quantity of 3" is three `Stock` documents. `migrateStockToOneToOne.js` exists to enforce this on legacy data and still runs at every boot. Stock moves through `status`: `in_stock` → `sold` | `transferred` | `in_transit` | `released` | `missing`.

The workflows, and the models that carry them:

- **Daily audit** (`DailyAudit`, `auditController`) — the core business process. A branch submits a count; the system diffs `expectedImeis` against `scannedImeis` to derive `missingImeis` / `unexpectedImeis` and a `variance`. HQ then verifies or rejects. Unique index on `{ auditDate, branch }` means one audit per branch per day. `auditDate` is a `YYYY-MM-DD` **string**, not a Date. IMEI photos upload to Google Drive and are read back through `proxyDriveImage` (the server proxies them so Drive links never reach the browser).
- **Goods receipt** (`GoodsReceipt`, `stockController`) — staged intake. Items are received, then priced and confirmed in a separate verification step before becoming `Stock`.
- **Purchase orders** (`BranchPurchaseOrder`, `purchaseOrderController`) — HQ→branch ordering that draws against `Branch.creditLimit` / `usedCredit`.
- **Transfers** (`StockTransfer`, `transferController`) — inter-branch movement with a printable document.
- **POS** (`Sale`, `posController`) — sale decrements stock by IMEI, supports cash/transfer and financed sales, plus void-with-approval. Also hosts the dashboards and finance/profit aggregations:
  - `GET /pos/executive-dashboard?date=&branchId=` — one day, optionally one branch. Returns today/yesterday revenue and bills, hourly buckets, the 7-day product and branch rollups, low-stock alerts, pending POs, and the activity trail.
  - `GET /pos/sales-series?range=7d|30d|90d|1y&date=&branchId=` — daily buckets carrying revenue, orders and profit together, plus the equally long window before it. All three metrics ship in one call so the dashboard switches between them without a round trip; every day in the window gets a bucket, including empty ones.
  - `GET /pos/staff-dashboard?branchId=` — the branch-level equivalent.
- **`AuditLog`** — cross-cutting activity log. Controllers write to it inline (`{ user, username, userRole, action, entity, entityId, details }`) on mutating operations; follow that pattern for new mutations.

### Authorization — read this before touching permissions

**`authorize()` in `src/middleware/auth.js` is a deliberate no-op.** It accepts role arguments and ignores them, calling `next()` for any active authenticated user. Route definitions like `authorize('admin', 'hq_stock_staff')` are historical decoration and enforce nothing. All real access control is menu-visibility driven and lives in the frontend.

Permissions are menu keys (`dashboard`, `pos`, `branch-audit`, …). The canonical list is `SYSTEM_MENUS` in `src/controllers/roleController.js`, mirrored by `ALL_SYSTEM_MENUS` in `public/js/app.js`. A `Role` document holds `allowedMenus`; `User.role` is a **string that matches `Role.code`**, not an ObjectId reference.

Adding a menu therefore means touching five places: `SYSTEM_MENUS` (roleController), `ALL_SYSTEM_MENUS` + the `navigateTo` switch + a `render*View` function (app.js), the sidebar markup in `index.html` (a flat `<li>` list where `<li class="nav-section">` rows are group labels — `updateSidebarMenuByRole()` hides a label once every item under it is hidden), and a migration script to grant it to existing admin roles.

Branch scoping is done per-controller, not by middleware — controllers read `req.user.branch` (populated by `authenticateToken`) and fall back to a `branchId` query param for HQ users. **HQ status is detected by hardcoded branch code `BR-HQ01` or a name containing `สำนักงานใหญ่`** (see `expenseController.js:13`). That string check is duplicated across several controllers.

### Frontend (`public/js/app.js`, ~12k lines)

One file, one global `state` object (`token`, `user`, `currentView`, `masterOptions`, `posCart`), persisted to `localStorage` under `silmin_token` / `silmin_user`. All server calls go through `apiRequest(endpoint, method, data, isFormData)`, which prefixes `/api`, attaches the bearer token, and force-logs-out on 401 or any Thai/English "session expired" message.

Routing is the `switch` in `navigateTo(viewName)` (`app.js:358`): it sets the page heading/subheading and awaits one `render*View()` function. Each view function fetches its own data and writes a full HTML string into `#content-container` — there is no diffing or component model, so re-rendering a view means calling its render function again. Filter state is passed as render-function arguments (e.g. `renderBranchInventoryView(branchId, status, brand)`), not held in `state`.

Because views build HTML with template-literal interpolation, **any user-supplied string interpolated into markup is an injection risk**. `escapeHtml()` (`app.js:120`) exists for this — use it on every interpolated value that came from the database or a user, and note that most older view code still does not.

Fonts and icons are self-hosted (`public/fonts/`, `public/webfonts/`) and nothing render-blocking comes from a third party. Chart.js and SheetJS are **not** in `index.html`; `loadChartJs()` / `loadXlsx()` fetch them from jsDelivr on first use and cache the promise, so a view that draws a chart must `await loadChartJs()` before touching `window.Chart`.

`public/css/fontawesome.min.css` is a **subset** — only icons found in `app.js`, `index.html` and `SYSTEM_MENUS` have a rule. Using a new `fa-*` class renders an empty box until the subset is rebuilt from the full upstream stylesheet.

Both `styles.css` and `app.js` are linked with `?v=` cache-busting queries — bump both when changing either.

## Conventions

- **All user-facing strings are Thai**, including API `message` fields, error text, and console log output. Match this — new messages should be Thai, not English.
- Server logs use emoji status prefixes (🟢 success, 🔴 error, 🟡 fallback) and `[Component]` tags.
- Commit messages in this repo are written in Thai.
- `MasterOption` is a generic `{ type, value, parent, isActive }` table backing all dropdowns (`type` ∈ brand/model/capacity/color/variation/category), with `parent` linking models to their brand. It has a unique index on `{ type, value }`. Add options through it rather than hardcoding lists.
- `Branch` and `User` expose virtuals for legacy field names (`branchCode`, `branchName`, `branchId`, `remainingCredit`). Both models set `toJSON: { virtuals: true }`, so these appear in API responses.
- `User.comparePassword` intentionally accepts plaintext `passwordHash` values and silently upgrades them to bcrypt on first successful login — legacy data support, not a bug.

## Design system

`DESIGN.md` (Thai) is the single source of visual truth: a light console (`#F6F6F7` canvas, white cards) with a dark navigation rail (`#141416`). Colour classifies — category icon plates, status badges, links — it is never decorative, and there are no gradients anywhere. `#FFE169` is the brand fill only (logo, primary button, active rail marker, revenue curve); when the accent has to be *read* it becomes `--primary-ink` (`#7A5A00`). Text on yellow is always `#1d1d1f` — white on `#FFE169` is 1.29:1.

Every colour, size and radius is a token in `public/css/styles.css`. The bottom of the `:root` block maps the ~2,000 legacy token names `app.js` still writes inline (`--text-muted`, `--bg-card`, `--canvas-elevated`, …) onto the current ones — that mapping is what lets one stylesheet re-skin all 20 views, so do not delete it. Bump both `?v=` query strings in `index.html` after changing CSS or JS.

Two traps the doc spells out: a dark card is the `.card-invert` class (which re-points its own tokens) and never hand-written `style="color:white"` — that paints the wrapper while children with their own colour stay unreadable. And the three `document.write()` print templates never load `styles.css`, so `var(--token)` inside them resolves to nothing and `border: 1px solid var(--hairline)` silently drops the whole border; print templates use literal hex only.

## Gotchas

- **Silent in-memory database fallback.** When `NODE_ENV !== 'production'` and the Mongo connection fails, `db.js:21` spins up `MongoMemoryServer` and connects to that instead. The server starts normally and logs a 🟡 line that is easy to miss. If data "disappears" between restarts or seeded users don't exist, check whether you're actually on Atlas.
- **`seed.js` reads `MONGODB_URI` only**, unlike `db.js` and the other scripts which prefer `MONGO_URI`. With only `MONGO_URI` set, the seed falls back to localhost, fails, and then seeds an ephemeral in-memory server — succeeding loudly while writing nothing to your real database.
- **`src/config/cloudinary.js` is half-wired.** `productController.js:4` destructures `uploadToCloudinary`, which that module does not export (it exports `uploadImage` and `cloudinary`) — the import is `undefined` today. When the Cloudinary env vars are absent, `uploadImage` falls through to returning a base64 data URI that gets stored inline in MongoDB.
- Seeded credentials are `admin` / `Admin@123456`, all other demo users `Staff@123456`.

## Other agent configs

A `.gemini/` directory exists in this repo and in the home directory. If you want those settings (MCP servers, commands, instructions) available to Claude Code, reply `/import` to see what's importable, then `/import --yes=<digest>` to apply it. Don't hand-copy the config.
