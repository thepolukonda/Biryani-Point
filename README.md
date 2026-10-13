# Biryani Point Batumi: online ordering

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase. The customer site is in English, Georgian and Russian (`/en`, `/ka`, `/ru`). Orders are saved on the server, the customer gets a live tracking page, and the kitchen works from a live board at `/admin`. The menu, prices and opening hours come from a Google Sheet.

The restaurant owner's plain-language guide is [OWNER_GUIDE.md](OWNER_GUIDE.md). How the code is organised is explained in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- [What's included](#whats-included)
- [Local development](#local-development)
- [Going live](#going-live) (Supabase, first owner, Netlify, domain, Telegram, Sheet, email)
- [Cloudflare (alternative host)](#cloudflare-alternative-host)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Quality checks](#quality-checks)
- [Project structure](#project-structure)
- [Things to confirm before launch](#things-to-confirm-before-launch)

## What's included

**Counter and tables** (Orders page)

- A table map: tap a free table to start a tab, tap a busy one to add dishes, print the bill or take payment (cash or card).
- Each round of dishes prints its own KOT with only the new dishes (`order_items.kot_round`).
- Counter takeaway with an optional name. Priced on the server from the live menu, like website orders (`create_counter_order` / `add_order_round`, service role only).
- Tables are managed on **Admin → Tables** (owner). One open tab per table is enforced by the database.

**Customer site**

- **Home:** open/closed sign, signature dishes, story, map, WhatsApp and call buttons.
- **Menu:**
  - category tabs that follow your scroll, plus search, a vegetarian filter and a "Popular" rail;
  - a dish sheet with options (spice level, extras);
  - a sold-out state and an "order again" row.
- **Cart:** a drawer on every page plus a full `/cart` page. Totals are always recalculated.
- **Checkout:**
  - Georgian +995 phone check;
  - delivery-zone check by map pin or GPS;
  - ASAP or a scheduled time slot;
  - blocked while closed or paused, with minimum-order rules;
  - honeypot, rate limit and double-tap protection.
- **Order placed:** an order number (BP-1001…) and a private tracking link `/en/order/<id>` that updates live. There is also a "Send on WhatsApp" button with the order written out, so the customer can confirm by chat as well.
- **Other pages:**
  - privacy, terms and refunds pages, plus 404 and error pages;
  - SEO: hreflang, sitemap, robots, social images, restaurant JSON-LD;
  - an installable PWA with an offline page.

**Admin (`/admin`, owner and staff logins)**

- **Live order board:** a sound and a flashing tab title on new orders. Staff can:
  - accept with a prep time, reject with a reason;
  - move orders through preparing, ready, out for delivery and completed;
  - call or WhatsApp the customer.
- **Menu:** mark a dish sold out (until tomorrow or indefinitely), hide dishes, upload photos, and "Sync from Sheet now" with the import log.
- **Settings (owner):**
  - pause orders with a message;
  - fees and minimums;
  - delivery zones (radius or polygon);
  - hours and one-off closures;
  - prep times and slot rules;
  - contact details and Sheet links.
- **Reports (owner):** revenue, order counts, top dishes and CSV export. **Staff** accounts (owner only).
- **Printing:** a KOT (kitchen order ticket) prints automatically when an order is accepted, and the customer bill when it is ready for pickup or out for delivery.
  - It works on 58 or 80 mm thermal printers through the browser; nothing needs installing.
  - Reprints are marked. Only a device switched to "print on this device" auto-prints.
  - Printer options are on **Printers**; the business name, ID code and VAT go under Settings → **Bill details**.
- **Notifications:** new orders go to Telegram (free) and optionally email (Resend).

**Payments:** cash on delivery or pay at pickup. An online gateway can be added later behind `src/model-helpers/payments/` (see its README) without touching checkout.

## Local development

You need **Node.js 20.9+** and **Docker Desktop** (for a local copy of Supabase).

```bash
npm install
npx supabase start          # first run downloads Docker images (a few minutes)
cp .env.example .env.local  # then paste the keys printed by `npx supabase status`
npm run db:reset            # creates the tables and loads the starting menu
npm run seed:images         # uploads the 14 dish photos to local Storage
npm run dev                 # http://localhost:3000
```

In `.env.local`, fill in:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the `PUBLISHABLE_KEY` from `npx supabase status`
- `SUPABASE_SECRET_KEY`: the `SECRET_KEY`
- `IP_HASH_SALT` and `CRON_SECRET`: any long random strings
  (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

The local owner and kitchen logins are created by the seed for your machine only. They are listed at the top of `scripts/generate-seed.ts`.

Useful addresses:

- http://localhost:3000/en: the customer site
- http://localhost:3000/admin: the kitchen board
- http://localhost:3000/en/styleguide: the design system (colours, the three scripts, buttons, fields). Development only: it is a 404 on the live site
- http://127.0.0.1:54323: Supabase Studio (the database)
- http://127.0.0.1:54324: Mailpit (catches local auth emails)

## Going live

It takes about an hour, all on free plans. Do the steps in order.

### 1. Supabase (database, logins, photos)

1. Create a project at [supabase.com](https://supabase.com). Choose the **Frankfurt (eu-central-1)** region, the closest to Georgia, and save the database password somewhere safe.
2. Push the schema from your computer:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   The project ref is the `xxxx` in `https://xxxx.supabase.co`. `db push` runs everything in `supabase/migrations/`: tables, security rules (RLS), the order workflow and the `menu-images` photo bucket. It does **not** run `seed.sql`, so no test logins reach production.
   > **Never** run `supabase db reset --linked` or `db push --include-seed` against the live project: both load `seed.sql` and its local-only test logins.
3. **Authentication → Sign In / Providers → Email:**
   - turn **off** "Allow new users to sign up" (staff are added from Admin → Staff);
   - keep "Email" enabled;
   - set the minimum password length to 10.

   This matters: `enable_signup = false` in `supabase/config.toml` only affects local Supabase. A new cloud project allows sign-ups until you turn them off. (Strangers who sign up see no data, but they fill up your user list and email quota.) You can also apply the file's auth settings with `npx supabase config push`.

4. **Authentication → URL Configuration:**
   - set **Site URL** to `https://your-domain`;
   - add `https://your-domain/admin/**` to the redirect URLs, plus your Netlify preview address if you use one.
5. **Project Settings → API Keys:** copy the **publishable** key and a **secret** key, for step 3.

### 2. First owner account

`create-owner` uses the Supabase address and secret key in `.env.local`. Copy `.env.local` to `.env.local.backup`, put the **cloud** URL and secret key in `.env.local`, run:

```bash
npm run create-owner -- owner@example.com "Owner Name"
```

then restore the backup, so local development keeps using the local database.

It prints a one-time password. Sign in at `/admin/login` and change it. Add kitchen staff from **Admin → Staff**. Dish photos for the live site are uploaded in **Admin → Menu** (`npm run seed:images` only fills the local database).

### 3. Netlify

1. Put the project on GitHub (a private repository is fine). Create an empty repository on github.com, then in the project folder:
   ```bash
   git init -b main
   git add .
   git status        # .env.local must NOT be listed
   git commit -m "First version"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   Every later `git push` to `main` redeploys the site.
2. On [netlify.com](https://netlify.com): **Add new site → Import an existing project**. Pick the repo. Build settings are read from `netlify.toml`, so leave them as they are.
3. **Site configuration → Environment variables:** add every variable from [Environment variables](#environment-variables):
   - add them **before the first deploy**: the build reads the menu from Supabase, so it fails without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and the database from step 1);
   - `NEXT_PUBLIC_SITE_URL` must be the final `https://` address. If it's missing, Netlify's own site address is used;
   - `IP_HASH_SALT` and `CRON_SECRET` need new random values of at least 16 characters (don't reuse the local ones). With shorter values, orders fail.
4. Deploy. A scheduled function (`netlify/functions/sheet-sync.mts`, free plan) runs every 5 minutes. It imports the Google Sheet, clears data the privacy policy says we delete (hashed IP addresses after 30 days), and keeps the database busy. That last part matters: **a free Supabase project pauses after 7 days without activity**, and the site stops taking orders. After the first deploy, check **Netlify → Logs → Functions → sheet-sync** shows runs every 5 minutes (it needs `CRON_SECRET`).
5. Security headers (CSP, HSTS and others) come from `netlify.toml`. If you change `security-headers.ts`, run `npm run netlify:toml` to regenerate it.

### 4. Custom domain

1. Netlify → **Domain management → Add a domain**, e.g. `biryanipoint.ge`.
2. At your domain registrar, either point the nameservers to Netlify (easiest) or add the records Netlify shows: an `A` record for the bare domain and a `CNAME` for `www`.
3. Netlify issues the HTTPS certificate automatically, usually within an hour.
4. Update `NEXT_PUBLIC_SITE_URL` and the Supabase **Site URL** (step 1.4) to the new domain, then redeploy.
5. Optional: once HTTPS has worked for a few weeks, submit the domain at [hstspreload.org](https://hstspreload.org). The header already allows preloading.

### 5. Telegram bot (new-order alerts)

1. In Telegram, message **@BotFather** → `/newbot` → follow the steps. Copy the **token**. This is `TELEGRAM_BOT_TOKEN`.
2. Create a group for the kitchen (e.g. "BP Orders"), add the bot, and send any message in the group.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find `"chat":{"id":-100…`. That number, with the minus sign, is `TELEGRAM_CHAT_ID`.
4. Add both variables in Netlify and redeploy. Every new order posts the items, the total, the address with a map link, and a link to the admin board.

### 5b. Kitchen printer

On the tablet or computer next to the receipt printer, open **Admin → Printers**. Turn on **Auto-printing on this device** and follow the setup steps on that page.

- Each ticket is printed as one page exactly the paper width and as long as the ticket, measured just before printing. `@page { size: 80mm auto }` is invalid CSS, and Chrome falls back to A4.
- In the printer driver's Printing preferences, choose the 80 mm or 58 mm roll, not A4. In the print dialog, choose the receipt printer and set margins to None.
- For printing with no dialog, start Chrome with `--kiosk-printing`.
- Fill in **Settings → Bill details** so the bill carries your business name and ID code.

### 6. Google Sheet (menu, prices, hours)

1. Upload `docs/sheet-template/biryani-point-menu.xlsx` to Google Drive and open it with Google Sheets (**File → Save as Google Sheets**). It has five tabs: **Menu**, **Categories**, **Options**, **Hours** and **Settings**.
2. For each tab: **File → Share → Publish to web**, choose the tab and **Comma-separated values (.csv)**, press **Publish**, and copy the link.
3. Paste the links into **Admin → Settings → Google Sheet** and press **Sync now**. The site then checks the sheet every 5 minutes.

Only the **Menu** tab is required. It needs at least `name` and `price` columns. These rules keep a typo from breaking the live site:

- A row with a mistake is skipped, and **that dish keeps its current version**. The sync log lists the row and the problem.
- Dishes are hidden, never deleted, and only when their row is removed from the sheet.
- Opening hours change only if **every** row of the Hours tab is valid.
- Prices are typed in lari (`20`, `22.50`, `22,5`) and stored as whole tetri, so there are no rounding errors.
- Anything set in the **Settings** tab (fees, minimums, phone…) shows as "managed by Sheet" in the admin panel. To edit it in the admin panel instead, delete the row from the tab.
- Photos are uploaded in Admin → Menu. A photo can also be matched by file name: `items/<dish-slug>.webp` in the `menu-images` bucket.

### 7. Optional extras

- **Email alerts:** create a free [Resend](https://resend.com) account and verify your domain. Then set `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (e.g. `orders@your-domain`) and `ORDER_EMAIL_TO`.
- **Error tracking:** create a Sentry project and set `NEXT_PUBLIC_SENTRY_DSN`. Errors are sent without the Sentry SDK, so the site stays light.
- **Analytics** (no cookies, no banner needed): set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, or `NEXT_PUBLIC_UMAMI_WEBSITE_ID` plus `NEXT_PUBLIC_UMAMI_SCRIPT_URL`.

### 8. Before you announce it

- [ ] Place a real test order on the live site from a phone (delivery and pickup), accept it on the Orders page, print it, mark it paid, complete it.
- [ ] The Telegram group received the order.
- [ ] **Admin → Settings → Business profile**: name, address, phone, WhatsApp, social links and texts are right in all three languages.
- [ ] Read **Privacy**, **Terms** and **Refund policy** on the site. They state 6 years for keeping order records and 24 hours for complaints: change them in `src/views/content/legal.ts` if your accountant or lawyer says otherwise.
- [ ] Opening hours, delivery zones, fees and minimum order are correct.
- [ ] Sign-ups are off in Supabase (step 1.3), and the only accounts under **Admin → Staff** are yours.
- [ ] Netlify function log shows `sheet-sync` running (step 3.4).
- [ ] Add the site to [Google Search Console](https://search.google.com/search-console) and submit `https://your-domain/sitemap.xml`. Create or claim the Google Business Profile and link the website.
- [ ] Test the share preview by pasting the address into WhatsApp or Telegram.

## Cloudflare (alternative host)

The code avoids Node-only APIs in pages and route handlers:

- the Supabase client, `fetch`, Web Crypto and the Edge-compatible `next/og` image generation all work there;
- the scheduled Sheet import is a plain authenticated `POST /api/cron/sheet-sync`, so any scheduler can call it.

To deploy on Cloudflare Workers with the OpenNext adapter:

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

- Add the same environment variables in the Worker settings.
- Add a Cron Trigger (`*/5 * * * *`) that calls `POST https://your-domain/api/cron/sheet-sync` with the header `Authorization: Bearer <CRON_SECRET>`.
- Copy the security headers from `netlify.toml` into a `public/_headers` file.

> **Not yet verified.** Netlify is the tested host. Do a test deploy on Cloudflare before relying on it.

## Environment variables

All of them are documented in [.env.example](.env.example).

| Variable                                               | Required    | Where it's used                                              |
| ------------------------------------------------------ | ----------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                                 | yes         | Canonical links, sitemap, social images, tracking links      |
| `NEXT_PUBLIC_SUPABASE_URL`                             | yes         | Database address                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                 | yes         | Browser key (protected by RLS)                               |
| `SUPABASE_SECRET_KEY`                                  | yes         | **Server only.** Creates orders, runs the Sheet import       |
| `IP_HASH_SALT`                                         | yes         | Hashes IPs for rate limiting (raw IPs are never stored)      |
| `CRON_SECRET`                                          | yes         | Protects the scheduled Sheet import                          |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`               | recommended | New-order alerts                                             |
| `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `ORDER_EMAIL_TO` | optional    | New-order email                                              |
| `SHEET_*_CSV_URL`                                      | optional    | Fallback if the Sheet links aren't set in admin              |
| `NEXT_PUBLIC_SENTRY_DSN`                               | optional    | Error tracking                                               |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` / `NEXT_PUBLIC_UMAMI_*` | optional    | Analytics                                                    |
| `PAYMENT_PROVIDER`                                     | not yet     | Online payments (see `src/model-helpers/payments/README.md`) |

## Commands

| Command                  | What it does                                                           |
| ------------------------ | ---------------------------------------------------------------------- |
| `npm run dev`            | Development server                                                     |
| `npm run build`          | Production build                                                       |
| `npm test`               | Unit tests (pricing, hours, slots, Sheet import, orders, reports…)     |
| `npm run test:e2e`       | Playwright: full order flow + accessibility scan (needs a build)       |
| `npm run lint`           | ESLint                                                                 |
| `npm run typecheck`      | TypeScript                                                             |
| `npm run format`         | Prettier                                                               |
| `npm run db:reset`       | Rebuild the local database from `supabase/migrations` + `seed.sql`     |
| `npm run db:types`       | Regenerate `src/models/db/database.types.ts` after changing the SQL    |
| `npm run seed:generate`  | Rebuild `supabase/seed.sql` from the Sheet template data               |
| `npm run seed:images`    | Upload the dish photos to Storage                                      |
| `npm run sheet:template` | Rebuild `docs/sheet-template/` (xlsx + CSVs)                           |
| `npm run sheet:sync`     | Import the Google Sheet now (`-- --force` to import even if unchanged) |
| `npm run create-owner`   | Create or promote an owner account                                     |
| `npm run netlify:toml`   | Regenerate `netlify.toml` headers from `security-headers.ts`           |

The E2E tests place a real order against the **local** database:

```bash
npm run build && npm run test:e2e
```

## Quality checks

**Automated**

- About 100 unit tests: money, pricing, hours across midnight, closures, slots, zones, phone, Sheet parsing, order validation, reports and translation parity.
- A Playwright order flow.
- An axe accessibility scan of the main pages, run on a phone-sized screen.

**Lighthouse (mobile, local production build, median of 3 runs):**

| Page     | Performance | Accessibility | Best practices | SEO |
| -------- | ----------- | ------------- | -------------- | --- |
| /en      | 85          | 100           | 100            | 100 |
| /en/menu | 89          | 100           | 100            | 100 |
| /ka      | 88          | 100           | 100            | 100 |
| /ru/menu | 89          | 100           | 100            | 100 |

- The measured LCP is about 0.5 s. Lighthouse's _simulated_ slow-4G LCP is 3.7 s on a local machine, because images are resized by the local server and nothing comes from a CDN.
- Re-run Lighthouse against the Netlify URL after deploy (PageSpeed Insights): cached images and the CDN usually lift Performance past 90.

**Manual accessibility checklist** (before launch, and after big design changes):

- [ ] The whole order can be placed with the keyboard only. Focus is always visible, and the dish sheet and cart drawer trap focus and close with Esc.
- [ ] Screen reader (TalkBack on Android, VoiceOver on iPhone):
  - dish names, prices and "sold out" are read out;
  - adding to cart is announced;
  - checkout errors are read and focus moves to the first one.
- [ ] Zoom to 200% and text-only zoom: nothing is cut off, and there is no sideways scrolling at 320 px.
- [ ] With "Reduce motion" on, the signature slideshow doesn't auto-play and no animations run.
- [ ] Georgian and Russian pages: long words wrap, and buttons don't overflow.
- [ ] The tracking page status changes are announced (live region).
- [ ] Colour is never the only signal: veg and spice have text or icons, and errors have text.

## Project structure

```
messages/               UI text in en / ka / ru
supabase/migrations/    Schema, security rules (RLS), order workflow, Sheet import, create_order
supabase/seed.sql       Generated local seed (menu + local-only logins)
docs/sheet-template/    Starting Google Sheet (.xlsx + one CSV per tab)
scripts/                Seed generator, image upload, Sheet sync, create-owner, netlify.toml writer
netlify/functions/      Scheduled Sheet import
e2e/                    Playwright tests
src/app/                Routes: customer pages per language, admin panel, API (VIEW entry points)
src/views/              Screens and UI pieces (VIEW)
src/controllers/        Login checks, input validation, server actions, API handlers (CONTROLLER)
src/model-helpers/      Business rules: order workflow, pricing, Sheet import, reports (MODEL HELPER)
src/models/             Every database query, and the connections (MODEL)
src/shared/             Pure tools used by all layers: money, hours, phone, cart, schemas
src/config/             Environment settings and languages
src/proxy.ts            Runs before each request; hands it to controllers/proxy.ts
```

**Design notes**

- **Money** is always integer tetri (1 GEL = 100 tetri). Only `parseGel` and `formatGel` convert.
- **Time** is always Asia/Tbilisi, whatever timezone the server or visitor is in (`src/shared/domain/hours.ts`).
- **Prices are never trusted from the browser.** `create_order` re-prices everything from the database, inside one transaction.
- **Customers can't read orders.** The tracking page uses `get_public_order`, which returns no phone or address. Status changes are broadcast on a per-order realtime channel.
- **next-intl plugin:** `next.config.ts` sets the `next-intl/config` alias directly instead of using the plugin. The plugin loads `@swc/core`, whose native module refuses to start on some Windows setups.

## Things to confirm before launch

- **Business profile:** the restaurant's name, address, texts, order-number prefix and time zone are data, not code (`restaurant_settings`, edited in Admin → Settings → Business profile). The starting values come from `supabase/migrations/20260929000009_business_profile.sql`. A unit test (`src/shared/config.test.ts`) fails if the name, street or phone gets hardcoded in `src/` or `messages/` again.

- **Map pin:** the restaurant location is taken from OpenStreetMap (41.641, 41.6151). Check it in Admin → Settings.
- **Delivery zone:** the starting zone is "Batumi, 5 km radius". Adjust it in Admin → Settings → Delivery zones.
- **Fees and minimums:** the delivery fee and minimum order are **0**. Set them in the Sheet (Settings tab) or in the admin panel.
- **Translations:** the Georgian and Russian text needs a native speaker's review. The admin panel is English only.
- **Legal pages:** privacy, terms and refunds are placeholders (`src/views/content/legal.ts`). Have them checked for Georgian law.
- **Spice level:** it is a per-dish option (Mild / Medium / Spicy, default Medium). Staff accounts can mark dishes sold out.
