# Frontend Design System Next Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复本轮审查发现的残余回归，并继续推进前端设计系统 backlog，优先收敛共享 contract、页面级视觉原语和 minisales 状态样式分叉。

**Architecture:** 先修当前分支上的真实回归，再按“共享层 contract -> 高扩散页面/业务原语 -> 状态与表单契约 -> minisales token 收口 -> 护栏补强”的顺序推进。每一波都要求先补失败测试或 guardrail，再做最小实现，最后回跑对应窄验证和聚合 QA。

**Tech Stack:** Vue 3, Vitest, ESLint, Prettier, Tailwind-style utility classes, 自研 design-system/composed 组件, minisales 小程序控制层 / SCSS

---

### Task 1: 修复采购 shortage confirm 按钮 variant 回归

**Files:**
- Modify: `src/components/purchase-order/PurchaseOrderSupportOverlays.vue`
- Create or Modify: `src/components/purchase-order/__tests__/PurchaseOrderSupportOverlays.test.js`
- Verify: `src/components/ui/AppButton.vue`

- [ ] **Step 1: 写失败测试，锁定按钮必须使用受支持的 AppButton variant**

测试要点：
- shortage confirm footer 的主操作按钮存在
- 不触发 `AppButton` 非法 variant 警告
- 或直接断言 source / mount 结果不再出现 `variant="warning"`

- [ ] **Step 2: 运行测试确认红灯**

Run: `node node_modules/vitest/vitest.mjs run src/components/purchase-order/__tests__/PurchaseOrderSupportOverlays.test.js`
Expected: FAIL，能证明当前实现存在不合法 variant 或 warning

- [ ] **Step 3: 最小实现**

实现要求：
- 将 `src/components/purchase-order/PurchaseOrderSupportOverlays.vue` 中主按钮改为受支持的 variant
- 若需要 warning 语义，优先通过 `secondary/outline/danger` + token class 组合表达，不扩展随意 variant

- [ ] **Step 4: 回跑测试确认绿灯**

Run: `node node_modules/vitest/vitest.mjs run src/components/purchase-order/__tests__/PurchaseOrderSupportOverlays.test.js src/components/purchase-order/__tests__/PurchaseOrderOverlays.design-system.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/purchase-order/PurchaseOrderSupportOverlays.vue src/components/purchase-order/__tests__/PurchaseOrderSupportOverlays.test.js
git commit -m "fix: align shortage confirm button contract"
```

### Task 2: 收敛共享层第二视觉系统

**Files:**
- Modify: `src/styles/main.css`
- Modify: `src/components/ui/ProductSpecCard.vue`
- Modify: `src/components/ui/ProductSpecCardDemo.vue`
- Modify: `src/components/ui/StatusSelector.vue`
- Modify: `src/components/ui/AppCard.vue`
- Modify: `src/components/ui/AppStatCard.vue`
- Modify: `src/components/ui/StatusBadge.vue`
- Modify: `src/design-system/composed/MetricTile.vue`
- Modify: `src/components/ui/PermissionDeniedState.vue`
- Test: `src/components/ui/__tests__/*design-system*.test.js`

- [ ] **Step 1: 为共享 contract 补失败测试**

测试至少覆盖：
- 不再依赖 `.material-symbols-outlined`
- `StatusBadge` / `MetricTile` / `AppCard` 不暴露 ad hoc color palette
- `PermissionDeniedState` 操作按钮必须走 `AppButton`

- [ ] **Step 2: 运行共享层窄测试确认红灯**

Run: `node node_modules/vitest/vitest.mjs run src/components/ui/__tests__/*.test.js src/design-system/**/__tests__/*.test.js`
Expected: 至少有新增用例失败，证明 contract 尚未收敛

- [ ] **Step 3: 最小实现**

实现要求：
- 删除或停用 `.material-symbols-outlined` 回退通道
- 统一共享卡片 / badge / selector / metric tile 的 tone token
- 去掉共享层自写 hex / rgba glow / 本地 svg / 第二套按钮样式

