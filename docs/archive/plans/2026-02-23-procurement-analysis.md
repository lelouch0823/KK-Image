# 订货总览 (Goods Overview) 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 新增"订货总览"模块，从**已确认且已绑定商品**的订单中聚合需求量，并按订单状态（生产中/运输中/已到货等）形成管道视图，帮助管理端掌握各商品的供应全链路状态。

**架构:** 后端新建 `/api/manage/goods-overview` API 端点，使用 SQL 聚合 `orders`（已绑定 `product_id`、状态为 `confirmed`/`production`/`shipping`/`arrived`）与 `products` 表数据。前端新建 `GoodsOverview.vue` 视图，包含管道概览卡片 + 分状态 Tab + 可筛选/导出的分析表格。作为侧边栏独立菜单"订货总览"，路由 `/admin/goods-overview`。

**技术栈:** Cloudflare D1 (SQL 聚合查询) / Hono 路由 / Vue 3 Composition API / Tailwind CSS v4

---

## 功能放置位置

新增 **侧边栏独立菜单项**「订货总览」，位于"订单管理"之后、"客户管理"之前。

- **权限**：仅 `admin` 和 `manager` 角色可见
- **图标**：采购/物流相关图标（卡车或仓库）

---

## 核心业务逻辑

### 订单筛选条件

> [!IMPORTANT]
> 只统计**已确认 + 已绑定商品**的订单，排除以下情况：
>
> - ❌ `pending`（未确认，可能被废弃或删除）
> - ❌ `rejected`（已驳回）
> - ❌ `void`（已作废）
> - ❌ `delivered`（已交付，完成的不纳入当前需求）
> - ❌ `product_id IS NULL`（未绑定系统商品的订单）

**有效状态:** `confirmed`、`production`、`shipping`、`arrived`

### 管道视图数据模型

按 `product_id` 分组后，统计每个商品在各状态下的订单数量和需求量：

| 维度             | 说明                                     |
| ---------------- | ---------------------------------------- |
| **已确认待生产** | `status = 'confirmed'` 的 quantity 总和  |
| **生产中**       | `status = 'production'` 的 quantity 总和 |
| **运输中**       | `status = 'shipping'` 的 quantity 总和   |
| **已到货**       | `status = 'arrived'` 的 quantity 总和    |
| **总需求**       | 以上四项之和                             |
| **缺口**         | 总需求 - 当前库存                        |

### 核心 SQL

```sql
SELECT
  p.id, p.name, p.sku, p.brand, p.category,
  p.stock_quantity, p.alert_threshold, p.images,
  COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN o.quantity ELSE 0 END), 0) as confirmed_qty,
  COALESCE(SUM(CASE WHEN o.status = 'production' THEN o.quantity ELSE 0 END), 0) as production_qty,
  COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN o.quantity ELSE 0 END), 0) as shipping_qty,
  COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN o.quantity ELSE 0 END), 0) as arrived_qty,
  COALESCE(SUM(o.quantity), 0) as total_demand,
  COUNT(o.id) as order_count,
  COALESCE(SUM(o.quantity), 0) - p.stock_quantity as shortage
FROM products p
INNER JOIN orders o ON o.product_id = p.id
  AND o.status IN ('confirmed', 'production', 'shipping', 'arrived')
WHERE p.status = 'active'
GROUP BY p.id
ORDER BY shortage DESC, total_demand DESC
```

> 注意：使用 `INNER JOIN` 而非 `LEFT JOIN`，因为只关心有活跃订单的商品。

---

## 涉及文件总览

| 操作       | 路径                                                 | 说明                |
| ---------- | ---------------------------------------------------- | ------------------- |
| **NEW**    | `functions/lib/hono/routes/manage/goods-overview.js` | 订货总览 API        |
| **MODIFY** | `functions/lib/hono/app.js`                          | 注册路由            |
| **NEW**    | `src/views/GoodsOverview.vue`                        | 订货总览视图        |
| **NEW**    | `src/composables/useGoodsOverview.js`                | 数据获取 composable |
| **MODIFY** | `src/router/index.js`                                | 添加前端路由        |
| **MODIFY** | `src/components/layout/Sidebar.vue`                  | 添加菜单项          |
| **MODIFY** | `src/utils/constants.js`                             | 添加 API 常量       |
| **MODIFY** | `src/locales/zh-CN/`                                 | 中文翻译            |
| **MODIFY** | `src/locales/en/`                                    | 英文翻译            |

---

## Proposed Changes

### 后端 API

#### [NEW] [goods-overview.js](file:///Users/kayla/Downloads/Code/KK-Image/functions/lib/hono/routes/manage/goods-overview.js)

三个端点：

**`GET /` — 商品管道分析列表**

返回每个有活跃订单的商品的分状态需求统计。支持 query params：

- `category` — 按分类筛选
- `brand` — 按品牌筛选
- `status` — 按订单状态筛选（仅看 production 或 shipping 等）
- `shortageOnly` — 仅显示缺货商品

**`GET /summary` — 管道概览统计**

返回：

- `totalProducts` — 有活跃订单的商品总数
- `totalDemand` — 总需求量
- `shortageCount` — 缺货商品数
- `byStatus` — 各状态下的订单数/需求量小计
  - `{ confirmed: {count, qty}, production: {count, qty}, shipping: {count, qty}, arrived: {count, qty} }`

**`GET /export` — CSV 导出**

导出完整分析表格为 CSV。

---

#### [MODIFY] [app.js](file:///Users/kayla/Downloads/Code/KK-Image/functions/lib/hono/app.js)

```diff
+import manageGoodsOverviewRoutes from './routes/manage/goods-overview.js';

+app.route('/api/manage/goods-overview', manageGoodsOverviewRoutes);
```

