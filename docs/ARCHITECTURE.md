# How this project is built

A map of the code: what each folder is for, how an order travels through the system, and where to go to change common things. For setup and deployment see `README.md`; for day-to-day use of the admin panel see `OWNER_GUIDE.md`.

## 1. The big picture

The project is one Next.js application with two faces, backed by one Supabase database.

```
 Customers (phone/laptop)                 Staff (tablet at the counter)
        │                                          │
        ▼                                          ▼
 ┌──────────────────────────── Next.js app (src/) ─────────────────────────────┐
 │  Customer site  /en /ka /ru          Admin panel  /admin                     │
 │  home, menu, cart, checkout,         orders board, tables, menu, printers,   │
 │  order tracking, legal pages         reports, settings, staff, history       │
 │                                                                              │
 │  API routes  /api/orders  /api/cron/sheet-sync  /api/payments/...            │
 └───────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
 ┌──────────────────────────── Supabase (supabase/) ───────────────────────────┐
 │  Postgres database (menu, orders, settings…) with security rules (RLS)      │
 │  Auth (staff logins) · Storage (dish photos) · Realtime (live order board)  │
 └──────────────────────────────────────────────────────────────────────────────┘
        ▲                                          ▲
 Google Sheet (optional menu source)        Telegram / email (new-order alerts)
```

| Piece                    | Technology                           | Why                                                  |
| ------------------------ | ------------------------------------ | ---------------------------------------------------- |
| Web app                  | Next.js 16 (React 19, App Router)    | Pages and server code in one project                 |
| Styling                  | Tailwind CSS v4                      | Styles written as class names on elements            |
| Languages                | next-intl                            | English, Georgian and Russian from `messages/*.json` |
| Database, logins, photos | Supabase (Postgres)                  | Free tier, security rules in the database            |
| Validation               | Zod                                  | Checks every form and API input                      |
| Hosting                  | Netlify (free)                       | Builds from GitHub, runs the 5-minute scheduled job  |
| Tests                    | Vitest (logic), Playwright (browser) | `npm test`, `npm run test:e2e`                       |

## 2. Top-level folders

```
BP/
├── src/                 The application (everything that runs)
├── supabase/            Database: migrations (schema + security), local seed data
├── messages/            Customer-site texts: en.json, ka.json, ru.json
├── e2e/                 Browser tests (Playwright)
├── scripts/             One-off command-line tools (create owner, seed, sheet sync)
├── netlify/functions/   The scheduled job that runs every 5 minutes on Netlify
├── docs/                Sheet template, print templates, this file
├── public/              Static files served as-is (service worker)
├── images/              Original dish photos (not used by the code)
├── netlify.toml         Netlify build settings and security headers
├── next.config.ts       Next.js settings (images, headers)
├── security-headers.ts  Content-Security-Policy and other headers
├── .env.example         List of settings (environment variables) to fill in
├── README.md            Setup, deployment, going live
└── OWNER_GUIDE.md       How to use the admin panel
```

## 3. Inside `src/`: the MVC layers

The code follows **View → Controller → Model Helper → Model**. Each layer calls only the one below it. `npm run lint` enforces this, and it fails when a file imports from the wrong layer. Type-only imports (`import type`) are allowed anywhere.

```
 src/app/  +  src/views/     VIEW          what is at which address, and what it looks like
        │ calls
 src/controllers/            CONTROLLER    checks who is signed in and what was sent; turns
        │ calls                            results into messages, HTTP replies, page data
 src/model-helpers/          MODEL HELPER  the business rules: pricing, order workflow,
        │ calls                            Sheet import, reports, tickets
 src/models/                 MODEL         the only code that talks to the database
        │
 Supabase (Postgres, Auth, Storage, Realtime)

 src/shared/   small pure tools every layer may use (money, hours, phone, cart, schemas)
 src/config/   settings (environment variables) and the language set-up
```

An example, **Accept an order**:

| Layer        | File                                  | What it does                                                           |
| ------------ | ------------------------------------- | ---------------------------------------------------------------------- |
| View         | `views/admin/order-card.tsx`          | The **Accept** button calls `updateOrderStatus(...)`                   |
| Controller   | `controllers/admin/orders.actions.ts` | `requireStaff()`, validates the input, turns `not_paid` into a message |
| Model Helper | `model-helpers/orders/kitchen.ts`     | `changeStatus()`: works out the ready time, decides what to change     |
| Model        | `models/orders.ts`                    | `findState()`, `update()`: the actual queries                          |

### 3.1 View: `src/app/` (routing) and `src/views/` (screens)

In Next.js, **the folder path under `src/app/` is the web address**, so this folder can't be renamed. Each `page.tsx` is kept short: it asks a controller for its data, then renders views. Each `route.ts` (API endpoint) is one line that hands the request to a controller.

