# Backend Performance Full Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复后端性能问题审计文档中所有剩余 `deferred` 项，完成订单读模型降重、热 payload 拆分、采购写路径收敛、需求投影统一、商品导入批量化、查询观测接入与冗余索引清理。

**Architecture:** 本计划按 8 个波次推进，先建立订单与需求的稳定读模型，再压缩采购域写路径，最后统一接入慢查询观测并清理冗余索引。所有波次都要求 TDD，优先引入新增 projection / helper 文件承载复杂逻辑，避免继续把职责堆回现有大文件。

**Tech Stack:** Cloudflare Pages Functions, D1/SQLite, Hono, Vitest, JavaScript ESM

**Issue Audit:** [docs/reviews/2026-04-16-backend-performance-issue-audit.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-16-backend-performance-issue-audit.md)

---

## Scope Mapping

| Issue | Plan Task |
| --- | --- |
| 10. 订单列表主查询仍依赖实时订单行聚合 | Task 1 |
| 11. `orders` 热表内联大块 JSON | Task 2 |
| 12. 采购收货 / 冲销 / 待收关闭链路多阶段写入 | Task 3 |
| 13. 订单状态流转与订单变更路径重复扫描 `order_lines` | Task 4 |
| 14. 缺货总览 / 需求服务 / 采购建议重复扫描活动订单行 | Task 5 |
| 15. 商品批量导入缺少 preload + bulk upsert | Task 6 |
| 16. 慢查询观测层未真正接入热路径 | Task 7 |
| 17. schema 冗余索引增加写放大 | Task 8 |

## File Structure

### Schema / migration

- Create: `migrations/0072_order_summary_projection.sql`
- Create: `migrations/0073_order_payload_sidecar.sql`
- Create: `migrations/0074_variant_demand_projection.sql`
- Create: `migrations/0075_redundant_index_cleanup.sql`
- Modify: `scripts/init-database.sql`
- Create: `scripts/migrations/backfill-order-summary-projection.mjs`
- Create: `scripts/migrations/backfill-order-payloads.mjs`
- Create: `scripts/migrations/backfill-variant-demand-projection.mjs`

### Order read model and payload split

- Create: `functions/repositories/order/summary-projection.js`
- Create: `functions/repositories/order/payloads.js`
- Modify: `functions/repositories/order/sql.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Modify: `functions/repositories/order/helpers.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`

### Procurement write-path compaction

- Create: `functions/services/order-procurement/command-preload.js`
- Create: `functions/services/order-procurement/command-batch.js`
- Create: `functions/services/order-procurement/order-line-prefetch.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/repositories/order/mutations.js`

### Demand / shortage projection

- Create: `functions/repositories/VariantDemandProjectionRepository.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/services/DemandService.js`
- Modify: `functions/services/PurchaseOrderService.js`

### Product import batching

- Create: `functions/services/product-catalog/preload-existing.js`
- Create: `functions/services/product-catalog/bulk-upsert.js`
- Modify: `functions/services/product-catalog/batch-execution.js`
- Modify: `functions/services/ProductCatalogService.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/repositories/ProductVariantRepository.js`

### Query observability

- Modify: `functions/lib/db/query.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/WebhookDeliveryService.js`
- Modify: `functions/services/DomainOutboxDispatchService.js`

### Test coverage

- Modify: `scripts/__tests__/init-database-bootstrap-consistency.test.js`
- Modify: `scripts/__tests__/check-migration-prefixes.test.js`
- Create: `scripts/__tests__/backfill-order-summary-projection.test.js`
- Create: `scripts/__tests__/backfill-order-payloads.test.js`
- Create: `scripts/__tests__/backfill-variant-demand-projection.test.js`
- Modify: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Modify: `functions/repositories/__tests__/OrderStatsRepository.test.js`
- Modify: `functions/repositories/__tests__/order-mutations.test.js`
- Modify: `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
- Modify: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Modify: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
- Modify: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`
- Modify: `functions/services/__tests__/DemandService.test.js`
- Modify: `functions/services/__tests__/InventoryBusinessWorkflow.test.js`
- Modify: `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- Modify: `functions/repositories/__tests__/product-import-merge.test.js`
- Modify: `functions/services/__tests__/ProductCatalogService.decomposition.audit.test.js`
- Create: `functions/lib/db/__tests__/query-observability.test.js`

### Docs

- Modify: `docs/reviews/2026-04-16-backend-performance-issue-audit.md`
- Modify: `docs/plans/2026-04-16-backend-performance-hardening-implementation-plan.md`

---

### Task 1: Replace Runtime Order-Line Aggregation With Order Summary Projection

