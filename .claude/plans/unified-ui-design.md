# UI 设计统一化方案

## 目标
消除各模块间的 UI 不一致，让设计系统真正落地，所有页面共享统一的视觉语言。

## 发现的问题清单

### P0 - 修复 Bug
1. **`--bg-input` token 未定义** — 12 处使用了 `bg-(--bg-input)` 但该 token 从未在 `semantic.css` 中定义，导致输入框背景透明
2. **`useToast` 缺少 `info()` 方法** — ToastContainer 支持 info 类型，但 composable 没有暴露该方法

### P1 - 统一组件使用
3. **内联 badge 替换为 StatusBadge** — ErpSync、OAuthApps、StocktakeManager 使用手写 badge 样式
4. **内联 button 替换为 AppButton** — SalesDetailView 有手写按钮样式（router-link 场景）
5. **内联 empty state 替换为 EmptyState 组件** — ErpSync、OAuthApps、StocktakeManager 使用手写空状态
6. **内联 loading state 统一** — ErpSync、OAuthApps 使用 spinner，StocktakeManager 使用 spinner，应统一为 Skeleton 组件

### P2 - Token 与样式统一
7. **卡片圆角统一为 `rounded-2xl`** — ErpSync、OAuthApps 的卡片使用 `rounded-lg`，应统一为设计系统的 `rounded-2xl`
8. **GoodsOverview 统计网格改用 StatGroup** — 当前使用自定义 `grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4`
9. **Stats 页面统一使用 MetricTile** — 顶部 3 个 AppStatCard 改为 MetricTile，消除同一页面两种统计卡组件

### P3 - 清理
10. **删除 main.css 中未使用的 `.btn-*` CSS 类** — 这些是旧代码，已被 AppButton 组件替代

---

## 修改计划

### 第 1 步：修复 token 和 composable（P0）

**文件：`src/styles/tokens/semantic.css`**
- 添加 `--bg-input: var(--bg-card);` 到 `:root` 块中
- 影响范围：OrderPaymentCard、OrderLogisticsCard、ErpSync、WebhookSettings、CustomerDetailContent（共 12 处）

**文件：`src/composables/useToast.ts`**
- 添加 `info()` 方法，与 `success()` / `error()` / `warning()` 一致

### 第 2 步：统一 ErpSync（P1 + P2）

**文件：`src/views/ErpSync.vue`**
- 加载状态：spinner+text → Skeleton 组件（import Skeleton，用 v-if 模板替换）
- 空状态：手写 icon+text → EmptyState 组件
- 卡片圆角：`rounded-lg` → `rounded-2xl`（第 33 行）
- 状态 badge（第 39-48 行）：内联样式 → StatusBadge 组件
  - enabled → `StatusBadge variant="success"`
  - disabled → `StatusBadge variant="neutral" outline`
- 标签 adapterType、syncDirection（第 49-54 行）：保留内联样式（这些是信息标签，不是状态）

### 第 3 步：统一 OAuthApps（P1 + P2）

**文件：`src/views/OAuthApps.vue`**
- 加载状态：spinner+text → Skeleton 组件
- 空状态：手写 icon+text → EmptyState 组件
- 卡片圆角：`rounded-lg` → `rounded-2xl`（第 30 行）
- 状态 badge（第 36-45 行）：内联样式 → StatusBadge 组件
  - enabled → `StatusBadge variant="success"`
  - disabled → `StatusBadge variant="neutral" outline`

### 第 4 步：统一 StocktakeManager（P1）

**文件：`src/views/StocktakeManager.vue`**
- 加载状态（第 66-70 行）：spinner → Skeleton 组件
- 空状态（第 73-79 行）：手写 icon+text → EmptyState 组件
- 列表项状态 badge（第 93-99 行）：内联样式 → StatusBadge 组件
  - 使用已有的 `statusTone()` 函数映射到 StatusBadge 的 variant

### 第 5 步：统一 SalesDetailView（P1）

**文件：`src/views/sales/SalesDetailView.vue`**
- 第 33-37 行 router-link 上的手写按钮样式 → 使用简洁的 Tailwind 类
- AppButton 是 `<button>` 元素不能替代 router-link，保留 router-link 但简化样式为与 `.btn-primary` 一致的类

### 第 6 步：统一统计卡组件（P2）

**文件：`src/views/Stats.vue`**
- 顶部 3 个 AppStatCard（第 51-98 行）→ MetricTile
  - `AppStatCard label="..." value="..." variant="info"` → `MetricTile label="..." value="..." icon="document-text" tone="info" flat`
  - footer 插槽内容移到 meta 插槽
- 移除 AppStatCard import，添加 MetricTile import（已有）

**文件：`src/views/GoodsOverview.vue`**
- 自定义统计网格（第 75 行）→ `<StatGroup :columns="4">`
- 移除 scoped CSS 中的 `.skeleton-shimmer` 样式（第 789-816 行）

### 第 7 步：清理死代码（P3）

**文件：`src/styles/main.css`**
- 删除 `@layer components` 中的 `.btn`、`.btn-primary`、`.btn-secondary`、`.btn-danger`、`.btn-ghost`、`.input` 类（第 145-172 行）
- 保留 `input[type='date']` 样式（第 174-190 行）

---

## 验证方式

1. `pnpm lint` — 确保无 lint 错误
2. `pnpm test:unit:run` — 确保单元测试通过
3. `pnpm dev:all` — 启动开发服务器，手动检查：
   - ErpSync 页面的卡片、badge、空状态、加载状态
   - OAuthApps 页面同上
   - Stats 页面统计卡样式统一
   - GoodsOverview 统计网格布局正确
   - SalesDetailView 空状态按钮样式正确
   - 所有输入框有正确的背景色
