# kk-life API Reference

本文档给第三方脚本、联调人员和运维同学提供一份快速可查的接口总览。

## 1. 鉴权

### 管理端

- 路径：`/api/manage/*`
- 方式：
  - `Authorization: Bearer <admin-jwt>`
  - Cookie 会话
  - `X-API-Key`

### 销售端

- 路径：`/api/sales/:token/*`
- 方式：
  - 路径中的 `:token`
  - `Authorization: Bearer <sales-jwt>`

### 公开空间

- 路径：`/api/space/:token`
- 方式：
  - share token
  - 如空间加密，再通过 `POST` body 提交密码

## 2. 常用接口

### 管理端

- `GET /api/manage/dashboard/overview`
- `GET /api/manage/orders`
- `GET /api/manage/orders/:id`
- `POST /api/manage/orders`
- `PATCH /api/manage/orders/:id/status`
- `POST /api/manage/orders/:id/lines/:lineId/reserve`
- `POST /api/manage/orders/:id/lines/:lineId/release`
- `POST /api/manage/orders/:id/lines/:lineId/ship`
- `GET /api/manage/products`
- `GET /api/manage/goods-overview`
- `GET /api/manage/purchase-orders`
- `POST /api/manage/purchase-orders/:id/receipts`
- `POST /api/manage/purchase-orders/:id/receipts/:receiptId/reversal`
- `POST /api/manage/purchase-orders/:id/shortage-closures`
- `POST /api/manage/purchase-orders/:id/allocate`
- `GET /api/manage/outbox`
- `POST /api/manage/audit-replay/dry-run`
- `POST /api/manage/audit-replay/execute`
- `GET /api/manage/audit-logs`
- `GET /api/manage/audit-logs/export`
- `GET /api/manage/webhooks`
- `POST /api/manage/webhooks/:id/test`

### 销售端

- `POST /api/sales/login`
- `POST /api/sales/wechat-login`
- `POST /api/sales/:token/auth`
- `GET /api/sales/:token/auth`
- `POST /api/sales/:token/bind-wechat`
- `GET /api/sales/:token/orders`
- `POST /api/sales/:token/orders`
- `GET /api/sales/:token/orders/:id`
- `PATCH /api/sales/:token/orders/:id/read`
- `PATCH /api/sales/:token/orders/:id`
- `DELETE /api/sales/:token/orders/:id`
- `POST /api/sales/:token/orders/:id/comment`
- `POST /api/sales/:token/upload`
- `GET /api/sales/:token/stats`
- `GET /api/sales/:token/spaces`

### 公开空间

- `GET /api/space/:token`
- `POST /api/space/:token`

## 3. 当前架构约定

- 订单详情读模型默认包含 `lines`
- 采购单详情读模型默认包含 `items` 与 `receipts`
- 采购与履约进度优先来自 `order_lines`
- 关键写操作通过 durable outbox 异步驱动通知、缓存失效、Webhook 与补充审计

## 4. 本地联调

```bash
pnpm dev:all
pnpm test:real-api:full-chain
```
