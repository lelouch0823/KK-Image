# Unit Test Baseline Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 恢复 `pnpm test:unit` 全量单测基线为全绿，同时保证修复遵循 SOTA 原则，解决前端交互语义、状态单源、后端领域约束、权限一致性和异步副作用治理的根因问题。

**Architecture:** 这次修复按“前端真实交互契约 -> 后端领域与权限边界 -> 全量回归”三层推进。前端不回退到旧 DOM，而是恢复稳定的可访问交互语义和单一状态源；后端把不变量、回滚边界和审计副作用放回正确的仓储/服务层；最后通过全量 Vitest 验证仓库基线。

**Tech Stack:** Vue 3, Vue Test Utils, Vitest, Hono, Cloudflare Workers, OPA metadata/policy, existing repositories and route modules

---

### Task 1: 恢复 ImportPreviewStep 的冲突筛选真实交互入口

**Files:**
- Modify: `src/components/product/import/__tests__/ImportPreviewStep.test.js`
- Modify: `src/components/product/import/ImportPreviewStep.vue`

**Step 1: Write the failing test**

在 `src/components/product/import/__tests__/ImportPreviewStep.test.js` 中把失败用例收紧为真实契约：

```js
it('supports conflict filtering and searching controls through stable inputs', async () => {
  const wrapper = mount(ImportPreviewStep, { ... });

  const searchInput = wrapper.get('[data-testid="conflict-search-input"]');
  const levelSelect = wrapper.get('[data-testid="conflict-level-select"]');

  await levelSelect.setValue('variant');
  expect(wrapper.text()).toContain('SKU-V');
  expect(wrapper.text()).not.toContain('SPU-P');

  await searchInput.setValue('price');
  expect(wrapper.text()).toContain('price');
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/product/import/__tests__/ImportPreviewStep.test.js`

Expected: FAIL，因为当前缺少稳定的测试/可访问入口。

**Step 3: Write minimal implementation**

在 `src/components/product/import/ImportPreviewStep.vue` 中：

1. 为搜索输入补 `data-testid="conflict-search-input"`
2. 为层级筛选补稳定交互入口
   - 如果 `AppSelect` 已支持透传 attrs，则直接加 `data-testid`
   - 如果不支持，则恢复原生 `<select>` 语义入口

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/components/product/import/__tests__/ImportPreviewStep.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/product/import/__tests__/ImportPreviewStep.test.js src/components/product/import/ImportPreviewStep.vue
git commit -m "fix(test-baseline): restore import preview filter semantics"
```

---

### Task 2: 恢复 VariantBatchBuilderModal 和 ProductBasicInfoSection 的表单语义

**Files:**
- Modify: `src/components/product/__tests__/VariantBatchBuilderModal.test.js`
- Modify: `src/components/product/VariantBatchBuilderModal.vue`
- Modify: `src/components/product/__tests__/ProductBasicInfoSection.contract.test.js`
- Modify: `src/components/product/ProductBasicInfoSection.vue`

**Step 1: Write the failing tests**

对两个测试都改成要求稳定语义入口：

```js
await wrapper.get('[data-testid="default-status-select"]').setValue('active');
await wrapper.get('[data-testid="currency-select"]').setValue('USD');
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/product/__tests__/VariantBatchBuilderModal.test.js src/components/product/__tests__/ProductBasicInfoSection.contract.test.js`

Expected: FAIL，因为当前 `AppSelect` 封装没有暴露稳定入口。

**Step 3: Write minimal implementation**

1. 在 `VariantBatchBuilderModal.vue` 为状态选择器补稳定入口
2. 在 `ProductBasicInfoSection.vue` 为货币选择器补稳定入口
3. 如果当前 `AppSelect` 无法透传原生交互，则局部改回原生 `<select>`，保留样式但优先真实语义

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/components/product/__tests__/VariantBatchBuilderModal.test.js src/components/product/__tests__/ProductBasicInfoSection.contract.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/product/__tests__/VariantBatchBuilderModal.test.js src/components/product/VariantBatchBuilderModal.vue src/components/product/__tests__/ProductBasicInfoSection.contract.test.js src/components/product/ProductBasicInfoSection.vue
git commit -m "fix(test-baseline): restore product form select semantics"
```

---

### Task 3: 修复 SalesListView 可访问尺寸契约与 ProductCreateModal 变体图片单源状态