**Files:**
- Create: `migrations/0072_order_summary_projection.sql`
- Modify: `scripts/init-database.sql`
- Create: `scripts/migrations/backfill-order-summary-projection.mjs`
- Create: `functions/repositories/order/summary-projection.js`
- Modify: `functions/repositories/order/sql.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Modify: `functions/lib/hono/routes/manage/orders/list.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Test: `functions/repositories/__tests__/OrderStatsRepository.test.js`
- Test: `scripts/__tests__/init-database-bootstrap-consistency.test.js`
- Test: `scripts/__tests__/check-migration-prefixes.test.js`
- Test: `scripts/__tests__/backfill-order-summary-projection.test.js`

- [ ] **Step 1: Write failing tests proving order list and stats queries no longer need runtime `ORDER_LINE_STATUS_AGGREGATE_JOIN` / `ORDER_LINE_PRIMARY_SNAPSHOT_JOIN` on the hot path**
- [ ] **Step 2: Run `pnpm test:unit:run functions/repositories/__tests__/order-queries.display-model.test.js functions/repositories/__tests__/OrderStatsRepository.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js scripts/__tests__/check-migration-prefixes.test.js scripts/__tests__/backfill-order-summary-projection.test.js` and confirm the new assertions fail for the expected reasons**
- [ ] **Step 3: Add `order_summary_projection` schema with at least `order_id`, `display_status`, `ordered_qty`, `shipped_qty`, `returned_qty`, `cancelled_qty`, `snapshot_name`, `updated_at`, plus indexes supporting admin and sales list filters**
- [ ] **Step 4: Mirror the new projection table and indexes into `scripts/init-database.sql`**
- [ ] **Step 5: Implement a backfill script that derives projection rows from current `order_lines` and `order_returns` data without changing API behavior**
- [ ] **Step 6: Create `functions/repositories/order/summary-projection.js` as the single read/write helper for loading and refreshing the projection**
- [ ] **Step 7: Switch `functions/repositories/order/queries.js`, `functions/repositories/OrderStatsRepository.js`, and `functions/lib/hono/routes/manage/orders/list.js` to read projection columns instead of recomputing line aggregates for the default list and stats paths**
- [ ] **Step 8: Re-run the targeted tests until they pass**

### Task 2: Split Hot Order Payload JSON Out Of The `orders` Table

**Files:**
- Create: `migrations/0073_order_payload_sidecar.sql`
- Modify: `scripts/init-database.sql`
- Create: `scripts/migrations/backfill-order-payloads.mjs`
- Create: `functions/repositories/order/payloads.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/order/helpers.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Test: `functions/repositories/__tests__/order-queries.display-model.test.js`
- Test: `scripts/__tests__/backfill-order-payloads.test.js`
- Test: `scripts/__tests__/init-database-bootstrap-consistency.test.js`
- Test: `scripts/__tests__/check-migration-prefixes.test.js`

- [ ] **Step 1: Write failing tests proving order list queries do not need `orders.current_data` / `orders.original_data` for list views, while detail reads still reconstruct the existing API shape**
- [ ] **Step 2: Run `pnpm test:unit:run functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-queries.display-model.test.js scripts/__tests__/backfill-order-payloads.test.js scripts/__tests__/init-database-bootstrap-consistency.test.js scripts/__tests__/check-migration-prefixes.test.js` and confirm the new tests fail**
- [ ] **Step 3: Add `order_payloads` sidecar schema with `order_id`, `original_data`, `current_data`, `created_at`, `updated_at`, plus lookup indexes**
- [ ] **Step 4: Mirror the sidecar schema into `scripts/init-database.sql` and backfill existing payload rows from `orders`**
- [ ] **Step 5: Move payload reads/writes into `functions/repositories/order/payloads.js`**
- [ ] **Step 6: Update `functions/repositories/order/mutations.js` to dual-write order payloads, and update `functions/repositories/order/queries.js` / `functions/repositories/order/helpers.js` so only detail flows join payload data**
- [ ] **Step 7: Re-run the targeted tests until they pass**

### Task 3: Collapse Procurement Command Writes Into Single Final Batches

**Files:**
- Create: `functions/services/order-procurement/command-preload.js`
- Create: `functions/services/order-procurement/command-batch.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Test: `functions/services/__tests__/OrderProcurementDomainService.test.js`
- Test: `functions/services/__tests__/PurchaseOrderShortageClosureService.test.js`
- Test: `functions/services/__tests__/OrderProcurementReceiptReversalService.test.js`

