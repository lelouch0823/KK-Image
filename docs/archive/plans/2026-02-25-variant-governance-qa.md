# Variant Governance QA Evidence

**Date:** 2026-02-25  
**Scope:** Features #2-#8 (variant availability, naming, replenishment rules, pricing strategy, external codes, batch builder, audit)

## DB Verification
1. Pre-check (before migration 0045):
   - Command: `npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE name='variant_audit_logs';"`
   - Result: empty `results` (table not present)
2. Apply migration:
   - Command: `npx wrangler d1 migrations apply DB --local`
   - Result: `0045_variant_audit_logs.sql` applied (`✅`)
3. Schema check:
   - Command: `npx wrangler d1 execute DB --local --command "PRAGMA table_info(variant_audit_logs);"`
   - Result: columns `id, variant_id, product_id, actor_type, actor_id, action, changes_json, created_at` present

## TDD Evidence by Task
### Task 6: Variant Pricing Strategy
- RED:
  - `pnpm test:unit functions/services/__tests__/variant-pricing-strategy.test.js`
  - Result: 2 failed (expected)
- GREEN + refactor verification:
  - `pnpm test:unit functions/services/__tests__/variant-pricing-strategy.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - Result: 2 files / 5 tests passed

### Task 7: External Codes
- RED:
  - `pnpm test:unit functions/repositories/__tests__/variant-external-codes.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
  - Result: failed assertions on missing fields/columns (expected)
- GREEN:
  - same command
  - Result: 2 files / 4 tests passed

### Task 8: Batch Variant Builder
- RED:
  - `pnpm test:unit src/components/product/__tests__/VariantBatchBuilderModal.test.js`
  - Result: component unresolved (expected)
- GREEN:
  - same command
  - Result: 1 file / 2 tests passed

### Task 9: Variant Audit Logging
- RED:
  - `pnpm test:unit functions/repositories/__tests__/variant-audit.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js`
  - Result: missing repository/import failures (expected)
- GREEN:
  - same command
  - Result: 2 files / 4 tests passed

## Final Targeted Suite
- Command:
  - `pnpm test:unit functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js functions/repositories/__tests__/PurchaseOrderRepository.variant-required.test.js functions/repositories/__tests__/variant-external-codes.test.js functions/repositories/__tests__/variant-audit.test.js src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/components/product/__tests__/VariantBatchBuilderModal.test.js functions/services/__tests__/variant-pricing-strategy.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
- Result: 9 files / 18 tests passed

## Manual Smoke Status
- `pnpm run dev:all`: not executed in this verification batch.
