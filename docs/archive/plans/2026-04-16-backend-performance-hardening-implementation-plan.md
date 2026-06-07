# Backend Performance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first high-ROI backend performance fixes without broad behavioral churn by tightening critical D1 indexes, reducing repeated product-list aggregations, and making inventory mutation batching real.

**Architecture:** This batch stays inside existing repository/service boundaries. Database changes are additive via a new migration plus bootstrap schema alignment. Read-path optimization focuses on `ProductRepository.search`, while write-path optimization focuses on `InventoryService.applyBatch` using prepared-statement batching instead of per-mutation serial writes.

**Tech Stack:** Cloudflare Pages Functions, D1/SQLite, Hono, Vitest, JavaScript ESM

**Issue Audit:** [docs/reviews/2026-04-16-backend-performance-issue-audit.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-16-backend-performance-issue-audit.md)

---

### Task 1: Add failing tests for performance-hardening schema and batching expectations

**Files:**

- Modify: `scripts/__tests__/init-database-bootstrap-consistency.test.js`
- Modify: `scripts/__tests__/check-migration-prefixes.test.js`
- Modify: `functions/services/__tests__/InventoryService.test.js`
- Modify: `functions/repositories/__tests__/product-spu.test.js`

- [ ] **Step 1: Add bootstrap schema assertions for the new indexes**
- [ ] **Step 2: Add migration-file assertions for the new performance migration**
- [ ] **Step 3: Add `InventoryService.applyBatch` tests that expect batched DB execution rather than per-mutation serial `run()`**
- [ ] **Step 4: Add `ProductRepository.search` tests that prove filter facets can be skipped and that the count query no longer wraps the full heavy select**
- [ ] **Step 5: Run the focused tests and confirm they fail for the expected reasons**

Run:

```bash
pnpm test:unit:run scripts/__tests__/init-database-bootstrap-consistency.test.js scripts/__tests__/check-migration-prefixes.test.js functions/services/__tests__/InventoryService.test.js functions/repositories/__tests__/product-spu.test.js
```

### Task 2: Add the migration and bootstrap schema alignment

**Files:**

- Create: `migrations/0071_backend_performance_indexes.sql`
- Modify: `scripts/init-database.sql`

- [ ] **Step 1: Add additive indexes for `spaces.share_mode`, `notifications(receiver,is_read,created_at DESC)`, `space_files(space_id, section, sort_order)`, `space_access_logs(space_id, accessed_at DESC)`, `orders(salesperson_id, created_at DESC)`, `orders(salesperson_id, status, created_at DESC)`, `order_lines(order_id, created_at ASC)`, `order_lines(variant_id, display_status, created_at ASC)`**
- [ ] **Step 2: Mirror those indexes in `scripts/init-database.sql` so bootstrap and migrated databases converge**
- [ ] **Step 3: Re-run the focused schema tests**

### Task 3: Reduce `ProductRepository.search` duplicate heavy work

**Files:**

- Modify: `functions/repositories/ProductRepository.js`
- Test: `functions/repositories/__tests__/product-spu.test.js`

- [ ] **Step 1: Refactor search helpers so facet loading is optional and does not force repeated `variant_agg` scans in every call site**
- [ ] **Step 2: Replace the current count-subquery shape with a lighter count path that reuses the same filter clause but avoids wrapping the full ordered list query**
- [ ] **Step 3: Keep the returned API shape stable**
- [ ] **Step 4: Re-run the focused repository tests**

### Task 4: Make `InventoryService.applyBatch` truly batched

**Files:**

- Modify: `functions/services/InventoryService.js`
- Test: `functions/services/__tests__/InventoryService.test.js`

- [ ] **Step 1: Add an internal batch path that builds statements for all mutations first**
- [ ] **Step 2: Use `executeBatchChunks` for DB-backed batch execution instead of nested serial `run()` calls**
- [ ] **Step 3: Preserve existing non-DB fallback behavior for mocked repository-based tests**
- [ ] **Step 4: Re-run the focused service tests**

### Task 5: Verify the first batch end-to-end

**Files:**

- No code changes expected unless verification exposes issues

- [ ] **Step 1: Run the focused tests again**
- [ ] **Step 2: Run migration prefix validation**
- [ ] **Step 3: Summarize residual risks for the larger second-batch work: order projections, outbox concurrency, webhook concurrency, goods-overview projections**

Run:

```bash
pnpm test:unit:run scripts/__tests__/init-database-bootstrap-consistency.test.js scripts/__tests__/check-migration-prefixes.test.js functions/services/__tests__/InventoryService.test.js functions/repositories/__tests__/product-spu.test.js
node scripts/check-migration-prefixes.mjs
```
