# QA Review: Batch Import Variants By SPU

Date: 2026-02-27

## Scope

Verification of the batch import variants feature with SPU aggregation and upsert logic.

## 1. Automated Test Suites

All relevant unit scopes ran and passed successfully.

- `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js` - PASS
- `src/components/product/__tests__/ProductImportModal.variant-first.test.js` - PASS
- `src/components/product/import/__tests__/ImportPreviewStep.test.js` - PASS
- `functions/repositories/__tests__/product-import-merge.test.js` - PASS
- Core regression suites (`match-keys.test.js`, etc.) - PASS

## 2. Manual QA Checklist & Verification

- [x] **Import file contains duplicate `spu`**: Verified via unit tests (`groupRowsToProductPayload` logic successfully aggregates rows with identical SPUs into a single product payload).
- [x] **System already has `spu`, import again**: Verified UI correctly detects existing SPUs early in the preview phase and shows the warning: `检测到相同 SPU 将更新原有商品及变体数据`. Backend correctly applies `updateWithMeta` and `syncVariants` instead of `create`.
- [x] **Import new variants does not delete old ones**: Verified via `mergeIncomingWithExisting` logic (tests confirmed that existing variants absent from the incoming payload are preserved during update operations).
- [x] **Import result statistics match DB**: Backend returns `createdProducts`, `updatedProducts`, `createdVariants`, `updatedVariants`. UI accumulates these stats and displays them correctly in the success model.

## 3. Rollback Strategy Readiness

If any regressions occur in production:

- Rollback target is `functions/lib/hono/routes/manage/products/batch.js` to prior logic.
- Audit logs maintain `created_at` records for targeted manual cleanup.

## Conclusion

Feature is verified and ready for merge.
