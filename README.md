# Janus ShopLab

> **Demo shop with intentional UX flaws. Keep it on localhost.**
> It exists only as the UX target app for [Janus Arena](https://github.com/oblivionwing26/janus-arena):
> its seeded UX friction is documented in [`UX_FLAWS.md`](UX_FLAWS.md) so that Janus findings can be
> checked against known ground truth. Janus's security benchmark uses OWASP Juice Shop instead
> (Janus ADR 0006).

- Next.js + Postgres shop: sign-up, login, catalog, cart, coupon, simulated checkout, order history, reviews.
- All data is synthetic. Test users carry unique canary values so data leaks are unambiguous.
- Docker Compose binds every port to `127.0.0.1` only.

ShopLab's own tests (`pnpm test`, `pnpm test:integration`) cover the legitimate behaviour of every
service and API route. Any later fix to ShopLab must keep them green.

## Run it

```bash
docker compose up -d --build --wait
```

Open <http://127.0.0.1:3100>. The `migrate` service applies migrations and seeds the database the
first time (12 products, 3 coupons, 3 test users with orders). Start from scratch with
`docker compose down -v`.

Test users and their passwords are listed in [`prisma/seed.ts`](prisma/seed.ts). Coupons:
`BIENVENIDA10`, `VERANO20` (active) and `CADUCADO15` (inactive). Payment is simulated: no card or
bank data is ever requested.

## Defenses (off by default)

ShopLab can protect itself, so Janus can measure what a defense costs the people it is meant to
protect. They are legitimate protections, not flaws, and every one is off unless its variable is
set: with none set, ShopLab behaves exactly as before.

| Variable                                   | What it does                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SHOPLAB_RATE_LIMIT_IP=<n>/<seconds>`      | At most `n` requests per client in the window, on every API route; past that, `429` with `Retry-After`.                                                                                                            |
| `SHOPLAB_RATE_LIMIT_ACCOUNT=<n>/<seconds>` | At most `n` sign-in attempts per account (email) in the window; past that, `429`, even with the right password.                                                                                                    |
| `SHOPLAB_STEP_UP_CHECKOUT=new-accounts     | all`                                                                                                                                                                                                               | Checkout asks for a four-digit code shown on the page. The API answers `403` without it. `new-accounts` asks only accounts younger than `SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS` (default 86400). |
| `SHOPLAB_TRUST_FORWARDED_FOR=1`            | Takes the client from `X-Forwarded-For`. Without it every request counts as one client, because ShopLab has no honest way to tell them apart. The Janus sandbox sets it to give each simulated visitor an address. |

Every request counts, the refused ones too, so a client that keeps hammering stays blocked until it
stops for a window. The counters live in the process's memory.

## Develop

```bash
pnpm install
cp .env.example .env
docker compose up -d --wait postgres
pnpm db:migrate && pnpm db:seed
pnpm dev                 # http://127.0.0.1:3100
pnpm lint && pnpm typecheck && pnpm test
pnpm test:integration    # needs the postgres service; uses the shoplab_test database
```
