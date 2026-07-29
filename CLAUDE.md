# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KK-Image (kk-life) is a full-stack Cloudflare-native management system for products, sales, orders, and reservations, powered by Pages, D1, R2, and KV. It also includes a WeChat miniprogram sub-app (`minisales/`).

**Language**: Use Chinese (中文) for all communication and code comments。

## 行为准则

### 先思考再编码
- 不确定时先问，不要假设
- 存在多种方案时，列出选项让开发者选择
- 发现更简单的方案时主动提出

### 简洁优先
- 只写被要求的功能，不做多余抽象
- 单次使用的代码不需要抽象层
- 自检：资深工程师会觉得过度复杂吗？是就简化

### 精准修改
- 只改必须改的，不顺手重构相邻代码
- 保持现有代码风格，即使你偏好不同写法
- 只清理自己引入的死代码，已有的提一下但不删

### 目标驱动
- 多步骤任务先列计划，每步带验证方式
- "添加验证" → "先写测试，再让测试通过"
- "修复 bug" → "先写复现测试，再修复"

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
- **Framework**: Vue 3 with `<script setup>` syntax + Vite (SPA, single entry `src/main.ts`)
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

### 其他顶层目录

- `migrations/` — D1 SQL 迁移文件 (0001_\*.sql, 0002_\*.sql, ...)
- `minisales/` — 微信小程序子应用 (TypeScript)
- `scripts/` — QA、部署和工具脚本
- `policy/` — OPA 授权策略 (.rego)

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

## 常见陷阱 (Gotchas)

- **Domain Outbox loopback 限制**: 本地开发时 `waitUntil` 回调会在 worker 重启时被杀掉，导致 outbox 事件丢失。测试时用 `processOutbox()` 手动触发
- **Hono 迁移中**: `functions/api/` 是旧路由，新功能必须放 `functions/lib/hono/routes/`
- **Tailwind v4**: 使用 `@tailwindcss/vite` 插件，不是 PostCSS 方式。不要写 raw CSS
- **D1 batch 操作**: 多条 SQL 必须用 `env.DB.batch()`，不要逐条执行
- **测试环境**: real-api 测试需要先启动 wrangler dev server（loopback 模式），或用 `REAL_API_TRANSPORT=direct`（CI/CD）
- **outbox 清理**: real-api 测试后需手动清理 outbox：`curl -X POST "http://127.0.0.1:8080/api/cron/outbox?maxRounds=8&force=true" -H "Authorization: Bearer dev-secret"`

## 测试策略

| 测试类型 | 命令 | 何时使用 |
|----------|------|----------|
| 单元测试 | `pnpm test:unit:run` | 改了工具函数、composables、repositories |
| 集成测试 | `pnpm test` | 改了 API 路由、服务层 |
| Real API 测试 | `pnpm test:real-api` | 改了完整业务流程、需要验证端到端 |
| OPA 策略测试 | `pnpm authz:policy:test` | 改了授权策略 |
| QA 冒烟测试 | `pnpm qa:admin-flows` | 改了管理端业务流程 |

- 改了后端代码 → 至少跑 `pnpm test:unit:run`
- 改了前端代码 → 至少跑 `pnpm lint`
- 改了数据库相关 → 跑 `pnpm test` (包含 integration)
- 部署前 → `pnpm deploy:check`

## Environment Variables

Sensitive credentials must be set via Cloudflare Dashboard or `.dev.vars` file:
- `BASIC_USER`, `BASIC_PASS` — Admin login
- `JWT_SECRET` — JWT signing key
- `CRON_SECRET` — Cron job authentication
- `TG_Bot_Token`, `TG_Chat_ID` — Telegram storage (optional)
- `S3_*` — S3-compatible storage credentials
- `ModerateContentApiKey` — Image moderation API
- `SENTRY_DSN` — Sentry error monitoring (optional)
