# Biryani Point website: owner's guide

This guide is for running the restaurant's website day to day. No technical knowledge needed.

- **Your website:** `https://your-domain` (customers)
- **Your kitchen screen:** `https://your-domain/admin` (you and your staff)
- **Your menu:** the Google Sheet called _Biryani Point menu_

---

## 1. Every day: taking orders

1. Open **your-domain/admin** on the kitchen tablet or phone and sign in. Keep this page open during service.
2. Tap **Turn on sound & alerts** once each time you open the page. The browser needs one tap before it is allowed to play the "new order" chime.
3. When an order arrives you hear a chime, the tab title flashes, and (if set up) the order is posted in your Telegram group.
4. For each new order:
   - **Accept:** choose how many minutes it will take (e.g. 20). The customer's tracking page updates straight away with the time.
   - **Reject:** pick a reason (e.g. "too busy", "outside delivery area"). The customer sees it at once. Please call them if they already paid or it's a big order.
5. Move the order along as you cook:
   - **Preparing**, then **Ready**;
   - for delivery, **Out for delivery**, then **Completed**;
   - for pickup, **Completed** when it is collected.

   The customer sees every step live on their phone.

6. The order card shows the phone number with **Call** and **WhatsApp** buttons, the address with a map link, and the customer's notes.

Customers can also send their order to you on WhatsApp from the confirmation page. It is the same order with the same number (e.g. **BP-1024**), so don't make it twice.

**Order numbers** start at BP-1001 and go up by one. The number is on the board, in Telegram, in WhatsApp and on the customer's screen.

### Table orders and takeaway at the counter

The **Orders** page also works as the till. It shows only open orders (finished ones are under **History**), in three tabs: **Dine in**, **Takeaway** and **Online orders**. Each order is a tile; tap it to open it. The colour shows its state: **red** = new online order to accept, **gold** = in the kitchen, **green** = ready or served, dashed = free table. A **PAID** tag means it's already paid.

- **Guests sit down:** on the **Dine in** tab, tap their free table, tap the dishes (dishes with options ask for them), then **Send to kitchen**. The KOT prints straight away.
- **They order more:** tap the table → **+ Add dishes**. Only the new dishes print, on a KOT marked **ADD-ON · ROUND 2** (then 3, 4…).
- **Food is out:** tap **Served**.
- **They want to pay:** tap the table → **Bill & pay** → **Print the bill** → **Paid cash** or **Paid card**. The table is free again.
- **Takeaway at the counter:** on the **Takeaway** tab, tap **+ New takeaway**, add the dishes, type a name if you like, choose **Paid cash**, **Paid card** or **Pay later**, and send. It then works like a pickup order: **Ready for pickup** prints the bill, **Picked up** closes it. If it was **Pay later**, tap **Take payment** first.

**Payment rules.** An online order can be marked paid (or unpaid again, if you tapped it by mistake) only after you accept it and before it is finished. **Picked up** and **Delivered** stay greyed out until the order is paid. Once an order is finished, its payment can no longer be changed.

Add, rename, pause or remove tables on the **Tables** page (owner only). A table with an open order can't be removed until the order is paid.

### Printing the KOT and the bill

- **KOT** (kitchen order ticket) prints by itself when you **accept** an order. It has no prices and big print, for the chef.
- **Bill** prints by itself when the order is **Ready for pickup** or **Out for delivery**. Put it in the bag.
- Need another copy? Tap **Print KOT** or **Print bill** on the order. Extra copies are marked **REPRINT** / **COPY**, so nobody cooks an order twice.
- Only the device switched to **Auto-printing on this device** (Admin → **Printers**) prints automatically. Keep the Orders page open on it. "Printing here" at the top of the board shows it's on.
- Tickets come out on A4, or tiny on a big page? The browser is sending them to the wrong printer or paper. Choose the receipt printer in the print dialog, and set its paper to the 80 mm (or 58 mm) roll in Windows' **Printing preferences**. The steps are on the **Printers** page.
- Paper size, languages, number of copies and what shows on the bill are all on the **Printers** page. Your business name, ID code and VAT go under **Settings → Bill details**.

## 2. Out of something? Mark it sold out

**Admin → Menu** → find the dish → **Sold out**:

- **Sold out today:** it comes back by itself tomorrow.
- **Until I turn it on:** it stays off until you tap **Back on the menu**.

Customers see "Sold out" immediately and can't add it to their cart. Staff accounts can do this too.

## 3. Too busy, or closing early? Pause orders

**Admin → Settings → Ordering → Pause orders**. Write a short message if you like, e.g. "Back at 7 pm, sorry!". The website stays visible, but checkout is switched off until you un-pause.

For a whole day off (holiday, repairs), add it under **Settings → Hours → Closures**. The website then says you're closed that day and won't offer time slots for it.

## 4. Changing the menu, prices and hours (Google Sheet)

Everything customers see on the menu comes from your Google Sheet. Change the sheet, and the website follows within about **5 minutes**. For the change to show right away, open **Admin → Menu → Sync now**.

