# brainstorm: 前端大文件拆分 (F1-F5)

## Goal

根据 CODEBASE-AUDIT-REPORT.md 中 [F1]-[F5] 的拆分方案，将 5 个前端大文件逐一拆分为更小的 composable/子组件/工具模块，**不改变现有功能**。降低单文件复杂度，提升可维护性。

## What I already know

### 文件清单（按优先级排序）

| # | 文件 | 行数 | 目标行数 | 复杂度 |
|---|------|------|----------|--------|
| F1 | `src/components/product/ProductImportModal.vue` | 1266 | ~250 | 高 |
| F2 | `src/views/Stats.vue` | 915 | ~270 | 中 |
| F3 | `src/composables/usePurchaseOrders.ts` | 680 | ~280 | 中 |
| F4 | `src/composables/useProductForm.ts` | 660 | ~350 | 中 |
| F5 | `src/views/PurchaseOrders.vue` | 903 | ~750 | 低 |

### 已有拆分模式（从 product-form/ 子目录确认）

- `src/composables/product-form/` 已有 6 个子模块：helpers.ts, dimensions.ts, variants.ts, archives.ts, archive-actions.ts, submission.ts
- 子模块通过 index barrel 或直接导入使用
- 类型定义可独立为 `*-types.ts` 文件

## Requirements

### F1: ProductImportModal.vue (1266 → ~250)

拆分为 4 个 composable + 1 个工具模块：
- `src/composables/product-import/useImportWorkflow.ts` — 步骤导航状态（~80 行）
- `src/composables/product-import/useImportParsing.ts` — 文件解析 + 字段映射（~350 行）
- `src/composables/product-import/useImportImageMatch.ts` — 图片匹配与上传（~130 行）
- `src/composables/product-import/useImportExecution.ts` — 导入执行（~250 行）
- `src/components/product/import/import-validators.ts` — 纯函数工具（~100 行）

### F2: Stats.vue (915 → ~270)

拆分为 1 个 composable + 3 个子组件：
- `src/composables/useStatsCharts.ts` — 图表创建逻辑（~470 行）
- `src/views/stats/StatsMetricSections.vue` — 指标卡片区块（~120 行）
- `src/views/stats/StatsTrafficSection.vue` — 流量趋势图表（~40 行）
- `src/views/stats/StatsSalesSection.vue` — 销售趋势+排行（~60 行）

### F3: usePurchaseOrders.ts (680 → ~280)

拆分为 types + 2 个子 composable：
- `src/composables/purchase-order/purchase-order-types.ts` — 类型定义（~155 行）
- `src/composables/purchase-order/usePurchaseOrderCrud.ts` — CRUD 操作（~90 行）
- `src/composables/purchase-order/usePurchaseOrderItems.ts` — 明细与收货操作（~170 行）

### F4: useProductForm.ts (660 → ~350)

拆分为 types + 1 个子 composable：
- `src/composables/product-form/product-form-types.ts` — 类型定义（~100 行）
- `src/composables/product-form/useProductFormOptions.ts` — 选项 CRUD 逻辑（~180 行）

### F5: PurchaseOrders.vue (903 → ~750)

微调（已有良好 composable 拆分基础）：
- `src/views/purchase-orders/usePurchaseOrderPageLifecycle.ts` — 生命周期与订阅逻辑（~80 行）
- `src/views/purchase-orders/detailHelpers.ts` — detailHelpers 对象构建（~30 行）

## Acceptance Criteria

- [ ] 每个文件拆分后行数接近目标值
- [ ] 所有现有功能不变（无行为变更）
- [ ] 拆分出的模块有清晰的接口（参数/返回值）
- [ ] 现有测试全部通过 `pnpm test:unit:run`
- [ ] Lint 通过 `pnpm lint`
- [ ] 每个文件拆分独立提交，方便 review

## Definition of Done

- 所有 5 个文件拆分完成
- 单元测试通过
- Lint 通过
- 无功能回归

## Out of Scope

- 后端大文件拆分（[F6]-[F10]，单独任务）
- 审计报告中的其他修复项（[H1]-[L13]）
- 新增测试（仅确保现有测试通过）
- 性能优化

## Technical Notes

- Vue 3 `<script setup>` 语法，composable 使用 Composition API
- 已有 `src/composables/product-form/` 拆分模式可参考
- 图表使用 Chart.js，Stats.vue 的图表逻辑需要在 composable 中正确处理 DOM ref 绑定时机
- ProductImportModal 的 composable 之间存在状态传递，需谨慎设计接口
- usePurchaseOrders 的 detail ref 有写穿逻辑（canWriteThroughDetail），拆分时需保持

## Implementation Plan

按优先级逐个文件拆分，每完成一个文件独立提交：

1. **F1: ProductImportModal.vue** — 最大文件，收益最高
2. **F2: Stats.vue** — 图表逻辑提取收益大
3. **F3: usePurchaseOrders.ts** — 类型+CRUD 提取
4. **F4: useProductForm.ts** — 已有子模块基础
5. **F5: PurchaseOrders.vue** — 微调，最后处理