**Files:**
- Modify: `src/components/order/__tests__/sales-a11y.test.js`
- Modify: `src/views/sales/SalesListView.vue`
- Modify: `src/components/product/__tests__/ProductCreateModal.variant-images.test.js`
- Modify: `src/components/product/ProductCreateModal.vue`
- Modify: `src/composables/useProductForm.js`

**Step 1: Write the failing tests**

保持现有红灯，但把第二个问题明确为状态单源：

```js
expect(mocks.updateProduct).toHaveBeenCalledWith(
  'prod_1',
  expect.objectContaining({
    variants: expect.arrayContaining([
      expect.objectContaining({
        _clientKey: 'local-1',
        images: [{ image_id: 'img-local', is_primary: 1, sort_order: 0 }],
      }),
    ]),
  })
);
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/order/__tests__/sales-a11y.test.js src/components/product/__tests__/ProductCreateModal.variant-images.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. `SalesListView.vue`
   - 确认真正主触控按钮不是误选 close/icon button
   - 为主要交互按钮恢复 `min-h-11`
2. `useProductForm.js`
   - `handleUpdateVariantImages` 统一只改 `form.variants`
   - unsaved variant 必须通过 `_clientKey`/`variantKey` 命中同一对象
3. `ProductCreateModal.vue`
   - 不再保留会与 `form.variants` 脱节的图片副本

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/components/order/__tests__/sales-a11y.test.js src/components/product/__tests__/ProductCreateModal.variant-images.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/order/__tests__/sales-a11y.test.js src/views/sales/SalesListView.vue src/components/product/__tests__/ProductCreateModal.variant-images.test.js src/components/product/ProductCreateModal.vue src/composables/useProductForm.js
git commit -m "fix(test-baseline): restore sales touch target and variant image state"
```

---

### Task 4: 修复 ProductVariantRepository 空 SKU 不变量

**Files:**
- Modify: `functions/repositories/__tests__/product-variant-code.test.js`
- Modify: `functions/repositories/ProductVariantRepository.js`

**Step 1: Write the failing test**

在现有失败用例上明确要求自动派生 SKU：

```js
await repo.createBatch('product-1', [{ id: 'variant-empty', sku: '' }]);
const insertStmt = db.batch.mock.calls[0][0][0];
expect(insertStmt.params[2]).toMatch(/^SKU-/);
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/repositories/__tests__/product-variant-code.test.js`

Expected: FAIL，因为当前空 SKU 直接抛错。

**Step 3: Write minimal implementation**

在 `ProductVariantRepository.js` 中：

1. 保留显式 SKU 优先
2. 当 SKU 为空时基于 `variantId` 生成稳定的 fallback SKU
3. 确保 `createBatch` 和 `syncVariants` 共用同一规则

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/repositories/__tests__/product-variant-code.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/repositories/__tests__/product-variant-code.test.js functions/repositories/ProductVariantRepository.js
git commit -m "fix(test-baseline): guarantee fallback variant sku generation"
```

---

### Task 5: 对齐 metadata.json 与 OPA 权限决策

**Files:**
- Modify: `functions/lib/authz/__tests__/metadata-consistency.test.js`
- Modify: `policy/metadata.json`
- Modify: `policy/authz.rego` (only if root cause is policy side, not metadata side)

**Step 1: Write the failing test**

保留现有一致性测试红灯，不改期待语义。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/authz/__tests__/metadata-consistency.test.js`

Expected: FAIL，当前已观测 `auditor -> audit:read` 不一致。

**Step 3: Write minimal implementation**

1. 对比 `metadata.json` 中 `auditor` 权限声明
2. 对比 `policy/authz.rego` 中 `audit:*` 判定
3. 只改真正偏离源头的一侧，保证 metadata 与 OPA 再次一致

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/authz/__tests__/metadata-consistency.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/authz/__tests__/metadata-consistency.test.js policy/metadata.json policy/authz.rego
git commit -m "fix(test-baseline): align authz metadata with opa decisions"
```

---

### Task 6: 修复 product patch rollback 边界

**Files:**
- Modify: `functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/repositories/ProductVariantRepository.js` (if rollback contract lives there)

**Step 1: Write the failing test**

保留现有红灯，并补一条断言确保 rollback 不注入旧库存快照。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. 梳理 `[id].js` patch 流程里 variant sync 前后的快照来源
2. 失败回滚时只回退本次 patch 产生的数据，不回放旧的 inventory snapshot
3. 确保 rollback 输入来自当前请求上下文，而不是历史查询结果副本

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js functions/lib/hono/routes/manage/products/[id].js functions/repositories/ProductVariantRepository.js
git commit -m "fix(test-baseline): harden product patch rollback boundaries"
```

