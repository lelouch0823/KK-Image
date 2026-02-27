# Batch Import Variants By SPU Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将商品模块批量导入改为“批量导入变体”，导入时按 `spu` 归并到同一商品；若 `spu` 已存在则更新原有变体并新增未匹配变体，同时在前端明确提示“会更新原有变体数据”。

**Architecture:** 前端在导入解析后将行数据按 `spu` 聚合为“商品 + 变体列表”结构，并调用现有 `/api/manage/products/batch`。后端扩展 `batch` 路由为“按 spu upsert 商品并按规则 upsert 变体”，复用现有仓储与变体同步能力，返回细化统计结果。测试采用 TDD：先写失败用例，再最小实现通过，再重构。

**Tech Stack:** Vue 3 + Vitest + Hono + Cloudflare D1 + Repository Pattern

---

## Scope And Rules

- 同一 `spu` 的多行视为同一商品，导入时应归并。
- `spu` 已存在：更新该商品元信息（仅允许的字段）并执行变体更新/新增。
- `spu` 不存在：新建商品并创建变体。
- 变体匹配优先级：
1. `variant_code`
2. `sku`（同商品内）
3. `variant_signature`（由 `options_values` 生成）
- 导入时不删除线上已有变体（防止误删历史数据）。
- 前端预览必须提示：检测到相同 SPU 将更新原有变体数据。

## Data Contract (Target)

- 前端传给 `/api/manage/products/batch`：

```json
{
  "items": [
    {
      "name": "T恤",
      "spu": "SPU-1001",
      "category": "上装",
      "brand": "KK",
      "series": "2026春",
      "description": "可选",
      "currency": "CNY",
      "variants": [
        {
          "sku": "SKU-RED-M",
          "variant_code": "V0001",
          "price": 99,
          "cost_price": 60,
          "stock_quantity": 12,
          "alert_threshold": 2,
          "status": "active",
          "barcode": "690000000001",
          "supplier_sku": "SUP-RED-M",
          "options_values": { "color": "Red", "size": "M" },
          "images": [{ "image_id": "img_xxx", "is_primary": 1 }]
        }
      ]
    }
  ]
}
```

- 后端响应新增统计字段：

```json
{
  "success": true,
  "count": 20,
  "summary": {
    "createdProducts": 3,
    "updatedProducts": 5,
    "createdVariants": 8,
    "updatedVariants": 12,
    "failedProducts": 1
  },
  "errors": []
}
```

## Task 1: Frontend Mapping To Variant-First Payload

**Files:**
- Modify: `src/components/product/ProductImportModal.vue`
- Test: `src/components/product/__tests__/ProductImportModal.variant-first.test.js` (new)

**Step 1: Write the failing test**

- 新建测试，覆盖“按 `spu` 聚合 + 生成 `variants` 数组”。
- 断言：两行相同 `spu` 最终调用 `importProducts` 时只产生 1 个商品对象、2 个变体对象。

```js
it('groups rows by spu and sends variant-first payload', async () => {
  // arrange parsed rows
  // act handleImport
  // assert importProducts called with [{ spu: 'SPU-1', variants: [..2] }]
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/product/__tests__/ProductImportModal.variant-first.test.js`
Expected: FAIL，提示当前 payload 仍是逐行商品。

**Step 3: Write minimal implementation**

- 在 `ProductImportModal.vue` 增加纯函数（可放 `<script setup>` 顶部）：
1. `normalizeVariantFromRow(row)`
2. `groupRowsToProductPayload(rows)`
- `handleImport` 中用聚合后的 `groupedItems` 替代 `parsedItems`。
- 对 `spu` 为空的行：以“唯一临时 key”单独成组，避免错误合并。

核心实现示例：

```js
const buildGroupKey = (row, idx) => {
  const spu = String(row.spu || '').trim();
  return spu ? `spu:${spu}` : `row:${idx}`;
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/product/__tests__/ProductImportModal.variant-first.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductImportModal.vue src/components/product/__tests__/ProductImportModal.variant-first.test.js
git commit -m "feat(import): group rows by spu into variant-first payload"
```

## Task 2: Frontend UI Warning For Existing SPU Update Behavior

