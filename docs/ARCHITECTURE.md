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

## 3. Inside `src/`

`src/` is split into three layers. Each layer only uses the ones below it:

```
 src/app/          Pages and API routes          ← "what is at which address"
     │ uses
 src/components/   Pieces of screens (UI)        ← "what it looks like"
     │ uses
 src/lib/          Logic and data access          ← "how it works"
```

### 3.1 `src/app/`: pages and routes

In Next.js, **the folder path is the web address**. A `page.tsx` inside a folder is the page at that address. `layout.tsx` wraps all pages below it, and `route.ts` is an API endpoint.

```
src/app/
├── layout.tsx, globals.css, fonts.ts     Root of every page, global styles, fonts
├── icon.tsx, apple-icon.tsx, manifest.ts Browser icons and "add to home screen"
├── robots.ts, sitemap.ts                 For search engines
├── not-found.tsx, global-error.tsx       Fallback 404 and crash pages
│
├── [locale]/                  CUSTOMER SITE. [locale] = en | ka | ru
│   ├── layout.tsx             Header, footer, cart; loads menu + restaurant data
│   ├── page.tsx               Home page                      /en
│   ├── menu/page.tsx          Menu                           /en/menu
│   ├── cart/page.tsx          Cart                           /en/cart
│   ├── checkout/page.tsx      Checkout                       /en/checkout
│   ├── order/[publicId]/      Order tracking                 /en/order/abc123
│   ├── privacy/ terms/ refunds/   Legal pages
│   ├── opengraph-image.tsx    Picture shown when a link is shared
│   ├── styleguide/            Design reference (development only)
│   └── [...rest]/             Any unknown address → translated 404
│
├── admin/                     ADMIN PANEL (English only, staff login required)
│   ├── login/                 Sign-in page                   /admin/login
│   ├── (panel)/               Everything behind the login (the "(panel)" folder
│   │   │                      name doesn't appear in the address)
│   │   ├── layout.tsx         Checks login, shows the ☰ menu bar
│   │   ├── page.tsx           Orders board                   /admin
│   │   ├── tables/            Tables (owner)                 /admin/tables
│   │   ├── history/           Past orders                    /admin/history
│   │   ├── menu/              Edit dishes, photos, sold-out  /admin/menu
│   │   ├── printers/          Printer setup                  /admin/printers
│   │   ├── reports/           Sales reports + CSV export     /admin/reports
│   │   ├── settings/          Business profile, hours, fees  /admin/settings
│   │   └── staff/             Staff accounts (owner)         /admin/staff
│   ├── print/[orderId]/[kind] Printable KOT / bill ticket
│   └── _actions/              SERVER ACTIONS: the functions the admin buttons call
│       ├── auth.ts            Sign in / out, change password (with lockout)
│       ├── orders.ts          Accept, reject, change status, mark paid
│       ├── counter.ts         Table & takeaway orders, add dishes, take payment, tables
│       ├── menu.ts            Dishes, categories, photos, sold out
│       ├── settings.ts        All settings forms
│       ├── printing.ts        "Has this ticket been printed?" bookkeeping
│       └── staff.ts           Add / remove staff, roles, passwords
│
└── api/                       API ROUTES (called by browsers or by schedulers)
    ├── orders/route.ts        POST: create an order from the checkout (the only way)
    ├── orders/[publicId]/     GET: the tracking page's latest order status
    ├── cron/sheet-sync/       POST: every 5 min: import the Google Sheet, clean-up
    └── payments/[provider]/   Webhook for online card payments (prepared, not used yet)
```