```
src/app/
├── layout.tsx, globals.css, fonts.ts     Root of every page, global styles, fonts
├── icon.tsx, apple-icon.tsx, manifest.ts Browser icons and "add to home screen"
├── robots.ts, sitemap.ts                 For search engines
├── not-found.tsx, global-error.tsx       Fallback 404 and crash pages
├── [locale]/                  CUSTOMER SITE. [locale] = en | ka | ru
│   ├── layout.tsx, page.tsx   Header/footer/cart; home page        /en
│   ├── menu/ cart/ checkout/  Menu, cart, checkout                  /en/menu …
│   ├── order/[publicId]/      Order tracking                        /en/order/abc123
│   ├── privacy/ terms/ refunds/   Legal pages
│   ├── opengraph-image.tsx    Picture shown when a link is shared
│   ├── styleguide/            Design reference (development only)
│   └── [...rest]/             Any unknown address → translated 404
├── admin/                     ADMIN PANEL (English only, staff login required)
│   ├── login/                 Sign-in page                          /admin/login
│   ├── (panel)/               Everything behind the login ("(panel)" isn't in the address)
│   │   ├── layout.tsx         Checks login, shows the ☰ menu bar
│   │   ├── page.tsx           Orders board                          /admin
│   │   └── tables/ history/ menu/ printers/ reports/ settings/ staff/
│   └── print/[orderId]/[kind] Printable KOT / bill ticket
└── api/                       API ROUTES → controllers/api
    ├── orders/                POST: create an order · GET [publicId]: tracking status
    ├── cron/sheet-sync/       Every 5 min: Google Sheet import and clean-up
    └── payments/[provider]/   Webhook for online card payments (prepared, not used yet)
```

```
src/views/
├── ui/ brand/ layout/       Buttons, fields, icons; logo; header, footer, language switch
├── home/ menu/ cart/        Home sections; menu browser and dish sheet; cart
├── checkout/ order/         Checkout form, time and location pickers; order tracking
├── restaurant/ providers/   "Open now" sign; shop data + cart, analytics, service worker
├── content/legal.ts         Privacy, Terms and Refund texts in three languages
├── legal-page.tsx           Renders a legal page
└── admin/                   Admin screens: orders board, order card, counter (tables,
                             dish picker), menu, settings, printers, staff, print tickets
```

Files starting with `'use client'` run in the browser (anything with clicks, state or live updates). All others run only on the server.

### 3.2 Controller: `src/controllers/`

```
src/controllers/
├── proxy.ts               Front controller for every page request (from src/proxy.ts):
│                          language routing; for /admin, session refresh + login redirect
├── site/shop.ts           What the customer pages read: restaurant, menu, tracked order
├── api/
│   ├── orders.ts          POST /api/orders (body size, validation, honeypot → HTTP reply)
│   │                      and GET /api/orders/<id>
│   ├── cron.ts            The scheduled job (checks CRON_SECRET)
│   └── payments.ts        Card gateway webhook (checks the signature)
├── admin/
│   ├── guard.ts           requireStaff() / requireOwner(): every admin controller starts here
│   ├── pages.ts           One function per admin page: checks the login, gathers its data
│   ├── *.actions.ts       SERVER ACTIONS: what admin buttons and forms call
│   │                      auth, orders, counter (tables, takeaway), menu, settings,
│   │                      printing, staff
│   ├── reports.ts         CSV download
│   └── form-state.ts      The { ok, message, error } shape forms get back
└── client/                Browser-side controllers: kitchen live updates, order
                           tracking, dish photo upload, the auto-print device
```

Controllers never write SQL and never decide business rules. They check **who** and **what was sent**, call one Model Helper, and translate the result: a reason code like `table_busy` becomes "This table already has an open order".

### 3.3 Model Helper: `src/model-helpers/`

```
src/model-helpers/
├── orders/
│   ├── online.ts        Placing a website order: rate limits, re-pricing, saving, alerts
│   ├── prepare.ts       Re-prices from the live menu; checks hours, zone, minimum
│   ├── kitchen.ts       Board, status changes, prep time, payment, history search
│   ├── counter.ts       Table and takeaway orders, extra rounds, taking payment
│   └── public-order.ts  The tracking page's view of an order
├── restaurant.ts        getMenu() / getRestaurant(): database rows → menu and profile (cached)
├── menu-admin.ts        Editing dishes, categories, options, photos, sold out
├── settings.ts          Settings forms (skipping fields the Google Sheet controls)
├── tables.ts            Dining tables and which are busy
├── staff/               Sign-in with lockout, the signed-in user, staff accounts
├── printing/            Ticket contents, printer settings, print log
├── reports/             Report maths and the CSV file
├── sheet/               Google Sheet import: download CSV → check rows → apply safely
├── notify/              New-order alerts to Telegram and email
├── payments/            Online payment plug-in point (not active) and webhook handling
├── browser/             Browser-side: live board data, photo resizing
└── outcome.ts           The { ok: false, reason } shape for expected failures
```