---

### 前端 - 数据层

#### [MODIFY] [constants.js](file:///Users/kayla/Downloads/Code/KK-Image/src/utils/constants.js)

```diff
+  // 订货总览
+  MANAGE_GOODS_OVERVIEW: `${API_PREFIX}/goods-overview`,
+  MANAGE_GOODS_OVERVIEW_SUMMARY: `${API_PREFIX}/goods-overview/summary`,
+  MANAGE_GOODS_OVERVIEW_EXPORT: `${API_PREFIX}/goods-overview/export`,
```

#### [NEW] [useGoodsOverview.js](file:///Users/kayla/Downloads/Code/KK-Image/src/composables/useGoodsOverview.js)

提供：`items`, `summary`, `loading`, `filters`, `loadData()`, `exportCSV()`

---

### 前端 - 视图层

#### [NEW] [GoodsOverview.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/views/GoodsOverview.vue)

页面结构：

1. **管道概览卡片** (4 个)
   - 🟡 待生产 (confirmed) — 数量
   - 🔵 生产中 (production) — 数量
   - 🟣 运输中 (shipping) — 数量
   - 🟢 已到货 (arrived) — 数量

2. **筛选/操作栏**
   - 品牌/分类下拉
   - 仅缺货 toggle
   - 导出 CSV 按钮

3. **数据表格**

   | 商品名称  | SKU       | 品牌   | 库存 | 待生产 | 生产中 | 运输中 | 已到货 | 总需求 | 缺口  | 状态   |
   | --------- | --------- | ------ | ---- | ------ | ------ | ------ | ------ | ------ | ----- | ------ |
   | Birkin 25 | BK-25-BLK | Hermès | 2    | 3      | 5      | 2      | 1      | 11     | **9** | 🔴缺货 |
   - **缺口 > 0** → 红色「缺货」标签 + 数字高亮
   - **缺口 ≤ 0 但库存 < alert_threshold** → 黄色「预警」标签
   - **缺口 ≤ 0** → 绿色「充足」标签

4. **空状态** — 无活跃订单时显示友好提示

样式参考 `ProductStats.vue` / `OrderManager.vue` 设计语言。

---

### 前端 - 路由和导航

#### [MODIFY] [index.js](file:///Users/kayla/Downloads/Code/KK-Image/src/router/index.js)

在 `orders` 路由之后添加：

```diff
+{
+  path: 'goods-overview',
+  name: 'GoodsOverview',
+  component: () => import('@/views/GoodsOverview.vue'),
+  meta: { titleKey: 'router.goods_overview', roles: ['admin', 'manager'] },
+},
```

#### [MODIFY] [Sidebar.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/layout/Sidebar.vue)

在 `orders` 菜单项 (L261-266) 之后添加 `goods-overview` 菜单项，使用物流/仓库图标。

---

### 国际化

添加中英文翻译键，涵盖：

- 侧边栏/路由标题：`订货总览` / `Goods Overview`
- 页面标题/副标题
- 统计卡片：待生产/生产中/运输中/已到货
- 表格列头
- 状态标签：缺货/预警/充足
- 筛选选项
- 导出按钮

---

## Verification Plan

### 手动验证

1. `pnpm run dev:full` 启动开发服务器
2. **admin 角色登录** → 确认侧边栏出现"订货总览"菜单
3. **点击菜单** → 跳转 `/admin/goods-overview`
4. **管道卡片** → 确认 4 个状态卡片数字与数据库一致
5. **表格数据** → 校验某个商品的各状态需求量:
   - 到数据库直接查询: `SELECT status, SUM(quantity) FROM orders WHERE product_id = 'xxx' AND status IN ('confirmed','production','shipping','arrived') GROUP BY status`
   - 对比页面显示的数字
6. **排除验证** → 确认 `pending`/`rejected`/`void`/`delivered` 状态和 `product_id IS NULL` 的订单不参与统计
7. **筛选** → 测试品牌/分类下拉和"仅缺货"toggle
8. **导出** → 点击导出，下载 CSV 并核对内容
9. **权限** → `sales`/`viewer` 角色确认看不到此菜单
10. **暗色模式** → 切换暗色主题，确认样式正常
11. **响应式** → 缩小窗口到移动端宽度，确认布局适配

### 构建验证

```bash
pnpm run build
```

---

## Task Breakdown (分步任务)

### Task 1: 后端 API

**Files:**

- Create: `functions/lib/hono/routes/manage/goods-overview.js`
- Modify: `functions/lib/hono/app.js`

实现 `GET /`、`GET /summary`、`GET /export` 三个端点，注册路由。

Commit: `feat: add goods overview API`

---

### Task 2: 前端数据层

**Files:**

- Create: `src/composables/useGoodsOverview.js`
- Modify: `src/utils/constants.js`

添加 API 常量，创建 composable。

Commit: `feat: add goods overview composable and constants`

---

### Task 3: 国际化

**Files:**

- Modify: `src/locales/zh-CN/` 和 `src/locales/en/` 相关文件

添加所有翻译键。

Commit: `feat: add goods overview i18n`

---

### Task 4: 前端视图

**Files:**

- Create: `src/views/GoodsOverview.vue`

包含管道卡片 + 筛选栏 + 数据表格 + 空状态。

Commit: `feat: add goods overview view`

---

### Task 5: 路由和导航

**Files:**

- Modify: `src/router/index.js`
- Modify: `src/components/layout/Sidebar.vue`

添加路由和侧边栏菜单项。

Commit: `feat: add goods overview route and sidebar`

---

### Task 6: 构建验证和修复

`pnpm run build` + 手动测试。

Commit (if needed): `fix: goods overview refinements`