- [x] **Step 1: Write failing tests that capture the desired one-pass write behavior for receipt apply, shortage close, and reversal flows without preflight real writes followed by rollback**
- [x] **Step 2: Run `pnpm test:unit:run functions/services/__tests__/OrderProcurementDomainService.test.js functions/services/__tests__/PurchaseOrderShortageClosureService.test.js functions/services/__tests__/OrderProcurementReceiptReversalService.test.js` and verify those new tests fail**
- [x] **Step 3: Collapse per-service validation/write planning so guarded updates and finalize statements are assembled before the single final batch executes**
- [x] **Step 4: Refactor final write construction so idempotency finalize, order-line updates, inventory changes, projection refresh, and outbox append run in one batch without compensating rollback batches**
- [x] **Step 5: Refactor the three procurement services to validate from preloaded state and execute only the final batch once**
- [x] **Step 6: Re-run the targeted service tests until they pass**

### Task 4: Prefetch Order-Line Aggregates For Order Mutation Hot Paths

**Files:**
- Create: `functions/services/order-procurement/order-line-prefetch.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Test: `functions/repositories/__tests__/order-inventory-flow.test.js`
- Test: `functions/services/__tests__/order-procurement-shared.test.js`

- [x] **Step 1: Write failing tests proving batch order mutations reuse preloaded line totals / primary-line snapshot data instead of repeatedly issuing `SUM/COUNT/LIMIT 1` scans**
- [x] **Step 2: Run `pnpm test:unit:run functions/repositories/__tests__/order-mutations.test.js functions/repositories/__tests__/order-inventory-flow.test.js functions/services/__tests__/order-procurement-shared.test.js` and confirm the new expectations fail**
- [x] **Step 3: Add `order-line-prefetch.js` that loads `order_id -> totals / line_count / primary snapshot` in chunks**
- [x] **Step 4: Refactor `functions/repositories/order/mutations.js` to consume the prefetched state rather than re-querying per order**
- [x] **Step 5: Re-run the targeted mutation and shared-flow tests until they pass**

### Task 5: Introduce A Shared Variant Demand Projection For Goods Overview And Suggestions

**Files:**
- Create: `migrations/0074_variant_demand_projection.sql`
- Modify: `scripts/init-database.sql`
- Create: `scripts/migrations/backfill-variant-demand-projection.mjs`
- Create: `functions/repositories/VariantDemandProjectionRepository.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/services/DemandService.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Test: `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
- Test: `functions/services/__tests__/DemandService.test.js`
- Test: `functions/services/__tests__/InventoryBusinessWorkflow.test.js`
- Test: `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
- Test: `scripts/__tests__/backfill-variant-demand-projection.test.js`

- [ ] **Step 1: Write failing tests proving goods overview, demand sync, and purchase suggestions can all read from a shared variant-level projection instead of recomputing the same joins independently**
- [ ] **Step 2: Run `pnpm test:unit:run functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/services/__tests__/DemandService.test.js functions/services/__tests__/InventoryBusinessWorkflow.test.js functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js scripts/__tests__/backfill-variant-demand-projection.test.js` and verify the new tests fail**
- [ ] **Step 3: Add `variant_demand_projection` schema and bootstrap definitions with indexes for shortage and sort-order access**
- [ ] **Step 4: Implement the backfill script and `VariantDemandProjectionRepository.js`**
- [ ] **Step 5: Update `DemandService` to refresh the projection during demand-affecting writes**
- [ ] **Step 6: Update `GoodsOverviewRepository` and `PurchaseOrderService.getSuggestions()` to read the projection first**
- [ ] **Step 7: Re-run the targeted tests until they pass**

### Task 6: Rebuild Product Import Around Preload And Bulk Upsert

**Files:**
- Create: `functions/services/product-catalog/preload-existing.js`
- Create: `functions/services/product-catalog/bulk-upsert.js`
- Modify: `functions/services/product-catalog/batch-execution.js`
- Modify: `functions/services/ProductCatalogService.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/repositories/ProductVariantRepository.js`
- Test: `functions/repositories/__tests__/product-import-merge.test.js`
- Test: `functions/services/__tests__/ProductCatalogService.decomposition.audit.test.js`
- Test: `functions/services/__tests__/ProductCatalogService.put-boundaries.test.js`

- [ ] **Step 1: Write failing tests proving batch import preloads existing products / variants once per chunk and uses bulk upsert paths instead of per-item lookup chains**
- [ ] **Step 2: Run `pnpm test:unit:run functions/repositories/__tests__/product-import-merge.test.js functions/services/__tests__/ProductCatalogService.decomposition.audit.test.js functions/services/__tests__/ProductCatalogService.put-boundaries.test.js` and confirm the new tests fail**
- [ ] **Step 3: Add `preload-existing.js` to gather existing product, variant, and dimension state by chunk**
- [ ] **Step 4: Add `bulk-upsert.js` for chunked create/update persistence and integrate it into `batch-execution.js`**
- [ ] **Step 5: Refactor `ProductCatalogService`, `ProductRepository`, and `ProductVariantRepository` so batch import uses preload + chunked upsert, while preserving rollback semantics**
- [ ] **Step 6: Re-run the targeted tests until they pass**