Helpers choose **whose permissions** a query runs with by picking the database connection (§5): the signed-in staff member (`staffDb`), or the server's secret key (`serviceDb`) after the controller has checked the login.

### 3.4 Model: `src/models/`

One file per group of tables. Each function is one query (or one database function call), takes the connection as its first argument, and throws a `DbError` when the database refuses.

```
src/models/
├── db/            The connections (§5), shared types, DbError, generated table types
├── orders.ts      orders, order_items; create_order / create_counter_order / add_order_round
├── menu.ts        categories, dishes, option groups and options; Sheet snapshot; photos
├── restaurant.ts  restaurant settings, opening hours, closures, delivery zones
├── tables.ts      dining tables
├── staff.ts       staff and their logins
├── session.ts     the signed-in user's own session
├── printing.ts    print settings, claim_print
├── integrations.ts  Google Sheet links and import runs
├── rate-limits.ts   rate limits and the clean-up function
├── payments.ts      payments and webhook events
└── live.ts          Realtime subscriptions in the browser (kitchen board, tracking)
```

### 3.5 `src/shared/` and `src/config/`

```
src/shared/
├── domain/      PURE BUSINESS RULES (no database, fully unit-tested): pricing, hours,
│                menu shape, money (whole tetri), phone, zones, profile, i18n texts
├── orders/      Checkout request schema (browser and server), order number and
│                message formats, what the browser remembers about its orders
├── admin/       Order status names and next steps
├── print/       Printed labels in three languages
├── cart/        The cart, stored in the customer's browser
├── seo/         Page titles, share images, structured data for Google
└── request.ts, monitoring.ts, text.ts, links.ts …   Small tools

src/config/
├── env.ts, env.server.ts   Reads and checks the settings (environment variables)
└── i18n/                   Languages: routing, language-aware links, translations loader
```

## 4. How things flow

### 4.1 A customer places an order

```
Menu page ──add dishes──► Cart (saved in the browser: shared/cart/store.ts)
                             │
Checkout form (views/checkout/checkout-form.tsx)
   checks the form in the browser (shared/orders/schema.ts)
                             │  POST /api/orders
                             ▼
controllers/api/orders.ts     validate again (never trust the browser), honeypot
                             │
model-helpers/orders/online.ts
   1. rate limits: per device, per phone
   2. prepareOrder(): re-price everything from the live menu, check opening
      hours, delivery zone, minimum order, sold-out dishes (orders/prepare.ts)
   3. save order + dishes in one step (models/orders.ts → create_order)
   4. after replying: Telegram / email alert (model-helpers/notify)
                             │
                             ▼
Customer is sent to /en/order/<publicId>: the tracking page, which updates live
```

### 4.2 The kitchen handles it

```
Database change ──Supabase Realtime──► Orders board (views/admin/orders-board.tsx)
                                           rings, shows a red "new" tile
Staff tap Accept ──controllers/admin/orders.actions.ts → model-helpers/orders/kitchen.ts → models/orders.ts
   └─ the database checks the move is allowed (e.g. can't "complete" an unpaid order)
Auto-print device: opens /admin/print/<id>/kot and prints the kitchen ticket
Customer's tracking page updates (Realtime broadcast)
```

### 4.3 Table and takeaway orders (the till)

The cashier taps a free table or **+ New takeaway**, picks dishes (`views/admin/counter/order-entry.tsx`), and `createCounterOrder` (`model-helpers/orders/counter.ts`) saves it and prints the KOT. **+ Add dishes** creates another round with its own ticket. **Bill & pay** prints the bill and records cash or card (`settleOrder`), which also frees the table.

### 4.4 Menu from a Google Sheet (optional)

Every 5 minutes, Netlify runs `netlify/functions/sheet-sync.mts`, which calls `POST /api/cron/sheet-sync`. That downloads the sheet's CSV tabs, checks every row (`model-helpers/sheet/`), and applies only valid rows. It also clears old data and keeps the free database awake. Alternatively, the menu is edited directly in **Admin → Menu**.

## 5. The database (`supabase/`)

The database is built entirely by the numbered files in `supabase/migrations/`, run in order. Never edit an old file: add a new numbered one.