**Files:**
- Modify: `src/components/product/import/ImportPreviewStep.vue`
- Modify: `src/locales/zh-CN/product.js`
- Modify: `src/locales/en/product.js`
- Test: `src/components/product/import/__tests__/ImportPreviewStep.test.js` (new)

**Step 1: Write the failing test**

- 断言预览区域出现提示文案：
  - 中文：`检测到相同 SPU 将更新原有变体数据`
  - 英文对应文案。

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/product/import/__tests__/ImportPreviewStep.test.js`
Expected: FAIL，当前没有该提示。

**Step 3: Write minimal implementation**

- 在 `ImportPreviewStep.vue` 统计 `spu` 重复数量（仅用于提示）。
- 增加 warning 信息块。
- 文案使用 i18n key，如：
  - `product.import.spu_update_warning`

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/product/import/__tests__/ImportPreviewStep.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/import/ImportPreviewStep.vue src/locales/zh-CN/product.js src/locales/en/product.js src/components/product/import/__tests__/ImportPreviewStep.test.js
git commit -m "feat(import-ui): add warning that same spu updates existing variants"
```

## Task 3: Batch Route Contract Test For Upsert By SPU

**Files:**
- Modify: `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/products/batch.js`

**Step 1: Write the failing test**

新增用例：
- case A: `findBySpu` 命中时应执行“更新商品 + upsert 变体”而不是创建新商品。
- case B: `findBySpu` 未命中时创建商品并创建变体。
- case C: 返回 `summary.createdProducts/updatedProducts/createdVariants/updatedVariants`。

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
Expected: FAIL，`/batch` 目前仅 `createBatch(items)`。

**Step 3: Write minimal implementation**

在 `batch.js` 中替换旧逻辑：
- 注入 `ProductRepository` + `ProductVariantRepository`。
- 每个 item：
1. `spu` 非空则 `findBySpu(spu)`。
2. 命中：`updateWithMeta(productId, productFields)`。
3. 未命中：`create(productFields)`。
4. 读取现有 variants，按匹配优先级合并 id 后调用 `syncVariants`（保留线上未在本次导入中的变体，避免删）。

关键点：`syncVariants` 当前语义会删除“不在 incoming 的变体”，本任务需先实现“mergeIncomingWithExisting”后再 `syncVariants`。

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/products/batch.js functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js
git commit -m "feat(products-batch): upsert product variants by spu with summary stats"
```

## Task 4: Repository-Level Merge Logic Test

**Files:**
- Create: `functions/repositories/__tests__/product-import-merge.test.js`
- Modify: `functions/repositories/ProductVariantRepository.js` (only if extracted helper needed)
- Modify: `functions/lib/hono/routes/manage/products/batch.js`

**Step 1: Write the failing test**

- 针对“已有 variants + 导入 variants”合并函数测试：
1. 命中 `variant_code` 更新。
2. 无 `variant_code` 时按 `sku` 命中更新。
3. 无 `variant_code/sku` 时按 `variant_signature` 命中更新。
4. 未命中新增。
5. 旧变体未被删除。

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit functions/repositories/__tests__/product-import-merge.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- 在 `batch.js` 内部或独立 util 增加：
1. `buildVariantMatchKey(variant)`
2. `mergeIncomingWithExisting(existing, incoming)`

建议 key 顺序：

```js
variant_code -> sku -> product_id + variant_signature
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit functions/repositories/__tests__/product-import-merge.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/repositories/__tests__/product-import-merge.test.js functions/lib/hono/routes/manage/products/batch.js functions/repositories/ProductVariantRepository.js
git commit -m "test(import): cover variant upsert matching and merge preservation"
```

## Task 5: Import Result UI Stats Integration

**Files:**
- Modify: `src/components/product/ProductImportModal.vue`
- Modify: `src/components/product/import/ImportPreviewStep.vue`
- Test: `src/components/product/import/__tests__/ImportPreviewStep.test.js`

**Step 1: Write the failing test**

- 当返回 `summary` 时，UI 显示：
  - 新增商品
  - 更新商品
  - 新增变体
  - 更新变体

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/product/import/__tests__/ImportPreviewStep.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

- `ProductImportModal.handleImport` 聚合 chunk 响应的 `summary`。
- `ImportPreviewStep` 新增 summary 显示区域。

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/product/import/__tests__/ImportPreviewStep.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/ProductImportModal.vue src/components/product/import/ImportPreviewStep.vue src/components/product/import/__tests__/ImportPreviewStep.test.js
git commit -m "feat(import-ui): show created/updated product and variant summary"
```