### Task 7: Wire Query Observability Into Backend Hot Paths

**Files:**
- Modify: `functions/lib/db/query.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/repositories/OrderStatsRepository.js`
- Modify: `functions/repositories/GoodsOverviewRepository.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/services/OrderProcurementDomainService.js`
- Modify: `functions/services/PurchaseOrderShortageClosureService.js`
- Modify: `functions/services/OrderProcurementReceiptReversalService.js`
- Modify: `functions/services/WebhookDeliveryService.js`
- Modify: `functions/services/DomainOutboxDispatchService.js`
- Test: `functions/lib/db/__tests__/query-observability.test.js`

- [x] **Step 1: Write failing tests for query wrapper labeling and slow-query metric capture so the wrapper records `duration`, `rows_read`, and operation labels without changing result shapes**
- [x] **Step 2: Run `pnpm test:unit:run functions/lib/db/__tests__/query-observability.test.js` and confirm the new tests fail**
- [x] **Step 3: Expand `functions/lib/db/query.js` so repositories and services can label hot reads and batch writes consistently**
- [x] **Step 4: Adopt the wrapper in the first hot-path rollout: order queries, order stats, product search, and outbox dispatch**
- [x] **Step 5: Re-run the observability tests and a targeted smoke suite for the touched modules**

### Task 8: Remove Redundant Indexes And Reconcile Final Schema

**Files:**
- Create: `migrations/0075_redundant_index_cleanup.sql`
- Modify: `scripts/init-database.sql`
- Modify: `scripts/__tests__/init-database-bootstrap-consistency.test.js`
- Modify: `scripts/__tests__/check-migration-prefixes.test.js`

- [x] **Step 1: Write failing schema tests that lock in the intended post-cleanup index set and reject duplicated unique/ordinary index pairs**
- [x] **Step 2: Run `pnpm test:unit:run scripts/__tests__/init-database-bootstrap-consistency.test.js scripts/__tests__/check-migration-prefixes.test.js` and confirm the new expectations fail**
- [x] **Step 3: Add a cleanup migration that drops redundant indexes while preserving unique constraints and the hot-path composite indexes introduced earlier**
- [x] **Step 4: Mirror the cleanup in `scripts/init-database.sql` so bootstrap and migrated databases converge**
- [x] **Step 5: Re-run the schema tests until they pass**

### Task 9: Final Verification, Issue Register Update, And Handoff

**Files:**
- Modify: `docs/reviews/2026-04-16-backend-performance-issue-audit.md`
- Modify: `docs/plans/2026-04-16-backend-performance-hardening-implementation-plan.md`
- Modify: `docs/plans/2026-04-16-backend-performance-full-remediation-plan.md`

- [ ] **Step 1: Run the full remediation verification suite**

Run:
```bash
pnpm test:unit:run \
  scripts/__tests__/init-database-bootstrap-consistency.test.js \
  scripts/__tests__/check-migration-prefixes.test.js \
  scripts/__tests__/backfill-order-summary-projection.test.js \
  scripts/__tests__/backfill-order-payloads.test.js \
  scripts/__tests__/backfill-variant-demand-projection.test.js \
  functions/repositories/__tests__/order-queries.display-model.test.js \
  functions/repositories/__tests__/OrderStatsRepository.test.js \
  functions/repositories/__tests__/order-mutations.test.js \
  functions/repositories/__tests__/order-inventory-flow.test.js \
  functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js \
  functions/repositories/__tests__/product-import-merge.test.js \
  functions/services/__tests__/OrderProcurementDomainService.test.js \
  functions/services/__tests__/PurchaseOrderShortageClosureService.test.js \
  functions/services/__tests__/OrderProcurementReceiptReversalService.test.js \
  functions/services/__tests__/DemandService.test.js \
  functions/services/__tests__/InventoryBusinessWorkflow.test.js \
  functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js \
  functions/services/__tests__/ProductCatalogService.decomposition.audit.test.js \
  functions/services/__tests__/ProductCatalogService.put-boundaries.test.js \
  functions/lib/db/__tests__/query-observability.test.js

node scripts/check-migration-prefixes.mjs
```

- [ ] **Step 2: Update `docs/reviews/2026-04-16-backend-performance-issue-audit.md` so issues `10-17` move from `deferred` to implemented / closed with evidence**
- [ ] **Step 3: Update this plan with completion notes and final residual-risk summary**
- [ ] **Step 4: Commit the remediation wave or waves with small, reviewable commit boundaries rather than one monolithic commit**