- [ ] **Step 4: 回跑共享层验证**

Run:
- `node node_modules/vitest/vitest.mjs run <共享层新增测试>`
- `node scripts/qa/check-ui-token-integrity.mjs`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/styles/main.css src/components/ui src/design-system/composed
git commit -m "refactor: normalize shared ui contracts"
```

### Task 3: 清理高可见字体和图标残留

**Files:**
- Modify: `src/components/common/ai/AIChart.vue`
- Modify: `src/components/product/VariantBatchBuilderModal.vue`
- Modify: `src/views/GoodsOverview.vue`
- Verify: `src/components/product/ProductTable.vue`
- Verify: `src/components/product/ProductCreateModal.vue`
- Verify: `src/components/product/ProductDetail.vue`

- [ ] **Step 1: 写失败测试或 guardrail**

实现一个窄 guardrail / source test，拦截：
- `font-[Outfit]`
- JS fallback brand colors
- 业务层本地 icon 字体回退

- [ ] **Step 2: 跑红灯**

Run: `node scripts/qa/check-ui-token-integrity.mjs`
Expected: FAIL，覆盖当前残留文件

- [ ] **Step 3: 最小实现**

实现要求：
- `AIChart` 改为设计系统允许的字体与颜色来源
- 高可见页面与商品链路移除 `font-[Outfit]`

- [ ] **Step 4: 回跑**

Run:
- `node scripts/qa/check-ui-token-integrity.mjs`
- `./node_modules/.bin/eslint --max-warnings 0 src/components/common/ai/AIChart.vue src/components/product/VariantBatchBuilderModal.vue src/views/GoodsOverview.vue`

- [ ] **Step 5: 提交**

```bash
git add src/components/common/ai/AIChart.vue src/components/product/VariantBatchBuilderModal.vue src/views/GoodsOverview.vue scripts/qa/check-ui-token-integrity.mjs
git commit -m "refactor: remove residual typography and chart token drift"
```

### Task 4: 收敛页面层 dashboard / stats 视觉原语

**Files:**
- Modify: `src/views/Dashboard.vue`
- Modify: `src/views/Stats.vue`
- Modify: `src/views/stats/**`
- Create or Modify: `src/design-system/composed/*`
- Test: `src/views/__tests__/*dashboard*` `src/views/__tests__/*stats*`

- [ ] **Step 1: 写失败测试或 source contract test**

覆盖：
- 页面层不再直接写 blob / 渐变 / ad hoc shadow / 页面级 palette
- 优先复用统一 card / metric / state / section 原语

- [ ] **Step 2: 红灯确认**

Run: `node node_modules/vitest/vitest.mjs run src/views/__tests__/*.test.js`
Expected: 新增 contract test FAIL

- [ ] **Step 3: 最小实现**

实现要求：
- 把页面内部重复卡片、指标块、空态块抽到共享 composed 层
- 页面只负责布局和数据编排，不再承载视觉原语定义

- [ ] **Step 4: 回跑**

Run:
- `node node_modules/vitest/vitest.mjs run <views相关测试>`
- `node scripts/qa/check-ui-foundation-usage.mjs`

- [ ] **Step 5: 提交**

```bash
git add src/views src/design-system/composed scripts/qa/check-ui-foundation-usage.mjs
git commit -m "refactor: converge dashboard and stats page primitives"
```

### Task 5: 收敛 Web 端高扩散表单与状态契约

**Files:**
- Modify: `src/components/order/OrderForm.vue`
- Modify: `src/components/product/VariantBatchBuilderModal.vue`
- Verify: `src/components/product/ProductVariantTable.vue`
- Verify: `src/components/OrderStatusChanger.vue`
- Verify: `src/components/SpaceProductEditor.vue`
- Test: 对应 `__tests__` 文件

- [ ] **Step 1: 为原生控件回流补 guardrail / 测试**

覆盖：
- 高频表单链路不再直接使用 raw `button/input/select/textarea`
- 状态展示统一走 `StatusBadge` 或共享状态映射

- [ ] **Step 2: 运行红灯**

Run: `node scripts/qa/check-ui-foundation-usage.mjs`
Expected: FAIL，命中上述高风险文件

- [ ] **Step 3: 最小实现**

实现要求：
- 用 `AppButton`、`AppInput`、`AppSelect`、`Modal`、`ActionBar` 替换高频原生控件
- 把表单链路中的状态色映射上浮到共享函数或组件

- [ ] **Step 4: 回跑**

Run:
- `node scripts/qa/check-ui-foundation-usage.mjs`
- `./node_modules/.bin/eslint --max-warnings 0 src/components/order/OrderForm.vue src/components/product/VariantBatchBuilderModal.vue`
- 相关 Vitest

- [ ] **Step 5: 提交**

```bash
git add src/components/order/OrderForm.vue src/components/product/VariantBatchBuilderModal.vue scripts/qa/check-ui-foundation-usage.mjs
git commit -m "refactor: enforce web form and status foundation contracts"
```

### Task 6: 统一 minisales 状态配置与样式来源

**Files:**
- Modify: `minisales/miniprogram/utils/constants.ts`
- Modify: `minisales/miniprogram/components/sales/order-card/index.ts`
- Modify: `minisales/miniprogram/pages/detail/controller.ts`
- Modify: `minisales/miniprogram/pages/stats/controller.ts`
- Modify: `minisales/miniprogram/pages/stats/stats.scss`
- Possibly Create: `minisales/miniprogram/components/shared/status-chip/**`

- [ ] **Step 1: 写失败检测**

至少覆盖：
- 禁止返回 `background/color/border` style 字符串
- 只允许返回 `statusKey/tone`
- stats 卡片样式不再由 controller 内联拼接

- [ ] **Step 2: 跑红灯**

Run: `node scripts/qa/check-minisales-ui-contract.mjs`
Expected: FAIL，覆盖旧模式

- [ ] **Step 3: 最小实现**

实现要求：
- 统一状态配置来源到常量层
- 模板和 SCSS 通过 tone / token 渲染，不再拼 style 字符串
- 把 stats 卡片表面样式迁到共享样式层

- [ ] **Step 4: 回跑**

Run: `pnpm qa:check-minisales-ui-contract`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add minisales/miniprogram utils scripts/qa/check-minisales-ui-contract.mjs
git commit -m "refactor: unify minisales status and surface tokens"
```

### Task 7: 扩展护栏并回写审计文档

**Files:**
- Modify: `scripts/qa/check-ui-token-integrity.mjs`
- Modify: `scripts/qa/check-ui-foundation-usage.mjs`
- Modify: `docs/reviews/2026-04-16-frontend-design-system-audit.md`

- [ ] **Step 1: 先为新增护栏写 fixture / source test**

覆盖：
- 本地 `svg`
- `font-[Outfit]`
- 业务层原生控件
- 未定义 token / ad hoc palette

- [ ] **Step 2: 跑红灯**

Run:
- `node scripts/qa/check-ui-token-integrity.mjs`
- `node scripts/qa/check-ui-foundation-usage.mjs`

- [ ] **Step 3: 最小实现**

实现要求：
- 护栏只对白名单外的高风险文件报错
- 审计文档顶部“当前分支执行结果”同步新增完成波次和仍存 backlog

- [ ] **Step 4: 回跑全量收口验证**

Run:
- `pnpm qa:check-design-system`
- `git diff --check`

- [ ] **Step 5: 提交**

```bash
git add scripts/qa/check-ui-token-integrity.mjs scripts/qa/check-ui-foundation-usage.mjs docs/reviews/2026-04-16-frontend-design-system-audit.md
git commit -m "chore: expand frontend design system guardrails"
```
