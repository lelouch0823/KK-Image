# AGENTS.md

## Purpose

This file is the repository-level agent guide for the main `kk-life / KK-Image` project.

Use this file as the first-stop execution guide before changing code. It is intentionally short and operational. Detailed specifications stay in `docs/`.

## Scope

Default scope for this repository guide:

- `src/`
- `functions/`
- `scripts/`
- `docs/`
- `migrations/`
- `shared/`
- root config files such as `package.json`, `vite.config.js`, `wrangler.toml`, `eslint.config.js`, `prettier.config.js`

Default out of scope unless the user explicitly names it:

- `minisales/`

`minisales/` is treated as a separate project / workflow. Do not include it in main-project audits, cleanup, design-system remediation, or routine feature work unless the user explicitly asks for minisales changes.

## Critical Rules

### 1. Work On The Current Product, Not Historical Narratives

- The current product is a Cloudflare-native business management system, not a legacy public image-bed landing page.
- Current primary entry points are `/login`, `/admin`, `/sales/:token`, `/space/:token`, and `/gallery/:token`.
- Do not let old plan docs or archived materials override the current product description.

### 2. Frontend Must Respect The Design-System Dependency Order

Frontend source of truth order:

1. `src/styles/tokens/*`
2. `src/components/ui/*`
3. `src/design-system/composed/*`
4. `src/design-system/patterns/*`
5. domain views and domain components

Required behavior:

- Reuse existing tokens, foundation components, composed blocks, and page shells before creating new UI structure.
- If a visual primitive is missing, add it below the page layer first instead of patching one page locally.
- Domain code must not create a parallel visual system.

### 3. Web Icon Entry Point Is `AppIcon`

- Web product UI icons must go through `src/components/ui/AppIcon.vue`.
- Do not add page-local or business-component-local SVG glyph systems.
- Inline SVG is only acceptable for user-authored content, brand assets, or non-product illustration assets.

### 4. Do Not Bypass Foundation Controls In Domain Code

In domain views/components, do not recreate shared controls using raw:

- `button`
- `input`
- `select`
- `textarea`

when a foundation component should own the interaction contract.

Preferred shared controls include:

- `AppButton`
- `AppInput`
- `AppCard`
- `AppTable`
- `Modal`
- `ConfirmDialog`
- `StatusBadge`
- `EmptyState`
- `PermissionDeniedState`
- `Skeleton`
- `Tooltip`

Raw hidden file inputs are an allowed exception when the native browser capability is required.

### 5. Use Semantic Tones, Not Local Color Maps

- Only shared semantic tones should own product UI emphasis: `primary`, `success`, `warning`, `danger`, `info`, `neutral`.
- Do not introduce page-local or module-local hex / rgba / gradient status maps in domain code.
- Do not hardcode direct brand hex values in page or business UI.
- Shared status presentation must flow through shared contracts such as `StatusBadge`, `StatusSelector`, or shared composed surfaces.

### 6. Use Shared Page Shells

Use the existing patterns where applicable:

- `DashboardShell`
- `ManagementListShell`
- `WorkflowDetailShell`
- `PublicViewerShell`
- `MobileSalesShell`

If a page needs a structure that no current pattern covers, extend or add a shared pattern instead of hardcoding a new shell in the page.

### 7. Backend And Data Rules

- The active backend structure is Cloudflare Pages Functions + Hono.
- Main business routes are mounted from `functions/lib/hono/app.js`.
- Middleware belongs in `functions/lib/hono/middleware/`.
- D1 queries must use parameter binding. Never build SQL with string concatenation.
- Prefer `env.DB.batch(...)` for batch writes.
- Schema changes must go through `migrations/`.
- Secrets belong in `.dev.vars` for local development and dashboard/secrets for remote environments.
- Bindings and runtime environment names must match `wrangler.toml`.

### 8. Validation Must Match The Change Surface

Run focused checks that match the files you changed. Common commands:

- `pnpm dev`
- `pnpm dev:all`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:unit:run`
- `pnpm test:real-api`
- `pnpm test:real-api:full-chain`
- `pnpm qa:check-ui-token-integrity`
- `pnpm qa:check-ui-foundation-usage`
- `pnpm qa:check-design-system`

Required validation rules:

- Treat `pnpm test` as the default repo test suite for code changes, but do not describe it as real API coverage. Today it runs unit tests plus the mocha-based suite; it does not prove the Cloudflare local server path or full business-chain behavior.
- Use `pnpm test:unit:run` for tight, file-scoped verification while iterating. Before handoff or merge, prefer `pnpm test` unless the task is docs-only or the user explicitly narrows scope.
- Add `pnpm test:real-api` or `pnpm test:real-api:full-chain` when the change touches cross-route business flows or server-client integration boundaries, especially orders, purchase flows, notifications, uploads, or webhooks.
- Before running real API tests, make sure the local runtime is actually healthy: run `pnpm build`, ensure local migrations are applied, start the local server, confirm port `8080` is not occupied by a stale `workerd` / `wrangler pages dev` process, and verify `http://127.0.0.1:8080/api/v1/health` responds before blaming the tests.
- When a test fails, first classify the failure: production-source bug, stale/incorrect test, or local test-environment issue. Do not change production code just to satisfy an outdated selector, broken stub, or noisy local runtime.
- Treat expected warning/error output carefully. Distinguish intentional rejection-path logs or framework noise from actual regressions before deciding a test or implementation is wrong.
- Do not claim completion without fresh verification evidence. Report the exact commands you ran, the result, what you intentionally did not run, and whether any important behavior was only validated through real API tests or was not validated end-to-end.

### 9. Generated / Derived Artifacts

- Do not edit `dist/` as a source of truth.
- Prefer changing source files and regenerating outputs through project commands.

### 10. Historical Process Docs Are Not Default Specs

These directories mainly contain process history, audit trails, or archived planning material:

- `docs/plans/`
- `docs/archive/`
- `docs/reviews/`
- `docs/superpowers/`

Do not treat them as the default source of product truth unless the user explicitly asks for them or the current task is audit/process-related.

## Recommended Workflow

1. Read this file.
2. Read the topic-specific docs from the index below.
3. Inspect the existing implementation before changing patterns.
4. Make the minimal change that stays inside current architecture and design-system ownership.
5. Run focused verification that proves the change, then report the exact validation scope.

## Doc Index By Topic

### Project Overview

- `README.md`
- `docs/README.md`

### Contribution / Routine Dev Flow

- `docs/contributing/README.md`
- `docs/developer-guide/README.md`

### Architecture

- `docs/architecture/README.md`
- `docs/developer-guide/architecture.md`
- `docs/developer-guide/cloudflare-dev-standards.md`
- `docs/developer-guide/cloudflare-pages-context.md`
- `docs/developer-guide/wrangler-guide.md`

### Frontend Design System

- `docs/design-system/MASTER.md`
- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`
- `docs/design-system/status-tone-contract.md`

### Authorization / Audit / Policy

- `docs/developer-guide/authz-policy-system.md`
- `docs/developer-guide/audit-retention.md`
- `docs/developer-guide/audit-alerting.md`

### Deployment / Environment / Operations

- `docs/deployment/README.md`
- `docs/quick-start/README.md`

### AI Prompting / AI Module Internals

- `functions/api/utils/ai-prompts.js`

## Notes For Agents

- Default communication language for this repository is Chinese.
- When project rules in docs conflict with older process artifacts, prefer the current docs and current code structure.
- If a task is explicitly about minisales, switch to minisales-specific docs instead of applying this file blindly.
