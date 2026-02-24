# Global Error Handler Implementation Plan (Phase 2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize error handling using Hono's native `app.onError` across the REST of the remaining API endpoints. Phase 1 successfully cleaned up major core routes. Phase 2 aims to sweep the remaining ~30 files to achieve 100% DRY compliance.

**Architecture:** Same as Phase 1: strip `try-catch` layers from individual endpoints, replacing manual `return c.json({error: ...}, 404/500)` with `throw new NotFoundError(...)` or `throw new BadRequestError(...)` etc.

---

### Task 1: Batch 1 - Manage Core A
**Files to Refactor:**
- `functions/lib/hono/routes/manage/ai.js`
- `functions/lib/hono/routes/manage/albums.js`
- `functions/lib/hono/routes/manage/audit-logs.js`
- `functions/lib/hono/routes/manage/dashboard.js`
- `functions/lib/hono/routes/manage/files.js`
- `functions/lib/hono/routes/manage/folders.js`
- `functions/lib/hono/routes/manage/goods-overview.js`
- `functions/lib/hono/routes/manage/notifications.js`

**Action:**
1. Open files one by one.
2. Remove `try-catch` wrappers.
3. Import from `../../../errors.js`.
4. Replace manual error returns with `throw`.
5. Run `pnpm run build` and commit.

---

### Task 2: Batch 2 - Manage Core B
**Files to Refactor:**
- `functions/lib/hono/routes/manage/orders/create.js`
- `functions/lib/hono/routes/manage/products/batch.js`
- `functions/lib/hono/routes/manage/products/export.js`
- `functions/lib/hono/routes/manage/search.js`
- `functions/lib/hono/routes/manage/settings.js`
- `functions/lib/hono/routes/manage/shares.js`

**Action:**
1. Remove `try-catch` wrappers.
2. Run `pnpm run build` and commit.

---

### Task 3: Batch 3 - Manage Spaces & Setup
**Files to Refactor:**
- `functions/lib/hono/routes/manage/spaces/crud.js`
- `functions/lib/hono/routes/manage/spaces/files.js`
- `functions/lib/hono/routes/manage/spaces/subspaces.js`
- `functions/lib/hono/routes/manage/spaces/transformers.js`
- `functions/lib/hono/routes/manage/stats.js`
- `functions/lib/hono/routes/manage/tags.js`
- `functions/lib/hono/routes/manage/trash.js`
- `functions/lib/hono/routes/manage/upload.js`
- `functions/lib/hono/routes/manage/utils.js`

**Action:**
1. Remove `try-catch` wrappers.
2. Run `pnpm run build` and commit.

---

### Task 4: Batch 4 - Sales & V1 API
**Files to Refactor:**
- `functions/lib/hono/routes/sales/auth.js`
- `functions/lib/hono/routes/sales/orders.js`
- `functions/lib/hono/routes/v1/auth.js`
- `functions/lib/hono/routes/v1/files.js`
- `functions/lib/hono/routes/v1/health.js`
- `functions/lib/hono/routes/v1/users.js`
- `functions/lib/hono/routes/v1/webhooks.js`

**Action:**
1. Remove `try-catch` wrappers.
2. Run `pnpm run build` and finally commit all remaining.
