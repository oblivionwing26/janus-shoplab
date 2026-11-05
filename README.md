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
