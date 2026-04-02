# kk-life

kk-life is a Cloudflare-native business management platform built on Pages / Functions, D1, and R2. It combines file management, shared spaces, sales ordering, order collaboration, product and procurement workflows, inventory projection, and audit / outbox operations.

English | [中文](README.md)

## Core Capabilities

- File management and shared spaces
- Admin web console for orders, customers, products, procurement, stats, and settings
- Sales portals at `/sales/:token` plus the `minisales/` WeChat mini program
- Line-level order fulfillment and procurement projection with `orders + order_lines`
- Durable outbox, webhooks, audit logs, and replay operations
- R2 as the default storage backend, with optional Telegram and S3-compatible providers

## Stack

- Frontend: Vue 3 + Vite + Tailwind CSS v4
- Backend: Cloudflare Pages Functions + Hono
- Database: Cloudflare D1
- Object storage: Cloudflare R2
- Auth: Basic Auth, JWT, sales access tokens, and API keys

## Main Entry Points

- `/` redirects to `/login`
- Admin UI: `/admin`
- Sales portal: `/sales/:token`
- Public shared spaces: `/space/:token`
- Public galleries: `/gallery/:token`

## Local Development

```bash
corepack enable
pnpm install
pnpm dev:all
```

Common commands:

```bash
pnpm test:unit
pnpm test:real-api:full-chain
pnpm build
```

`pnpm dev:all` applies local D1 migrations first, then starts Vite and the local Pages worker.

## Deployment Summary

Minimum required bindings and vars:

- D1 binding: `DB`
- R2 binding: `R2_BUCKET`
- Environment variables: `BASIC_USER`, `BASIC_PASS`, `JWT_SECRET`

Common commands:

```bash
pnpm build
pnpm db:migrate:prod:raw
pnpm deploy:prod
```

See [docs/deployment/README.md](docs/deployment/README.md) for the full guide.

## Documentation

- [Documentation Center](docs/README.md)
- [Quick Start](docs/quick-start/README.md)
- [Deployment Guide](docs/deployment/README.md)
- [API Docs](docs/api/README.md)
- [Developer Guide](docs/developer-guide/README.md)
- [User Manual](docs/user-manual/README.md)
- [Admin Manual](docs/admin-manual/README.md)
- [Architecture Docs](docs/architecture/README.md)

## Notes

- This repository is no longer documented as a public anonymous image-hosting homepage product. The primary entry flow starts at `/login`.
- Telegram storage is optional, not a mandatory deployment dependency.
- Historical plan / review / archive documents under `docs/plans`, `docs/archive`, `docs/reviews`, and `docs/superpowers` are kept as historical records, not as current product entry docs.