`src/proxy.ts` runs before every request. It sends `/` to `/en` (or the visitor's language), and keeps the admin area out of search engines.

### 3.2 `src/components/`: screen pieces

```
src/components/
├── ui/          Basic building blocks: Button, Field/Input, icons
├── brand/       Logo and round monogram
├── layout/      Site header, footer, language switcher
├── home/        Home page sections (hero, signature dishes, about…)
├── menu/        Menu browser, dish card, dish details sheet, veg/spice marks
├── cart/        Cart drawer, cart lines, totals, cart page
├── checkout/    Checkout form, time picker, location picker
├── order/       Order tracking page
├── restaurant/  "Open now / Closed" sign
├── providers/   Things wrapped around the site: shop data + cart (shop-provider),
│                analytics, service worker
├── legal-page.tsx   Renders a legal page from src/content/legal.ts
│
└── admin/       Admin panel screens
    ├── admin-nav.tsx      ☰ side menu
    ├── orders-board.tsx   The Orders page: Dine in / Takeaway / Online tabs,
    │                      live updates, sound alerts, auto-printing
    ├── order-card.tsx     One order in full: dishes, status buttons, payment
    ├── counter/           Tiles, table grid, "new order" dish picker, Tables page
    ├── menu/  settings/  printers/  staff-manager.tsx   The other admin pages
    ├── print/             Ticket layouts (KOT and bill) and auto-print helper
    └── ui.tsx             Shared admin form pieces (Card, Labeled, Check…)
```

Files starting with `'use client'` run in the browser (anything with clicks, state or live updates). All others run only on the server.

### 3.3 `src/lib/`: logic and data

```
src/lib/
├── domain/      PURE BUSINESS RULES (no database, fully unit-tested)
│   ├── pricing.ts     Cart totals, delivery fee, minimum order, option prices
│   ├── hours.ts       Opening hours, "open now?", time slots
│   ├── menu.ts        Menu shape, what's orderable
│   ├── money.ts       Money is whole tetri (1 GEL = 100 tetri); formatting
│   ├── phone.ts       Georgian / international phone numbers
│   ├── zones.ts       Delivery areas (distance from the restaurant)
│   ├── restaurant.ts  Business profile (name, address, texts per language)
│   └── i18n-text.ts   Texts stored in three languages {en, ka, ru}
│
├── data/        READING FROM THE DATABASE (cached)
│   ├── restaurant.ts  getMenu(), getRestaurant(): used by almost every page
│   └── public-order.ts  One order for the tracking page
│
├── orders/      CREATING ORDERS
│   ├── schema.ts      What a checkout request must look like (Zod)
│   ├── prepare.ts     Re-prices the order from the live menu, checks hours/zones
│   ├── format.ts      Order numbers ("BP-1042"), Telegram/WhatsApp message text
│   └── local.ts       What the customer's browser remembers about its orders
│
├── admin/       ADMIN HELPERS
│   ├── auth.ts        requireStaff() / requireOwner(): the login check
│   ├── orders.ts      Status names, which buttons an order shows next
│   ├── printing.ts    Opening print tickets
│   ├── reports.ts     Report maths (days, weeks, channels)
│   └── alerts.ts      Sound / notification alerts
│
├── print/       Ticket contents and printed labels in three languages
├── sheet/       Google Sheet import: download CSV → check rows → apply safely
├── notify/      New-order alerts to Telegram and email
├── payments/    Online payment plug-in point (not active)
├── seo/         Page titles, share images, structured data for Google
├── cart/        The cart, stored in the customer's browser
├── supabase/    Database connections (see §5) + generated table types
├── env.ts, env.server.ts   Reads and checks the settings (environment variables)
├── request.ts   IP hashing, random ids
└── monitoring.ts  Error reporting
```

Other folders in `src/`:

- `src/i18n/`: language set-up. `routing.ts` lists the languages, and `navigation.ts` provides language-aware links.
- `src/content/legal.ts`: the Privacy, Terms and Refund texts in three languages.

## 4. How things flow

### 4.1 A customer places an order

```
Menu page ──add dishes──► Cart (saved in the browser: lib/cart/store.ts)
                             │
Checkout form (components/checkout/checkout-form.tsx)
   checks the form in the browser (lib/orders/schema.ts)
                             │  POST /api/orders
                             ▼
app/api/orders/route.ts
   1. validate again (never trust the browser)
   2. rate limits: per device, per phone
   3. prepareOrder(): re-price everything from the live menu, check opening
      hours, delivery zone, minimum order, sold-out dishes (lib/orders/prepare.ts)
   4. save order + dishes in one step: database function create_order
   5. after replying: Telegram / email alert (lib/notify)
                             │
                             ▼
Customer is sent to /en/order/<publicId>: the tracking page, which updates live
```

### 4.2 The kitchen handles it

```
Database change ──Supabase Realtime──► Orders board (components/admin/orders-board.tsx)
                                           rings, shows a red "new" tile
Staff tap Accept ──server action (app/admin/_actions/orders.ts)──► database
   └─ the database checks the move is allowed (e.g. can't "complete" an unpaid order)
Auto-print device: opens /admin/print/<id>/kot and prints the kitchen ticket
Customer's tracking page updates (Realtime broadcast)
```

### 4.3 Table and takeaway orders (the till)

The cashier taps a free table or **+ New takeaway**, picks dishes (`components/admin/counter/order-entry.tsx`), and `createCounterOrder` saves it and prints the KOT. **+ Add dishes** creates another round with its own ticket. **Bill & pay** prints the bill and records cash or card (`settleOrder`), which also frees the table.

### 4.4 Menu from a Google Sheet (optional)

Every 5 minutes, Netlify runs `netlify/functions/sheet-sync.mts`, which calls `POST /api/cron/sheet-sync`. That downloads the sheet's CSV tabs, checks every row (`lib/sheet/`), and applies only valid rows. It also clears old data and keeps the free database awake. Alternatively, the menu is edited directly in **Admin → Menu**.

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

There are three kinds of database connection (`src/lib/supabase/`):

| Connection        | Where                                  | Rights                                              |
| ----------------- | -------------------------------------- | --------------------------------------------------- |
| `browserClient()` | In the browser                         | Only what the logged-in person may see (live board) |
| `sessionClient()` | On the server, as the logged-in person | Same, used by admin actions                         |
| `serviceClient()` | On the server only, secret key         | Everything; used only after checking the login      |

`supabase/seed.sql` holds sample data and **local-only** test logins. It is never sent to the live database.

## 6. Where to change common things

| I want to…                                            | Go to                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Change name, address, phone, texts                    | Admin → Settings → Business profile (no code)                          |
| Change dishes, prices, photos                         | Admin → Menu, or the Google Sheet                                      |
| Change hours, fees, delivery zones                    | Admin → Settings                                                       |
| Change a button label or message on the customer site | `messages/en.json`, `ka.json`, `ru.json` (same key in all three)       |
| Change legal texts                                    | `src/content/legal.ts`                                                 |
| Change colours, fonts                                 | `src/app/globals.css` (colour tokens), `src/app/fonts.ts`              |
| Change how a page looks                               | the page in `src/app/…` → the components it uses in `src/components/…` |
| Change price, fee or opening-hours rules              | `src/lib/domain/pricing.ts`, `hours.ts`                                |
| Change what the kitchen ticket or bill shows          | `src/components/admin/print/tickets.tsx`, `src/lib/print/labels.ts`    |
| Change order-status buttons                           | `src/lib/admin/orders.ts` (`nextSteps`)                                |
| Add a database column or rule                         | a new file in `supabase/migrations/`, then `npm run db:types`          |
| Change security headers                               | `security-headers.ts`, then `npm run netlify:toml`                     |

## 7. Conventions used everywhere

- **Money** is always whole tetri (integers), never decimals: GEL 22.50 is stored as `2250`.
- **Texts shown to customers** come from `messages/*.json` or are stored as `{en, ka, ru}` in the database. Never write customer text directly in code.
- **Nothing about the business is written in code.** Name, address and phone come from the database. A test (`src/lib/config.test.ts`) fails if they are written in code.
- **Check twice:** forms are checked in the browser for quick feedback, then again on the server, and the database has its own rules as a last line of defence.
- **Tests:** logic in `src/lib/**/*.test.ts` (Vitest), and whole flows in `e2e/*.spec.ts` (Playwright: ordering, printing, tables, accessibility).

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
