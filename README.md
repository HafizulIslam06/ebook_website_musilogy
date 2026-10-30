# Musilogy

Single-product eBook store: React storefront and admin panel, Express API, MySQL, UddoktaPay hosted checkout.

## Setup

Requires Node 20+ and MySQL 8.

```bash
npm install
cp server/.env.example server/.env   # then fill in DB details and JWT_SECRET
npm run migrate                      # creates the database, tables and starter product
npm run create-admin                 # prompts for email and password
npm run dev                          # site on http://localhost:5173, API on :4000
```

The MySQL user needs permission to create the database, or create it first and
grant access to it. The admin panel is at `/admin`. Run `npm run migrate` again
after updating an existing install, since it also upgrades older tables.

`npm test` runs the payment tests against the database in `server/.env`. UddoktaPay
is stubbed, and the tests only touch rows whose order number starts with `TEST`.

## Production

```bash
npm install && npm run build
NODE_ENV=production npm start
```

Express serves both the API and the built client, so one process is enough.

Before going live:

- Set `PUBLIC_URL` to your public `https://` address. UddoktaPay sends customers
  and webhooks there, so it must be reachable from the internet.
- Set `UDDOKTAPAY_BASE_URL` and `UDDOKTAPAY_API_KEY` to your own installation's
  values. The server refuses to start in production with the public sandbox key.
- Set `TRUST_PROXY=1` behind Nginx or a load balancer, so rate limits see real
  client IPs and secure cookies work.
- Back up `server/uploads` (covers) and `server/storage` (private PDFs) with the
  database. Neither folder is in git.
- In the admin panel, replace the starter content, prices and cover, then add the
  PDF and all video links.
- In **Settings**, add your WhatsApp number, support email and the privacy, terms
  and refund text. The footer hides Support until a contact detail is set.

## Payment flow

1. `POST /api/orders` validates the customer, takes the price from the database,
   creates a pending order and calls `POST {base}/api/checkout-v2`.
2. The browser is sent to UddoktaPay's `payment_url`.
3. UddoktaPay returns the customer to `/api/payments/return/:token?invoice_id=…`,
   or to `/api/payments/cancel/:token`. It may also call `/api/payments/webhook`,
   which is authenticated by the `RT-UDDOKTAPAY-API-KEY` header.
4. All paths lead to `reconcilePayment` in `server/src/services/payments.js`, which
   calls `POST {base}/api/verify-payment` and only trusts that answer.

An order becomes paid only if verify returns `COMPLETED`, the verified metadata
names that order, and the amount covers the order total. The order row is locked
during the update and `payments.invoice_id` is unique, so repeated or simultaneous
callbacks cannot apply a payment twice. Network or auth errors from the gateway
change nothing, and an unpaid order page re-verifies at most every 15 seconds.

| Verified result | Order status |
| --- | --- |
| `COMPLETED`, order and amount match | `paid` (final) |
| `PENDING` | `pending` |
| `ERROR`, or underpaid | `failed` (a later verified payment still counts) |
| Cancel redirect, while pending | `cancelled` (a later verified payment still counts) |

## Digital access

Each order gets a random 256-bit access link, of which only a SHA-256 hash is
stored. The API returns video links and allows the PDF download only when that
order is paid. Uploaded PDFs live in `server/storage`, which is never served
statically, and PDF links are streamed through the server so the source stays
hidden. If a buyer loses their link, use **New access link** on the order page,
which then offers WhatsApp and Gmail buttons to send it.

The site sends no messages itself. The paid order page has the same two buttons,
so buyers can send their own link to themselves.

The checkout page shows the methods enabled in your UddoktaPay dashboard, so turn
on bKash, Rocket and Nagad there.

Video links are shown to paying customers, so a buyer could pass them on. Use a
host with domain-restricted or private playback if that matters to you.

## API

| Method and path | Purpose |
| --- | --- |
| `GET /api/product` | Public product data |
| `POST /api/orders` | Create an order and start checkout |
| `GET /api/settings` | Footer details and contact and policy page text |
| `GET /api/orders/:token` | Order status, plus access once paid |
| `GET /api/orders/:token/download` | Download the PDF (paid only) |
| `GET /api/payments/return/:token` | Customer return from UddoktaPay |
| `GET /api/payments/cancel/:token` | Customer cancel from UddoktaPay |
| `POST /api/payments/webhook` | UddoktaPay webhook |
| `POST /api/admin/login`, `/logout` | Admin session (httpOnly cookie, 8 hours) |
| `GET /api/admin/me`, `/stats` | Session check, dashboard numbers |
| `GET`, `PUT /api/admin/product` | Read and update the product |
| `POST /api/admin/product/cover` | Upload the cover |
| `POST`, `DELETE /api/admin/product/pdf` | Upload or remove the private PDF |
| `GET`, `PUT /api/admin/settings` | Read and update footer details and page text |
| `GET /api/admin/orders` | List with `search`, `status`, `page` |
| `GET /api/admin/orders/:id` | Order with payment transactions |
| `DELETE /api/admin/orders/:id` | Permanently delete an order and its payment records |
| `PATCH /api/admin/orders/:id/status` | Set an order's status by hand (`paid` grants access, anything else removes it) |
| `POST /api/admin/orders/:id/access-link` | Replace a paid order's access link |
