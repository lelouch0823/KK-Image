# Severe Issues Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 30 confirmed severe issues from the 2026-04-15 audit without reopening adjacent authorization or public-share regressions.

**Architecture:** Fix the system in boundary-first waves. Harden credential and share-secret storage first, then close public-access and file-serving bypasses, then tighten authenticated API read paths, and finally remove privilege-escalation paths in AI and sales flows. Prefer additive schema migrations, compatibility shims, and focused regression tests so existing users and shares can be migrated safely instead of broken in place.

**Tech Stack:** Cloudflare Pages Functions, Hono, D1, R2, KV, Vitest, Mocha real API tests

---

## Execution Status

- 状态：completed on 2026-04-15
- 结案说明：[docs/reviews/2026-04-15-severe-issues-closure-note.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-15-severe-issues-closure-note.md)
- 结案结果：`01-02`、`05-30` 已完成修复并通过回归或发布验证；`03` / `04` 作为用户明确接受的残余风险保留。
- 总体验证：
  - focused severe unit suites PASS（`25 passed / 1 skipped`）
  - `OPA_BIN=/tmp/opa pnpm authz:policy:test` PASS
  - `pnpm qa:check-direct-protected-fetch` PASS
  - real API slice PASS：`test/folders-real-api.test.js`、`test/uploads-real-api.test.js`、`test/webhooks-real-api.test.js`
  - `pnpm build && pnpm deploy:check` PASS

## Confirmed Scope

- Verified issue source: [2026-04-15-severe-issues-register.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-15-severe-issues-register.md)
- Confirmed status: issues 01-30 are all real current-code behaviors
- Scope override accepted during execution: issues 03 and 04 keep plaintext share passwords by explicit user instruction; treat them as accepted residual risk rather than completed remediation.
- Remediation grouping:
  - Task 1 covers issues 01-04
  - Task 2 covers issues 05-08
  - Task 3 covers issues 09-12
  - Task 4 covers issues 13-15
  - Task 5 covers issues 16-17
  - Task 6 covers issues 18-22
  - Task 7 covers issues 23-24
  - Task 8 covers issues 25-28
  - Task 9 covers issues 29-30

## Non-Negotiable Security Rules

- No password or share secret may be stored or returned in plaintext once the migration lands.
- No protected flow may silently fail open because KV or another optional binding is absent.
- No file-serving path may bypass file ownership, folder visibility, share state, or soft-delete rules.
- Response DTOs for authenticated reads must be explicit allowlists, not raw database rows.
- Backward compatibility must be implemented as lazy migration or controlled backfill, not indefinite support for weak behavior.

## Execution Note

- Implemented in this session:
  - credential hashing hardening for admin and salesperson passwords
  - login / cron / rate-limit fail-open fixes
  - public gallery and public space password-flow hardening
  - direct `/file/:id` authorization and raw-storage fallback removal
  - active-content upload restrictions and attachment-only serving for dangerous MIME types
  - `v1/files` and `v1/folders` read authorization + response allowlists
  - webhook secret redaction on read APIs
  - AI action permission boundaries
  - sales upload and order file binding authorization
- Not implemented by user-approved scope change:
  - hashing folder/space share passwords at rest

### Task 1: Replace Weak Credential and Share Secret Storage

