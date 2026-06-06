# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KK-Image (kk-life) is a full-stack Cloudflare-native management system for products, sales, orders, and reservations, powered by Pages, D1, R2, and KV. It also includes a WeChat miniprogram sub-app (`minisales/`).

**Language**: Use Chinese (中文) for all communication and code comments.

## Commands

```bash
# Development
pnpm dev              # Start Vite dev server (frontend only)
pnpm dev:all          # Run frontend + backend concurrently (recommended)
pnpm start            # Run full stack locally with wrangler (after build)
pnpm dev:full         # Build + start full stack

# Build
pnpm build            # Build frontend with Vite

# Testing
pnpm test             # Run unit tests + Mocha integration tests
pnpm test:unit        # Run Vitest unit tests (watch mode)
pnpm test:unit:run    # Run Vitest unit tests (single run)
pnpm test:coverage    # Run unit tests with coverage
pnpm test:ui          # Run Vitest with UI
pnpm test:real-api    # Run real API tests (fast profile, loopback mode)
pnpm test:real-api:coverage  # Run coverage profile (includes notifications/webhooks)
pnpm test:minisales   # Run minisales sub-app tests

# Test Environment Notes
# - Real-api tests run against local wrangler dev server (loopback mode)
# - Complex workflow tests (6+ write ops) are skipped in loopback mode due to cascade restarts
# - Use `REAL_API_TRANSPORT=direct` for CI/CD (requires no parallel wrangler instance)
# - `processOutbox()` helper triggers outbox poller for event-driven tests

# Linting & Formatting
pnpm lint             # ESLint check for src/, functions/, scripts/, test/
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format

# QA Checks
pnpm qa:check-design-system        # Check UI token integrity + foundation usage
pnpm qa:check-audit-route-coverage # Check audit route coverage
pnpm qa:admin-flows                # Admin business flow smoke test

# OPA Policy
pnpm authz:policy:test   # Test OPA authorization policies
pnpm authz:policy:build  # Compile OPA policies to WASM

# Database Migrations
pnpm db:migrate:local    # Apply migrations to local D1
pnpm db:migrate:preview  # Apply migrations to preview D1
pnpm db:migrate:prod     # Apply migrations to production D1

# Deployment
pnpm deploy           # Build and deploy to Cloudflare Pages
pnpm deploy:preview   # Deploy to preview branch
pnpm deploy:prod      # Deploy to production (main branch)
pnpm deploy:check     # Pre-deploy checks
pnpm deploy:verify    # Post-deploy verification

# Cleanup
# After running real-api tests, clean up outbox events:
# curl -X POST "http://127.0.0.1:8080/api/cron/outbox?maxRounds=8&force=true" \
#   -H "Authorization: Bearer dev-secret"
```

## Architecture

### Frontend (`src/`)
- **Framework**: Vue 3 with `<script setup>` syntax + Vite (SPA, single entry `src/main.js`)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin) — no raw CSS
- **State**: Vue Composition API + Composables in `src/composables/`
- **Routing**: Vue Router with views in `src/views/`
- **Design System**: `src/design-system/` — patterns, composed components, tone contract
- **Locales**: `src/locales/` — i18n translations (en, zh-CN)

### Backend (`functions/`)
- **Runtime**: Cloudflare Workers (Pages Functions) with Node.js compat
- **API Framework**: Hono (`functions/lib/hono/`) — primary API layer
- **Legacy Routes**: File-based routing in `functions/api/` (being migrated to Hono)
- **Middleware**: `functions/lib/hono/middleware/` — auth, OPA authorization, etc.
- **Repositories**: Data access layer in `functions/repositories/`
- **Services**: Business logic in `functions/services/`
- **Domain Outbox**: Event-driven architecture with consumers in `functions/services/consumers/`

### API Structure (Hono)
```
functions/lib/hono/routes/
├── manage/          # Admin management APIs
│   ├── orders/      # Order CRUD + workflow
│   ├── products/    # Product management
│   ├── spaces/      # Space/subspace management
│   ├── files.js     # File management
│   ├── customers.js # Customer management
│   ├── dashboard.js # Dashboard data
│   └── ...
├── sales/           # Salesperson APIs
│   ├── orders.js
│   ├── products.js
│   ├── files.js
│   └── ...
└── v1/              # Public/versioned APIs
    ├── files.js
    ├── folders.js
    ├── webhooks.js
    └── ...
```

