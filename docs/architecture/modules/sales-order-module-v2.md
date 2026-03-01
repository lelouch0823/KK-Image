# 销售订单模块 V2 架构说明

## 1. 背景与目标

本次 V2 重构目标：

- 统一销售端订单 API 调用返回结构，避免页面层重复判断。
- 用状态机明确异步状态流转，减少“加载中/空态/错误态”分叉。
- 增加运行时错误边界，避免单组件异常导致整页白屏。
- 保持可灰度、可回滚，保障业务连续性。

## 2. 三层架构

### 2.1 API 层

文件：`src/composables/sales/useSalesOrderApi.js`

统一接口：

- `request(url, options)` -> `{ ok, data, error, status }`

覆盖能力：

- `auth/login`
- `list/detail/create/comment`
- `stats/products/productDetail`

### 2.2 状态机层

文件：`src/composables/sales/useSalesOrderStateMachine.js`

状态：

- `idle`
- `loading`
- `ready`
- `empty`
- `error`
- `recovering`

动作：

- `loadOrders`
- `createOrder`
- `loadDetail`
- `comment`
- `retry`

### 2.3 视图层

核心文件：

- `src/views/Sales.vue`
- `src/views/sales/SalesListView.vue`
- `src/views/sales/SalesFormView.vue`
- `src/views/sales/SalesDetailView.vue`

关键公共组件：

- `src/components/common/AppErrorBoundary.vue`
- `src/components/common/AsyncStatePanel.vue`

## 3. Feature Flag

文件：`src/config/feature-flags.js`

- Flag：`SALES_ORDER_V2`
- 默认：`true`（V2 默认开启）
- 环境变量可回切：`VITE_SALES_ORDER_V2=false`

解析规则：

- `'true'/'1'` -> 开启
- `'false'/'0'` -> 关闭
- 未设置 -> 使用默认值（当前为开启）

## 4. 后端契约稳定性

销售路由统一错误结构：

- `{ success: false, error, code }`

涉及文件：

- `functions/lib/hono/routes/sales/orders.js`
- `functions/lib/hono/routes/sales/products.js`

## 5. 可靠性设计

- 列表、详情、统计、通知全部具备 loading/empty/error/retry 明确状态。
- 评论失败与创建失败均保留用户输入并提供恢复动作。
- `markAsRead` 失败不再仅 `console`，改为可见告警与重试。
- 页面级错误通过 `AppErrorBoundary` 捕获并提供恢复入口。

## 6. 回滚策略

V2 回滚不需要发版：

1. 将 `VITE_SALES_ORDER_V2` 设为 `false`。
2. 重新构建并发布前端静态资源。
3. 观察 5 分钟核心指标（错误率、创建成功率、平均响应时延）。

详细执行步骤见：

- `docs/plans/2026-03-01-sales-order-module-rollout-checklist.md`