**Files:**
- Create: `migrations/0070_security_credential_and_share_hardening.sql`
- Modify: `functions/api/utils/id.js`
- Modify: `functions/api/utils/__tests__/id.test.js`
- Modify: `functions/lib/hono/_shared/auth-helpers.js`
- Modify: `functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`
- Modify: `functions/lib/hono/routes/v1/users.js`
- Modify: `functions/repositories/SalespersonRepository.js`
- Modify: `functions/repositories/FolderRepository.js`
- Modify: `functions/lib/hono/routes/manage/spaces/crud.js`
- Create or Modify: `functions/repositories/__tests__/FolderRepository.security.test.js`
- Create or Modify: `functions/repositories/__tests__/SalespersonRepository.security.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
- Modify: `functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js`
- Modify: `functions/api/space/__tests__/public-space-access.test.js`
- Create: `functions/api/gallery/__tests__/public-gallery-access.test.js`

- [ ] **Step 1: Write failing tests for slow password hashing, constant-time verification, and hashed share-secret persistence**
- [ ] **Step 2: Run the focused tests and confirm current SHA-256/plaintext behavior fails the new expectations**

Run: `npx vitest run functions/api/utils/__tests__/id.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/api/space/__tests__/public-space-access.test.js functions/api/gallery/__tests__/public-gallery-access.test.js`

- [ ] **Step 3: Add the migration**

Schema requirements:

```sql
-- users / salespersons: add password_hash_version, password_hash, password_salt (or encoded params), password_migrated_at
-- folders / spaces: replace plaintext password with share_password_hash plus metadata
-- keep temporary compatibility columns only if required for live migration and remove read exposure immediately
```

- [ ] **Step 4: Replace the current fast hash helper with a slow password KDF wrapper and constant-time verify helper**

Implementation requirements:

```js
// hashPassword(password) -> encoded hash record
// verifyPassword(password, encodedHash) -> boolean
// support one-time legacy SHA-256 verification only for migration, then rehash on successful login/access
```

- [ ] **Step 5: Update user, salesperson, folder-share, and space-share write paths to store only hashed values, and update read paths to never return the raw secret**
- [ ] **Step 6: Re-run the focused tests and confirm the new storage and verification contract passes**
- [ ] **Step 7: Commit**

```bash
git add migrations/0070_security_credential_and_share_hardening.sql functions/api/utils/id.js functions/api/utils/__tests__/id.test.js functions/lib/hono/_shared/auth-helpers.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js functions/lib/hono/routes/v1/users.js functions/repositories/SalespersonRepository.js functions/repositories/FolderRepository.js functions/lib/hono/routes/manage/spaces/crud.js functions/repositories/__tests__/FolderRepository.security.test.js functions/repositories/__tests__/SalespersonRepository.security.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js functions/api/space/__tests__/public-space-access.test.js functions/api/gallery/__tests__/public-gallery-access.test.js
git commit -m "fix: harden credential and share secret storage"
```

### Task 2: Harden Public Share Access Transport, Expiration, and Brute-Force Controls

**Files:**
- Modify: `functions/api/gallery/[token].js`
- Modify: `functions/api/space/[token].js`
- Modify: `functions/repositories/FolderRepository.js`
- Modify: `functions/lib/hono/middleware/rateLimit.js`
- Modify: `functions/api/space/__tests__/public-space-access.test.js`
- Create or Modify: `functions/api/gallery/__tests__/public-gallery-access.test.js`
- Create: `functions/lib/hono/middleware/__tests__/public-share-rate-limit.test.js`

- [ ] **Step 1: Write failing tests for expired share rejection, non-query password transport, and repeated failed-attempt throttling**
- [ ] **Step 2: Run the focused tests and confirm the current routes still allow the audited behavior**

Run: `npx vitest run functions/api/space/__tests__/public-space-access.test.js functions/api/gallery/__tests__/public-gallery-access.test.js functions/lib/hono/middleware/__tests__/public-share-rate-limit.test.js`

- [ ] **Step 3: Change gallery password submission so secrets are not accepted from `?password=`**

Approved replacement patterns:

```js
// POST password to unlock, then issue a short-lived signed cookie/session grant
// or accept password only in request body and never persist it in URL-shaped state
```

- [ ] **Step 4: Enforce `share_expires_at` in gallery and space access resolution**
- [ ] **Step 5: Add per-token and per-client failed-attempt throttling for public password checks, and fail closed when password protection is enabled but the throttle store is unavailable**
- [ ] **Step 6: Use constant-time comparison at the final secret-verify boundary even after moving to hashed storage**
- [ ] **Step 7: Re-run the focused tests and confirm public share access is bounded correctly**
- [ ] **Step 8: Commit**

```bash
git add functions/api/gallery/[token].js functions/api/space/[token].js functions/repositories/FolderRepository.js functions/lib/hono/middleware/rateLimit.js functions/api/space/__tests__/public-space-access.test.js functions/api/gallery/__tests__/public-gallery-access.test.js functions/lib/hono/middleware/__tests__/public-share-rate-limit.test.js
git commit -m "fix: harden public share access controls"
```

### Task 3: Remove Deployment-Time Fail-Open Auth for Login and Cron

**Files:**
- Modify: `functions/lib/hono/routes/v1/auth.js`
- Modify: `functions/lib/hono/middleware/rateLimit.js`
- Create or Modify: `functions/lib/hono/middleware/__tests__/rateLimit.test.js`
- Modify: `functions/api/utils/cron-auth.js`
- Modify: `functions/api/utils/__tests__/cron-auth.test.js`
- Modify: `scripts/deploy-check.js`
- Modify: `functions/lib/hono/routes/v1/__tests__/auth-me-context.test.js`

- [ ] **Step 1: Write failing tests for mandatory Turnstile verification, non-default cron secret behavior, and lockout/rate-limit fail-closed semantics**
- [ ] **Step 2: Run the focused tests and confirm the current implementation still bypasses protections**

Run: `npx vitest run functions/lib/hono/routes/v1/__tests__/auth-me-context.test.js functions/lib/hono/middleware/__tests__/rateLimit.test.js functions/api/utils/__tests__/cron-auth.test.js`

- [ ] **Step 3: Make Turnstile mandatory whenever `TURNSTILE_SECRET_KEY` is configured, even when the request omits `turnstileToken`**
- [ ] **Step 4: Remove the `dev-secret` fallback and require explicit `CRON_SECRET` in any environment that exposes cron endpoints**
- [ ] **Step 5: Make login throttling and lockout fail closed for protected auth flows when KV is absent, or block startup/deploy with an explicit environment assertion**
- [ ] **Step 6: Extend `scripts/deploy-check.js` so preview/production verification fails when required security bindings are missing**
- [ ] **Step 7: Re-run the focused tests and confirm the protections now fail safely**
- [ ] **Step 8: Commit**

```bash
git add functions/lib/hono/routes/v1/auth.js functions/lib/hono/middleware/rateLimit.js functions/lib/hono/middleware/__tests__/rateLimit.test.js functions/api/utils/cron-auth.js functions/api/utils/__tests__/cron-auth.test.js scripts/deploy-check.js functions/lib/hono/routes/v1/__tests__/auth-me-context.test.js
git commit -m "fix: remove login and cron fail-open security defaults"
```

### Task 4: Redesign the `/file/:id` Access Model

**Files:**
- Modify: `functions/file/[id].js`
- Modify: `functions/file/_middleware.js`
- Create: `functions/file/__tests__/file-access.test.js`
- Modify: `scripts/qa/check-direct-protected-fetch.mjs`
- Modify: `scripts/qa/__tests__/check-direct-protected-fetch.test.mjs`

- [ ] **Step 1: Write failing tests for unauthorized fetch rejection, soft-deleted file rejection, and no-database-row fallback rejection**
- [ ] **Step 2: Run the focused tests and confirm the current route still serves the audited cases**

Run: `npx vitest run functions/file/__tests__/file-access.test.js scripts/qa/__tests__/check-direct-protected-fetch.test.mjs`

- [ ] **Step 3: Move file visibility decisions into a single access resolver used before any R2 read**

Required checks:

```js
// reject when file row is missing
// reject when file.is_deleted is true
// reject when caller lacks folder/share/sales/authz rights
// never treat the raw request path as a storage key bypass
```

- [ ] **Step 4: Allow access only via authenticated permission checks or a short-lived signed/public-share grant that is scoped to the resolved file row**
- [ ] **Step 5: Re-run the focused tests and QA check and confirm direct protected fetches are blocked**
- [ ] **Step 6: Commit**

```bash
git add functions/file/[id].js functions/file/_middleware.js functions/file/__tests__/file-access.test.js scripts/qa/check-direct-protected-fetch.mjs scripts/qa/__tests__/check-direct-protected-fetch.test.mjs
git commit -m "fix: enforce access control on direct file fetches"
```

### Task 5: Restore Upload and Content-Serving Restrictions for Active Content

**Files:**
- Modify: `functions/api/utils/file-utils.js`
- Modify: `functions/api/utils/__tests__/file-utils-dup.test.js`
- Modify: `functions/file/[id].js`
- Modify: `functions/lib/hono/routes/manage/__tests__/upload-route.test.js`
- Modify: `test/uploads-real-api.test.js`

- [ ] **Step 1: Write failing tests for MIME allowlist enforcement and attachment-only handling of dangerous content types**
- [ ] **Step 2: Run the focused tests and confirm current uploads and file responses still allow active content**

Run: `npx vitest run functions/api/utils/__tests__/file-utils-dup.test.js functions/lib/hono/routes/manage/__tests__/upload-route.test.js test/uploads-real-api.test.js`

- [ ] **Step 3: Re-enable MIME allowlist enforcement in upload validation and explicitly reject HTML, SVG, and scriptable document types unless a business exception is documented**
- [ ] **Step 4: Make any allowed risky file type download as `attachment` from `/file/:id` rather than inline render**
- [ ] **Step 5: Re-run the focused tests and confirm dangerous content is blocked or safely downgraded**
- [ ] **Step 6: Commit**

```bash
git add functions/api/utils/file-utils.js functions/api/utils/__tests__/file-utils-dup.test.js functions/file/[id].js functions/lib/hono/routes/manage/__tests__/upload-route.test.js test/uploads-real-api.test.js
git commit -m "fix: restore upload and content-serving safety guards"
```

### Task 6: Add Missing Read Authorization and Response Allowlists on v1 File/Folder Routes

**Files:**
- Modify: `functions/lib/hono/routes/v1/files.js`
- Modify: `functions/lib/hono/routes/v1/folders.js`
- Modify: `functions/repositories/FolderRepository.js`
- Modify: `functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js`
- Modify: `functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`
- Modify: `test/v1-files-folders.test.js`

- [ ] **Step 1: Write failing tests for `files:read` and `folders:read` enforcement, secret-field redaction, and `check-hash` URL suppression**
- [ ] **Step 2: Run the focused tests and confirm the current routes still expose the audited behavior**

Run: `npx vitest run functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js test/v1-files-folders.test.js`

- [ ] **Step 3: Add explicit `requirePermission('files:read')` and `requirePermission('folders:read')` gates on list/detail/hash-probe reads**
- [ ] **Step 4: Replace raw row passthroughs with explicit response serializers that omit `password`, `share_token`, direct object keys, and any other secret-bearing fields**
- [ ] **Step 5: Make `check-hash` return only a boolean or internal ID when authorized, not a reusable direct URL**
- [ ] **Step 6: Re-run the focused tests and confirm read paths are permission-bounded and sanitized**
- [ ] **Step 7: Commit**

```bash
git add functions/lib/hono/routes/v1/files.js functions/lib/hono/routes/v1/folders.js functions/repositories/FolderRepository.js functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js test/v1-files-folders.test.js
git commit -m "fix: enforce v1 file and folder read authorization"
```

### Task 7: Redact Webhook Secrets from All Read APIs

**Files:**
- Modify: `functions/repositories/WebhookRepository.js`
- Modify: `functions/repositories/__tests__/WebhookRepository.test.js`
- Modify: `functions/lib/hono/routes/manage/webhooks.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js`
- Modify: `functions/lib/hono/routes/v1/webhooks.js`
- Modify: `functions/lib/hono/routes/v1/__tests__/webhooks-routes.test.js`

- [ ] **Step 1: Write failing tests asserting read/list endpoints never return plaintext webhook secrets**
- [ ] **Step 2: Run the focused tests and confirm the current APIs still leak the secret**

Run: `npx vitest run functions/repositories/__tests__/WebhookRepository.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/routes/v1/__tests__/webhooks-routes.test.js`

- [ ] **Step 3: Change repository DTOs to emit a safe read model such as `hasSecret`, `secretLastUpdatedAt`, and masked metadata only**
- [ ] **Step 4: Keep secret write/update endpoints separate from read models so `webhooks:read` never implies secret disclosure**
- [ ] **Step 5: Re-run the focused tests and confirm both namespaces redact the secret**
- [ ] **Step 6: Commit**

```bash
git add functions/repositories/WebhookRepository.js functions/repositories/__tests__/WebhookRepository.test.js functions/lib/hono/routes/manage/webhooks.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/routes/v1/webhooks.js functions/lib/hono/routes/v1/__tests__/webhooks-routes.test.js
git commit -m "fix: redact webhook secrets from read APIs"
```

### Task 8: Reintroduce Permission Boundaries for AI Actions

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`
- Modify: `functions/ai/action-service.js`
- Modify: `functions/ai/action-submitters.js`
- Modify: `functions/ai/__tests__/action-service.test.js`
- Modify: `functions/ai/__tests__/action-submitters.test.js`
- Modify: `functions/ai/adapters/customer.js`
- Modify: `functions/ai/adapters/order.js`
- Modify: `functions/ai/adapters/product.js`
- Modify: `functions/ai/adapters/purchase-order.js`

