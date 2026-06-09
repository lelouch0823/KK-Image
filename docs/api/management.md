# Management API

> Base URL: `/api/manage`
>
> Auth: Admin JWT / Basic Auth / `X-API-Key`

本文档只列出当前仓库中已实现、且仍建议外部依赖的管理端接口。

## 1. 仪表盘与统计

- `GET /api/manage/dashboard/overview`
- `GET /api/manage/orders/stats`
- `GET /api/manage/stats`
- `GET /api/manage/stats/uploads`

## 2. 文件与共享空间

### 文件相关

- `GET /api/manage/files`
- `POST /api/manage/upload`
- `POST /api/v1/files/check-hash`

说明：

- 文件秒传预检位于 `/api/v1/files/check-hash`，不是旧文档中的 `/api/manage/check-hash`
- 管理端上传接口支持 `orderId`、`spaceId`、`context` 等 query 参数

### 共享空间相关

- `GET /api/manage/spaces`
- `POST /api/manage/spaces`
- `GET /api/manage/spaces/:id`
- `PUT /api/manage/spaces/:id`
- `DELETE /api/manage/spaces/:id`

## 3. 订单管理

- `GET /api/manage/orders`
- `GET /api/manage/orders/export`
- `GET /api/manage/orders/:id`
- `POST /api/manage/orders`
- `PATCH /api/manage/orders/:id`
- `PATCH /api/manage/orders/:id/status`
- `POST /api/manage/orders/:id/comment`
- `POST /api/manage/orders/batch`

### 订单行履约命令

- `POST /api/manage/orders/:id/lines/:lineId/reserve`
- `POST /api/manage/orders/:id/lines/:lineId/release`
- `POST /api/manage/orders/:id/lines/:lineId/ship`
- `POST /api/manage/orders/:id/lines/:lineId/unship`
- `POST /api/manage/orders/:id/lines/:lineId/return`

说明：

- 订单详情默认返回 `lines`
- 行级履约不复用整单状态变更接口
- 采购展示状态优先来自 `order_lines` 聚合投影

## 4. 客户与销售员

### 客户

- `GET /api/manage/customers`
- `GET /api/manage/customers/search?q=keyword`
- `GET /api/manage/customers/:id`
- `GET /api/manage/customers/:id/orders`
- `POST /api/manage/customers`
- `PUT /api/manage/customers/:id`
- `DELETE /api/manage/customers/:id`

### 销售员

- `GET /api/manage/salespersons`
- `GET /api/manage/salespersons/:id`
- `POST /api/manage/salespersons`
- `PATCH /api/manage/salespersons/:id`
- `DELETE /api/manage/salespersons/:id`
- `POST /api/manage/salespersons/:id/reset-token`

## 5. 商品、缺口与采购

### 商品

- `GET /api/manage/products`
- `POST /api/manage/products`
- `GET /api/manage/products/:id`
- `PUT /api/manage/products/:id`
- `GET /api/manage/products/:id/variants`
- `POST /api/manage/products/:id/variants`

### 订货总览

- `GET /api/manage/goods-overview`

说明：

- 当前仓库对外暴露的是商品和订货总览读模型
- 商品列表里的 `status`、价格、库存和库存筛选来自 `product_projection` 的 active variant 聚合；不要把 `products.status` 当作当前商品可见性的唯一事实源
- 批量变体状态变更会刷新受影响商品投影，并通过 outbox cache event 携带 `product_ids` 失效相关读模型
- 文档里曾出现的 `GET /api/manage/inventory/ledger` 在当前代码中并不存在，不应继续依赖

### 采购单

- `GET /api/manage/purchase-orders`
- `GET /api/manage/purchase-orders/stats`
- `GET /api/manage/purchase-orders/suggestions`
- `GET /api/manage/purchase-orders/:id`
- `POST /api/manage/purchase-orders`
- `POST /api/manage/purchase-orders/from-orders`
- `PUT /api/manage/purchase-orders/:id`
- `PATCH /api/manage/purchase-orders/:id/status`
- `POST /api/manage/purchase-orders/:id/items`
- `PATCH /api/manage/purchase-orders/:id/items/:itemId`
- `DELETE /api/manage/purchase-orders/:id/items/:itemId`
- `POST /api/manage/purchase-orders/:id/receipts`
- `POST /api/manage/purchase-orders/:id/receipts/:receiptId/reversal`
- `POST /api/manage/purchase-orders/:id/shortage-closures`
- `POST /api/manage/purchase-orders/:id/allocate`

说明：

- 采购单详情默认包含 `items` 与 `receipts`
- 收货、冲销和 shortage closure 都属于显式命令接口
- 收货 / 冲销 / 成本分摊等副作用由 durable outbox 异步驱动

## 6. Webhook、通知、审计与运维

### Webhook

- `GET /api/manage/webhooks`
- `GET /api/manage/webhooks/:id`
- `POST /api/manage/webhooks`
- `PUT /api/manage/webhooks/:id`
- `DELETE /api/manage/webhooks/:id`
- `POST /api/manage/webhooks/:id/test`

### 通知

- `GET /api/manage/notifications`
- `POST /api/manage/notifications`
- `POST /api/manage/notifications/:id/read`

### 审计

- `GET /api/manage/audit-logs`
- `GET /api/manage/audit-logs/actions`
- `GET /api/manage/audit-logs/export`

### Outbox / Replay

- `GET /api/manage/outbox`
- `GET /api/manage/outbox/:eventId`
- `POST /api/manage/audit-replay/dry-run`
- `POST /api/manage/audit-replay/execute`

管理端页面对应：

- `/admin/audit-logs`
- `/admin/outbox-ops`

## 7. 本地验证

```bash
pnpm dev:all
pnpm test
pnpm test:real-api:fast
```

`pnpm test:real-api:fast` 需要 `pnpm dev:all` 或 `pnpm start` 提供可访问 Worker。需要本地 Worker / HTTP 高保真验收时，再运行 `pnpm build`、`pnpm start` 和
`pnpm test:real-api:full-chain:blackbox`。
