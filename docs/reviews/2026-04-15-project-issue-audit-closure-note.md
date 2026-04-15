# 2026-04-15 Project Issue Audit Closure Note

## Status

- `01-25` 与 `30` 的修复已完成。
- `26-29` 已完成一轮 helper / read-model 抽离，但仍保留“大文件职责过载”的架构债，不再在本说明中宣称已完全关闭。
- 结案依据以本说明中的新鲜验证结果和对应审计测试为准。

## Closure Mapping

| Issue Range | Closure Evidence |
| --- | --- |
| 01-03 | `package.json`, `minisales/package.json`, `minisales/tsconfig.json`, `eslint.config.js`; root `lint` now includes `pnpm typecheck:minisales`, root `test` now runs `pnpm test:unit:run && mocha --exit`, and `ci-test` runs `pnpm test && pnpm check:minisales` behind local server startup |
| 04-10 | `package.json`, `scripts/deploy-verify.mjs`, `eslint.config.js`; fresh verification: targeted `eslint` PASS |
| 11-13 | `functions/storage/__tests__/defaults.test.js` |
| 14 | `functions/storage/index.js` now keys provider reuse by `env` object via `WeakMap`, removing cross-env cache bleed risk |
| 15 | `functions/lib/utils/__tests__/variant-meta-dedup.audit.test.js` |
| 16 | Existing cross-runtime purchase-order projection duplication has been closed in code; fresh decomposition coverage retained in `functions/services/__tests__/purchase-order-projection-dedup.audit.test.js` and surrounding repository/service split tests |
| 17 | `functions/_shared/__tests__/utils-barrel-dedup.audit.test.js` |
| 18-21 | `functions/api/utils/__tests__/json-dedup.audit.test.js`, `src/constants/__tests__/currency.audit.test.js` |
| 22 | `src/constants/__tests__/currency.audit.test.js` |
| 23-25 | `src/components/space/__tests__/SpaceDocument.test.js` |
| 26-29 | 已完成首轮抽离：`src/views/__tests__/PurchaseOrders.decomposition.audit.test.js`, `src/composables/__tests__/useProductForm.decomposition.audit.test.js`, `functions/services/__tests__/ProductCatalogService.decomposition.audit.test.js`, `functions/repositories/__tests__/PurchaseOrderRepository.decomposition.audit.test.js`；但对应主文件仍然偏大，继续作为 follow-up 架构债追踪，不在本 closure note 中记为 fully closed |
| 30 | fresh targeted `eslint` PASS on audited dead-code / invalid-suppression files |

## Fresh Verification Snapshot

- `pnpm exec eslint src/components/__tests__/OrderManager.design-system-migration.test.js functions/utils/__tests__/ai-utils-health.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js functions/api/utils/id.js functions/api/utils/file-utils.js functions/lib/hono/routes/manage/products/[id].js functions/repositories/order/mutations.js functions/utils/ai-utils.js`
  - PASS
- `pnpm exec vitest run functions/storage/__tests__/defaults.test.js src/components/space/__tests__/SpaceDocument.test.js src/constants/__tests__/currency.audit.test.js src/composables/__tests__/useProductForm.decomposition.audit.test.js src/views/__tests__/PurchaseOrders.decomposition.audit.test.js functions/services/__tests__/ProductCatalogService.decomposition.audit.test.js functions/repositories/__tests__/PurchaseOrderRepository.decomposition.audit.test.js functions/api/utils/__tests__/json-dedup.audit.test.js functions/lib/utils/__tests__/variant-meta-dedup.audit.test.js functions/_shared/__tests__/utils-barrel-dedup.audit.test.js`
  - PASS (`10` files / `14` tests)

## Follow-up Note

- `pnpm typecheck:minisales` 现已正确走 `tsconfig.json` 覆盖全量 TS 文件，说明“手工枚举文件导致逃逸”的问题已经关闭。
- 本轮已把 `minisales` 接入 root `lint` / `ci-test` 默认门禁。
- `26-29` 的“helper 已抽离”不等于“大文件已完成治理”；后续仍需继续拆分 [PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue)、[useProductForm.js](/home/bjw/Code/KK-Image/src/composables/useProductForm.js)、[ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js)、[PurchaseOrderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/PurchaseOrderRepository.js)。