- [ ] **Step 1: Write failing tests proving a `stats:read`-only principal cannot invoke customer, order, product, or purchase-order mutations through AI**
- [ ] **Step 2: Run the focused tests and confirm the current AI route still permits the audited writes**

Run: `npx vitest run functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js functions/ai/__tests__/action-service.test.js functions/ai/__tests__/action-submitters.test.js`

- [ ] **Step 3: Add a per-action permission map so every adapter declares the exact write capability it requires**

Minimum target matrix:

```js
create_customer -> customers:create
create_order -> orders:create
create_product -> products:create
create_purchase_order -> purchase_orders:create
```

- [ ] **Step 4: Enforce the declared permission before the action service resolves or submits any mutating tool**
- [ ] **Step 5: Re-run the focused tests and confirm AI write tools respect the same permission model as direct routes**
- [ ] **Step 6: Commit**

```bash
git add functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js functions/ai/action-service.js functions/ai/action-submitters.js functions/ai/__tests__/action-service.test.js functions/ai/__tests__/action-submitters.test.js functions/ai/adapters/customer.js functions/ai/adapters/order.js functions/ai/adapters/product.js functions/ai/adapters/purchase-order.js
git commit -m "fix: enforce ai action permission boundaries"
```

### Task 9: Close Sales Cross-Order File Injection and Binding Gaps