| File                      | What it adds                                                              |
| ------------------------- | ------------------------------------------------------------------------- |
| `…001_foundation`         | Staff table, `is_staff()` / `is_owner()` checks                           |
| `…002_menu`               | Categories, dishes, option groups (e.g. "spice level")                    |
| `…003_settings`           | Restaurant settings, opening hours, closures, delivery zones              |
| `…004_orders`             | Orders, order dishes, status history, payments, rate limits, status rules |
| `…005_security`           | Who may read/write what (Row Level Security)                              |
| `…006_menu_sync`          | Applying a Google Sheet import safely                                     |
| `…007_create_order`       | The one function that creates a website order                             |
| `…008_printing`           | Printer settings, "printed already" records                               |
| `…009_business_profile`   | Name, address, texts, logo letters, order prefix                          |
| `…010/011_tables_counter` | Dining tables, table/takeaway orders, KOT rounds                          |
| `…012_payment_rules`      | Paid before completed; payment locked once finished                       |
| `…013_launch_hardening`   | Foreign phone numbers, payment values, data clean-up                      |

**Security model:** the database itself enforces who can do what, so even a bug in the website can't leak data.

- **Customers** (not logged in) can read the menu and settings, and nothing else. They create orders only through `/api/orders`.
- **Staff** can read orders and change their status and payment.
- **Owners** can also change the menu, settings, tables and staff.

There are four kinds of database connection (`src/models/db/`). Only the Model layer uses them; Model Helpers pick which one a query runs with:

| Connection    | Where                                  | Rights                                              |
| ------------- | -------------------------------------- | --------------------------------------------------- |
| `publicDb()`  | On the server, no login                | What any visitor may read (menu, hours)             |
| `staffDb()`   | On the server, as the logged-in person | Only what that person may see and change            |
| `serviceDb()` | On the server only, secret key         | Everything; used only after checking the login      |
| `browserDb()` | In the browser (models/live.ts)        | Only what the logged-in person may see (live board) |

`supabase/seed.sql` holds sample data and **local-only** test logins. It is never sent to the live database.

## 6. Where to change common things

| I want to…                                            | Go to                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Change name, address, phone, texts                    | Admin → Settings → Business profile (no code)                     |
| Change dishes, prices, photos                         | Admin → Menu, or the Google Sheet                                 |
| Change hours, fees, delivery zones                    | Admin → Settings                                                  |
| Change a button label or message on the customer site | `messages/en.json`, `ka.json`, `ru.json` (same key in all three)  |
| Change legal texts                                    | `src/views/content/legal.ts`                                      |
| Change colours, fonts                                 | `src/app/globals.css` (colour tokens), `src/app/fonts.ts`         |
| Change how a page looks                               | the page in `src/app/…` → the views it uses in `src/views/…`      |
| Change price, fee or opening-hours rules              | `src/shared/domain/pricing.ts`, `hours.ts`                        |
| Change what the kitchen ticket or bill shows          | `src/views/admin/print/tickets.tsx`, `src/shared/print/labels.ts` |
| Change order-status buttons                           | `src/shared/admin/orders.ts` (`nextSteps`)                        |
| Add a database query                                  | a function in `src/models/…`, called from a Model Helper          |
| Change a business rule (e.g. who may do what, when)   | the Model Helper in `src/model-helpers/…`                         |
| Add a database column or rule                         | a new file in `supabase/migrations/`, then `npm run db:types`     |
| Change security headers                               | `security-headers.ts`, then `npm run netlify:toml`                |

## 7. Conventions used everywhere

- **Money** is always whole tetri (integers), never decimals: GEL 22.50 is stored as `2250`.
- **Texts shown to customers** come from `messages/*.json` or are stored as `{en, ka, ru}` in the database. Never write customer text directly in code.
- **Nothing about the business is written in code.** Name, address and phone come from the database. A test (`src/shared/config.test.ts`) fails if they are written in code.
- **Layers:** a page never queries the database, and a model never decides a rule. `npm run lint` fails when a file imports from the wrong layer.
- **Check twice:** forms are checked in the browser for quick feedback, then again on the server, and the database has its own rules as a last line of defence.
- **Tests:** logic in `src/**/*.test.ts` (Vitest), and whole flows in `e2e/*.spec.ts` (Playwright: ordering, printing, tables, accessibility).

## 8. Commands

| Command                               | What it does                                      |
| ------------------------------------- | ------------------------------------------------- |
| `npm run dev`                         | Run the site locally at http://localhost:3000     |
| `npm run db:start` / `db:stop`        | Start / stop the local database (needs Docker)    |
| `npm run db:reset`                    | Rebuild the local database from migrations + seed |
| `npm run db:types`                    | Refresh the table types after a migration         |
| `npm test`                            | Logic tests                                       |
| `npm run test:e2e`                    | Browser tests                                     |
| `npm run lint`, `typecheck`, `format` | Code checks and formatting                        |
| `npm run build`                       | Production build (what Netlify runs)              |
| `npm run create-owner`                | Create the first owner login                      |
| `npm run sheet:sync`                  | Import the Google Sheet by hand                   |