## Task 6: Regression Coverage (Existing Behavior)

**Files:**
- Modify: `src/components/product/import/__tests__/match-keys.test.js`
- Modify: `functions/repositories/__tests__/product-spu.test.js` (如需)
- Modify: `functions/repositories/__tests__/product-variant-code.test.js` (如需)

**Step 1: Write the failing test**

- 确保导入后仍支持：
1. 图片匹配 key 不回退。
2. `spu` 唯一约束下的非导入创建流程不受影响。
3. `variant_code` 唯一冲突时可读错误保持一致。

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/product/import/__tests__/match-keys.test.js functions/repositories/__tests__/product-spu.test.js functions/repositories/__tests__/product-variant-code.test.js`
Expected: 至少一项 FAIL（如无 FAIL，可跳到下一步并记录“已绿”）。

**Step 3: Write minimal implementation**

- 仅修复被新逻辑破坏的点，避免扩大改动面。

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/product/import/__tests__/match-keys.test.js functions/repositories/__tests__/product-spu.test.js functions/repositories/__tests__/product-variant-code.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/product/import/__tests__/match-keys.test.js functions/repositories/__tests__/product-spu.test.js functions/repositories/__tests__/product-variant-code.test.js
git commit -m "test(regression): preserve import keys and spu/variant-code constraints"
```

## Task 7: End-To-End Verification Before Merge

**Files:**
- Modify: `docs/plans/2026-02-27-batch-import-variants-by-spu.md` (勾选记录)
- Optional: `docs/reviews/2026-02-27-batch-import-variants-by-spu-qa.md` (new)

**Step 1: Run focused unit suites**

Run:
- `pnpm test:unit functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`
- `pnpm test:unit src/components/product/__tests__/ProductImportModal.variant-first.test.js`
- `pnpm test:unit src/components/product/import/__tests__/ImportPreviewStep.test.js`

Expected: 全部 PASS (Verified)

**Step 2: Run broader related suites**

Run:
- `pnpm test:unit functions/repositories/__tests__/product-spu.test.js`
- `pnpm test:unit functions/repositories/__tests__/product-variant-code.test.js`
- `pnpm test:unit src/components/product/__tests__/ProductCreateModal.variant-first.test.js`

Expected: 全部 PASS (Verified)

**Step 3: Manual QA checklist**

- [x] 1. 导入文件含重复 `spu`，确认只生成一个商品。
- [x] 2. 系统已有 `spu`，再次导入后 UI 提示更新行为，且旧变体被正确更新。
- [x] 3. 导入新变体时不会删除旧变体。
- [x] 4. 导入结果统计与数据库结果一致。

**Step 4: Commit QA record**

```bash
git add docs/plans/2026-02-27-batch-import-variants-by-spu.md docs/reviews/2026-02-27-batch-import-variants-by-spu-qa.md
git commit -m "docs(qa): verify batch variant import by spu"
```

## Rollback Strategy

- 若上线后发现批量更新异常：
1. 临时回退 `batch.js` 到旧 `createBatch` 分支逻辑。
2. 保留前端提示但禁用“按 `spu` 聚合”开关（可加 feature flag）。
3. 对异常导入批次按 `created_at` 时间窗口导出审计并手工修复。

## Non-Goals

- 不在本任务中新增全新 API（如 `/batch-variants`）。
- 不修改单商品创建/编辑主流程语义。
- 不引入跨商品维度自动合并（仅按 `spu`）。

## Definition Of Done

- 导入按 `spu` 归并并支持“存在即更新，不存在即创建”。
- 前端有明确提示“相同 SPU 会更新原有变体数据”。
- 导入结果展示新增/更新统计。
- 单元测试与回归测试通过。
- QA 清单完成并留档。