**Files:**
- Modify: `functions/lib/hono/routes/sales/files.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/lib/hono/routes/sales/__tests__/files-routes.test.js`
- Modify: `functions/lib/hono/routes/sales/__tests__/order-create-folder-archive.test.js`
- Modify: `functions/repositories/__tests__/order-mutations.test.js`
- Modify: `test/sales-real-api-utils.test.js`

- [ ] **Step 1: Write failing tests for rejecting uploads to another salesperson's order and rejecting arbitrary `fileIds` that are outside the caller/order scope**
- [ ] **Step 2: Run the focused tests and confirm the current sales routes still permit the audited behavior**

Run: `npx vitest run functions/lib/hono/routes/sales/__tests__/files-routes.test.js functions/lib/hono/routes/sales/__tests__/order-create-folder-archive.test.js functions/repositories/__tests__/order-mutations.test.js test/sales-real-api-utils.test.js`

- [ ] **Step 3: Validate order ownership in `sales/files.js` before folder resolution or upload persistence**
- [ ] **Step 4: Validate each incoming `fileId` against salesperson ownership and the target order scope before any move or `order_files` binding**
- [ ] **Step 5: Re-run the focused tests and confirm cross-order and cross-user binding attempts are rejected**
- [ ] **Step 6: Commit**

