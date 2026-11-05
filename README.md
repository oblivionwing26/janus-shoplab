# Janus ShopLab

> **Intentionally flawed demo shop. Never deploy it on a public network.**
> It exists only as the target app for [Janus Arena](https://github.com/oblivionwing26/janus-arena):
> it has seeded UX friction and, from F0.7-C on, seeded security vulnerabilities, each documented
> so that Janus findings can be checked against known ground truth.

- Next.js + Postgres shop: sign-up, login, catalog, cart, coupon, simulated checkout, order history, reviews.
- All data is synthetic. Test users carry unique canary values so data leaks are unambiguous.
- Docker Compose binds every port to `127.0.0.1` only.

Status: early development (Janus roadmap step F0.7).
