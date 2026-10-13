# Online payments (not active yet)

The site launches with **cash on delivery** and **pay at pickup**. Every order has a
`payment_status` (`unpaid`, `pending`, `paid`, `failed`, `refunded`) that staff can set to
**Paid** from the kitchen board when the cash is collected.

To add a Georgian card gateway later (Bank of Georgia iPay, TBC Pay, or another):

1. Create `src/model-helpers/payments/providers/<id>.ts` that implements `PaymentProvider` from `types.ts`:
   - `createPayment` calls the bank's API and returns the page to send the customer to.
   - `parseWebhook` verifies the bank's signature and returns the payment status.
2. Register it in `registry.ts` and set `PAYMENT_PROVIDER=<id>` plus the bank's keys
   (add them to `.env.example` and `src/config/env.server.ts`).
3. The checkout page then shows "Pay online by card". After the order is created, the
   server calls `createPayment`, stores a row in `payments`, and redirects the customer.
4. The bank calls `POST /api/payments/<id>/webhook`. That route (already in place) stores
   each event once in `payment_webhook_events` and updates `payments` and
   `orders.payment_status`. A retried webhook is ignored.

Always test with the bank's test/sandbox keys first.