### Storage Architecture
- **D1**: SQLite database for structured data (files, orders, customers, spaces, products)
- **R2**: Primary object storage for files (`R2_BUCKET`, `R2_BACKUP_BUCKET`)
- **KV**: Image URL metadata cache (`img_url` binding)
- **Multi-storage**: Supports R2, Telegram, and S3-compatible backends with fallback chain

### Key Directories
```
src/
├── components/     # Reusable Vue components
├── composables/    # Composition functions (useToast, useApi, etc.)
├── config/         # App configuration
├── constants/      # Shared constants
├── design-system/  # UI patterns, tone contract, composed components
├── layouts/        # Layout components
├── locales/        # i18n translations
├── router/         # Vue Router configuration
├── styles/         # Global styles / Tailwind config
├── utils/          # Frontend utilities
└── views/          # Page-level Vue components

functions/
├── api/            # Legacy file-based API routes (migrating to Hono)
├── lib/hono/       # Hono API framework
│   ├── routes/     # Route handlers (manage/, sales/, v1/)
│   ├── middleware/  # Auth, OPA, validation middleware
│   ├── schemas/    # Zod validation schemas
│   └── _shared/    # Shared Hono utilities
├── repositories/   # D1 data access layer (Repository pattern)
├── services/       # Business logic services
│   ├── consumers/  # Domain Outbox consumers (audit, cache, notification, webhook)
│   ├── AIService.js           # AI service (refactored into orchestrator/preparer)
│   ├── OrderCreationService.js # Order creation/update logic
│   └── ...
├── storage/        # Multi-storage provider abstraction
├── lib/            # Shared libraries (auth, crypto, OPA)
└── utils/          # Backend utilities

migrations/         # D1 SQL migration files (0001_*.sql, 0002_*.sql, ...)
minisales/          # WeChat miniprogram sub-app (TypeScript)
scripts/            # QA, deploy, and utility scripts
policy/             # OPA authorization policies (.rego)
```

## Code Conventions

### Database (D1)
- **Repository Pattern**: Each entity has its own Repository class in `functions/repositories/`
- **DI Pattern**: Repositories use `constructor(db, deps = {})` for dependency injection
- **Batch operations**: Always use `env.DB.batch()` for multiple inserts/updates
- **Parameterized queries**: Use `prepare().bind().run()/all()/first()` — never concatenate SQL strings
- Migrations are in `migrations/` directory, numbered sequentially

### API (Hono)
- Route handlers in `functions/lib/hono/routes/`
- Input validation with Zod schemas in `functions/lib/hono/schemas/`
- OPA-based authorization via `functions/lib/hono/middleware/`
- Use `functions/api/utils/response.js` helpers for consistent JSON responses

### Domain Outbox Pattern
- Events published to `domain_outbox` table via `DomainOutboxPublisher`
- Consumers process events: audit, cache, notification, webhook
- Poller triggered via `c.executionCtx.waitUntil(runOutboxPoller(...))` or `/api/cron/outbox`
- **Loopback limitation**: In local dev, `waitUntil` callbacks are killed on worker restart

### Frontend Patterns
- Toast notifications via `useToast` composable (`addToast`)
- Reuse existing utilities in `src/utils/` before creating new ones
- SVG icons (Heroicons style) — avoid icon library imports
- Follow design system patterns in `src/design-system/`

### Security
- Never hardcode secrets — use environment variables (`env.KEY` or `context.env`)
- JWT for admin authentication, Upload Tokens for API auth
- OPA policies for fine-grained authorization (`policy/authz.rego`)
- Sentry for error monitoring (`@sentry/cloudflare`)
- Backend APIs must validate permissions via middleware context

## Environment Variables

Sensitive credentials must be set via Cloudflare Dashboard or `.dev.vars` file:
- `BASIC_USER`, `BASIC_PASS` — Admin login
- `JWT_SECRET` — JWT signing key
- `CRON_SECRET` — Cron job authentication
- `TG_Bot_Token`, `TG_Chat_ID` — Telegram storage (optional)
- `S3_*` — S3-compatible storage credentials
- `ModerateContentApiKey` — Image moderation API
- `SENTRY_DSN` — Sentry error monitoring (optional)