```bash
git add functions/lib/hono/routes/sales/files.js functions/lib/hono/routes/sales/orders.js functions/repositories/order/mutations.js functions/lib/hono/routes/sales/__tests__/files-routes.test.js functions/lib/hono/routes/sales/__tests__/order-create-folder-archive.test.js functions/repositories/__tests__/order-mutations.test.js test/sales-real-api-utils.test.js
git commit -m "fix: enforce sales file ownership boundaries"
```

### Task 10: Final Verification and Rollout Gate

**Files:**
- Modify only if regressions are discovered while running verification

- [ ] **Step 1: Run all focused unit suites touched by Tasks 1-9**

Run: `npx vitest run functions/api/utils/__tests__/id.test.js functions/api/utils/__tests__/cron-auth.test.js functions/api/utils/__tests__/file-utils-dup.test.js functions/api/space/__tests__/public-space-access.test.js functions/api/gallery/__tests__/public-gallery-access.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js functions/lib/hono/middleware/__tests__/rateLimit.test.js functions/lib/hono/middleware/__tests__/public-share-rate-limit.test.js functions/lib/hono/routes/v1/__tests__/auth-me-context.test.js functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js functions/lib/hono/routes/v1/__tests__/users-permissions-validation.test.js functions/lib/hono/routes/v1/__tests__/webhooks-routes.test.js functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js functions/lib/hono/routes/manage/__tests__/upload-route.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js functions/lib/hono/routes/sales/__tests__/files-routes.test.js functions/lib/hono/routes/sales/__tests__/order-create-folder-archive.test.js functions/repositories/__tests__/WebhookRepository.test.js functions/repositories/__tests__/order-mutations.test.js functions/file/__tests__/file-access.test.js functions/ai/__tests__/action-service.test.js functions/ai/__tests__/action-submitters.test.js test/v1-files-folders.test.js test/uploads-real-api.test.js test/sales-real-api-utils.test.js`

Expected: PASS

- [ ] **Step 2: Run the policy and QA guards**

Run: `pnpm authz:policy:test && pnpm qa:check-direct-protected-fetch`

Expected: PASS

- [ ] **Step 3: Run the real API regression slice that covers the touched surfaces**

Run: `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/folders-real-api.test.js test/uploads-real-api.test.js test/webhooks-real-api.test.js`

Expected: PASS

- [ ] **Step 4: Run deploy verification after a clean build**

Run: `pnpm build && pnpm deploy:check`

Expected: PASS

- [ ] **Step 5: Review any regression, fix it in the owning task scope, and re-run the failed verification before merging**
- [ ] **Step 6: Prepare a short closure note mapping each issue number 01-30 to the commit or test that closed it**