---

### Task 7: 修复 order batch audit 未处理 rejection

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/_shared/audit-helpers.js`

**Step 1: Write the failing test**

在 `order-batch-routes.test.js` 中增加/收紧断言，要求 audit 副作用异常不会形成未处理 rejection。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`

Expected: FAIL，并复现 `stmt.bind(...).run is not a function` 的未处理 rejection。

**Step 3: Write minimal implementation**

1. 在 `audit-helpers.js` 中显式守护 `scheduleAuditEvent`
2. `waitUntil` / fire-and-forget 路径必须自行捕获并记录错误
3. 不让主请求链路泄露未处理 Promise rejection

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`

Expected: PASS，且没有 unhandled rejection。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/_shared/audit-helpers.js
git commit -m "fix(test-baseline): guard async audit side effects"
```

---

### Task 8: 恢复全量 unit test 基线

**Files:**
- Modify: `docs/plans/2026-03-16-unit-test-baseline-recovery-implementation-plan.md`

**Step 1: Run targeted frontend tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  src/components/product/import/__tests__/ImportPreviewStep.test.js \
  src/components/product/__tests__/VariantBatchBuilderModal.test.js \
  src/components/product/__tests__/ProductBasicInfoSection.contract.test.js \
  src/components/order/__tests__/sales-a11y.test.js \
  src/components/product/__tests__/ProductCreateModal.variant-images.test.js
```

Expected: all PASS。

**Step 2: Run targeted backend tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  functions/repositories/__tests__/product-variant-code.test.js \
  functions/lib/authz/__tests__/metadata-consistency.test.js \
  functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js \
  functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js
```

Expected: all PASS。

**Step 3: Run full unit suite**

Run: `pnpm test:unit`

Expected: PASS，全量单测恢复为绿色基线。

**Step 4: Record verification notes**

把实际命令与结果写回计划文件底部，记录：

1. 每一批通过的测试命令
2. `pnpm test:unit` 最终结果
3. 若还存在剩余失败，明确列出并停止继续实施计划

**Step 5: Commit**

```bash
git add docs/plans/2026-03-16-unit-test-baseline-recovery-implementation-plan.md
git commit -m "docs: record unit test baseline recovery verification"
```

---

## Verification Notes

- 已执行：`node node_modules/vitest/vitest.mjs run src/components/product/import/__tests__/ImportPreviewStep.test.js src/components/product/__tests__/VariantBatchBuilderModal.test.js src/components/product/__tests__/ProductBasicInfoSection.contract.test.js src/components/order/__tests__/sales-a11y.test.js src/components/product/__tests__/ProductCreateModal.variant-images.test.js`
  - 结果：5 个测试文件通过，14 个测试通过，0 失败
- 已执行：`node node_modules/vitest/vitest.mjs run functions/repositories/__tests__/product-variant-code.test.js functions/lib/authz/__tests__/metadata-consistency.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
  - 结果：4 个测试文件通过，14 个测试通过，0 失败
- 已执行：`node node_modules/vitest/vitest.mjs run functions/repositories/__tests__/product-variant-code.test.js functions/repositories/__tests__/variant-external-codes.test.js functions/lib/hono/routes/manage/products/__tests__/product-patch-rollback-boundary.test.js functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js`
  - 结果：4 个测试文件通过，19 个测试通过，0 失败
- 已执行：`node node_modules/vitest/vitest.mjs run src/components/product/__tests__/ProductCreateModal.variant-images.test.js src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
  - 结果：2 个测试文件通过，5 个测试通过，0 失败
- 已执行：`node node_modules/eslint/bin/eslint.js src/components/product/import/ImportPreviewStep.vue src/components/product/VariantBatchBuilderModal.vue src/components/product/ProductBasicInfoSection.vue src/components/ui/SearchInput.vue src/composables/useProductForm.js functions/repositories/ProductVariantRepository.js functions/services/ProductCatalogService.js functions/lib/hono/_shared/audit-helpers.js functions/lib/authz/generated/policy-artifact.js functions/lib/hono/routes/manage/products/product-schema.js`
  - 结果：0 errors，0 warnings
- 已执行：`pnpm test:unit`
  - 结果：PASS，全量 Vitest 基线恢复为绿色

## Scope Status

- 已完成：前端交互语义与状态单源修复
- 已完成：后端 SKU 规则分层、权限产物同步、回滚边界与 audit 副作用治理
- 已完成：`pnpm test:unit` 全量基线恢复