| Tab            | What it holds                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **Menu**       | One row per dish: name (English, Georgian, Russian), price, description, category, veg, spice, popular |
| **Categories** | The menu sections and their order                                                                      |
| **Options**    | Choices like spice level or extras, and their extra price                                              |
| **Hours**      | Opening and closing time for each day                                                                  |
| **Settings**   | Delivery fee, minimum order, phone, WhatsApp number…                                                   |

Good to know:

- **Prices** are typed in lari: `20`, `22.50` or `22,5` are all fine.
- **To remove a dish**, delete its row or set `show` to `no`. Nothing is ever deleted from past orders.
- **If you make a typo** (e.g. a price like `twenty`), that one dish keeps its old version and the rest still updates. **Admin → Menu** shows what was wrong, so you can fix it in the sheet.
- **Hours** change only when every row in the Hours tab is correct, so the website never shows half-changed hours.
- **Closing after midnight** is fine: open `12:00`, close `01:00`.
- **Georgian or Russian text left empty?** The English text is shown instead.
- **Photos:** upload them in **Admin → Menu** (tap the dish photo). Square photos look best.

Anything filled in on the **Settings** tab is controlled by the sheet. In the admin panel it shows as "managed by Sheet". To control it from the admin panel instead, delete that row from the Settings tab.

## 5. Delivery area, fees and time slots

**Admin → Settings:**

- **Delivery zones:** the area you deliver to. You can set a different fee or minimum per zone. Customers outside all zones are offered pickup instead.
- **Delivery fee / minimum order:** leave at 0 for free delivery and no minimum.
- **Prep time:** the default minutes shown to customers before you accept.
- **Scheduled orders:** how far ahead customers can book, and the slot length (e.g. every 15 minutes).
- **Last orders:** how many minutes before closing checkout stops.
- **Contact:** phone, WhatsApp and map pin. **Please check the map pin is exactly on your door.**

### Your name, address and website texts

**Admin → Settings → Business profile** holds everything the website says about the restaurant. Nothing is written into the code, so a change shows on the site within a minute, with no developer needed.

- **Name and logo:** short name, full name, the letters in the round logo, and the order-number prefix (e.g. **BP**-1042).
- **Tagline** and **what you serve**.
- **Address and contact:** street and city, postcode, country, time zone, email, and Instagram, Facebook and TikTok links. Social links show in the footer only when filled in.
- **Home page:** headline, intro, "Our story", the words in the gold band, and the four "why us" cards.
- **Google:** the page title and descriptions search engines show.

It also feeds the bill, the WhatsApp and Telegram order messages, the legal pages and the app icon. Fill in English first; empty Georgian or Russian fields fall back to English.

## 6. Reports

**Admin → Reports** shows orders and takings by day, your best-selling dishes, and delivery vs pickup. **Download CSV** opens in Excel or Google Sheets for your accountant.

Rejected and cancelled orders are not counted in the totals.

## 7. Staff accounts

**Admin → Staff** (owner only):

- **Add staff:** enter their email. They get a login for the kitchen board and the sold-out buttons. They can't see reports, settings or staff.
- **Owner** accounts can do everything. Keep at least two owners (e.g. you and a manager) so you're never locked out.
- **Someone leaves?** Remove them here. Their login stops working immediately.

Use a password of at least 10 characters. Don't share one login between people: with separate logins you can see who accepted each order.

## 8. Payments

Right now customers pay **cash on delivery** or **at pickup**. There are no card payments, so there's nothing to refund online. Card payments (e.g. Bank of Georgia or TBC) can be added later by a developer without changing how orders work for you.

## 9. If something goes wrong

| Problem                                | What to do                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| No sound on new orders                 | Tap **Turn on sound & alerts** on the board, and check the tablet isn't on silent        |
| Board looks stuck                      | Refresh the page. It reconnects by itself, but a refresh is quickest                     |
| Menu change not showing                | **Admin → Menu → Sync now**, then read the sync log for mistakes                         |
| Customer says "closed" but you're open | Check **Hours** in the sheet, **Closures**, and that orders aren't paused                |
| Customer can't get delivery            | Their pin is outside your delivery zones. Offer pickup or enlarge the zone               |
| Forgot password                        | Ask another owner to remove and re-add you, or ask your developer                        |
| Tickets don't print                    | Check "Printing here" on the board, then press **Print a test KOT** on the Printers page |
| Website down                           | Tell customers to order by WhatsApp or phone, and contact your developer                 |

## 10. Before you go live (one-time checklist)

- [ ] Map pin, phone and WhatsApp number are correct
- [ ] Business profile (name, address, texts) checked in all three languages
- [ ] Opening hours and delivery zone are right
- [ ] Delivery fee and minimum order are set (or deliberately 0)
- [ ] A native speaker has read the Georgian and Russian text
- [ ] Privacy, terms and refund pages have been checked (they are drafts)
- [ ] You placed a test order from your phone, accepted it on the board, and saw it in Telegram
- [ ] Bill details (business name, ID code, VAT) filled in, and a test KOT and bill printed
- [ ] A second owner account exists
