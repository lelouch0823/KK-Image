# Management API

> Base URL: `/api/manage`
> Auth: Bearer Token / Basic Auth / `X-API-Key`

本文档聚焦当前管理端真实可用的核心接口，并特别标记订单行级模型与 outbox 运维相关入口。

## 1. 仪表盘

### 获取概览数据
`GET /api/manage/dashboard/overview`

### 获取订单统计
`GET /api/manage/orders/stats`

返回值通常包含：

- 今日新增
- 待处理数量
- 状态分布
- 最近 30 天趋势

## 2. 订单管理

### 获取订单列表
`GET /api/manage/orders`

Query Params:

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | int | 页码，默认 `1` |
| `limit` | int | 每页条数，默认 `20` |
| `salesperson` | string | 销售员 ID |
| `status` | string | 订单主状态，如 `pending`、`confirmed`、`delivered` |
| `procurementStatus` | string | 采购/履约进度筛选，实际会映射到订单行聚合状态 |
| `search` | string | 订单号/内容搜索 |
| `startTime` | timestamp | 起始时间 |
| `endTime` | timestamp | 结束时间 |

说明：

- 列表侧优先使用 `order_lines` 聚合得到的展示状态
- `orders.procurement_status` 仅保留为兼容性聚合字段

### 导出订单
`GET /api/manage/orders/export`

Query Params:

- `salesperson`
- `status`
- `procurementStatus`
- `search`
- `from`
- `to`

### 获取订单详情
`GET /api/manage/orders/:id`

返回值除了订单头字段外，还会包含：

- `lines`
- `files`
- `timeline`

### 创建订单
`POST /api/manage/orders`

常用 Body 字段：

```json
{
  "productName": "定制海报",
  "salespersonId": "sp_xxx",
  "status": "pending",
  "quantity": 2,
  "productId": "prod_xxx",
  "variantId": "var_xxx",
  "fileIds": ["file_1", "file_2"]
}
```

说明：

- 创建时会写入 `orders + order_lines + order_files + order_timeline`
- 后续通知/缓存/Webhook 由 durable outbox 异步驱动

### 更新订单字段
`PATCH /api/manage/orders/:id`

Body 示例：

```json
{
  "updates": {
    "name": "新名称",
    "quantity": 3
  },
  "reason": "客户要求修改"
}
```

### 更新订单状态
`PATCH /api/manage/orders/:id/status`

Body 示例：

```json
{
  "status": "confirmed",
  "note": "审核通过"
}
```

### 添加留言
`POST /api/manage/orders/:id/comment`

Body:

```json
{
  "comment": "已联系客户确认尺寸"
}
```

### 订单行履约命令

这些命令是行级履约的一等入口，不复用整单状态 PATCH：

- `POST /api/manage/orders/:id/lines/:lineId/reserve`
- `POST /api/manage/orders/:id/lines/:lineId/release`
- `POST /api/manage/orders/:id/lines/:lineId/ship`

Body 示例：

```json
{
  "quantity": 2
}
```

说明：

- `reserve` / `release` / `ship` 都通过 `OrderLineFulfillmentService` 执行
- 行级命令会刷新 `order_lines.reserved_qty` / `shipped_qty` 与分配记录 `order_line_allocations`
- `ship` 会同时扣减实际库存并消耗需求侧预留
- 命令成功后发布 `order_line_fulfillment_updated` outbox 事件，由 `cache` consumer 异步刷新读模型
- 路由层不直接调用 `invalidateCache()`

### 批量更新
`POST /api/manage/orders/batch`

Body 示例：

```json
{
  "ids": ["order_1", "order_2"],
  "action": "status",
  "value": "confirmed",
  "reason": "批量审核通过"
}
```

## 3. 销售人员管理

### 获取销售列表
`GET /api/manage/salespersons`

### 创建销售员
`POST /api/manage/salespersons`

### 获取销售详情
`GET /api/manage/salespersons/:id`

### 更新销售
`PATCH /api/manage/salespersons/:id`

### 删除销售
`DELETE /api/manage/salespersons/:id`

### 重置访问 Token
`POST /api/manage/salespersons/:id/reset-token`

## 4. 客户管理

### 获取客户列表
`GET /api/manage/customers`

### 搜索客户
`GET /api/manage/customers/search?q=keyword`

### 获取客户详情
`GET /api/manage/customers/:id`

### 创建客户
`POST /api/manage/customers`

### 更新客户
`PUT /api/manage/customers/:id`

### 删除客户
`DELETE /api/manage/customers/:id`

## 5. 文件上传

### 检查文件哈希
`POST /api/manage/check-hash`

### 上传文件
`POST /api/manage/upload`

Form Data:

- `file`
- `folder_id`（可选）

## 6. 商品、订货总览与库存

### 商品管理
`GET /api/manage/products`
`POST /api/manage/products`

### 变体管理
`GET /api/manage/products/:id/variants`
`POST /api/manage/products/:id/variants`

### 订货总览
`GET /api/manage/goods-overview`

说明：

- 订货总览和采购建议已经基于 `order_lines` 剩余需求计算，不再只看订单头数量

### 库存分类账
`GET /api/manage/inventory/ledger`

## 7. 采购单管理

### 获取采购单列表
`GET /api/manage/purchase-orders`

### 获取采购统计
`GET /api/manage/purchase-orders/stats`

### 获取采购建议
`GET /api/manage/purchase-orders/suggestions`

### 获取采购单详情
`GET /api/manage/purchase-orders/:id`

返回值默认包含：

- `items`
- `receipts`
- 聚合后的进度字段，如 `ordered_qty`、`received_qty`、`display_status`

### 创建采购单
`POST /api/manage/purchase-orders`

### 从预订单生成采购单
`POST /api/manage/purchase-orders/from-orders`

Body 示例：

```json
{
  "order_ids": ["ord_1", "ord_2"],
  "remark": "按本周已确认需求汇总"
}
```

### 更新采购单基础信息
`PUT /api/manage/purchase-orders/:id`

### 更新采购单状态
`PATCH /api/manage/purchase-orders/:id/status`

### 添加采购单明细
`POST /api/manage/purchase-orders/:id/items`

### 更新采购单明细
`PATCH /api/manage/purchase-orders/:id/items/:itemId`

### 删除采购单明细
`DELETE /api/manage/purchase-orders/:id/items/:itemId`

### 记录收货
`POST /api/manage/purchase-orders/:id/receipts`

Body 示例：

```json
{
  "items": [
    {
      "purchase_order_item_id": "poi_1",
      "received_qty": 5,
      "note": "首批到货"
    }
  ]
}
```

说明：

- 该命令会写入 `purchase_receipts`
- 同步更新 `inventory_ledger`
- 关联更新 `order_lines`
- 再聚合投影 `orders.procurement_status`
- 通知 / 缓存 / Webhook 通过 outbox 异步处理

### 冲销收货
`POST /api/manage/purchase-orders/:id/receipts/:receiptId/reversal`

### 重新分摊成本
`POST /api/manage/purchase-orders/:id/allocate`

## 8. 通知与运维

### 管理端通知
`GET /api/manage/notifications`

### Webhook 配置与测试

- `GET /api/manage/webhooks`
- `GET /api/manage/webhooks/:id`
- `POST /api/manage/webhooks`
- `PUT /api/manage/webhooks/:id`
- `DELETE /api/manage/webhooks/:id`
- `POST /api/manage/webhooks/:id/test`

说明：

- `GET /api/manage/webhooks` 会返回当前 `supportedEvents`
- `/test` 不依赖订阅事件命中，会直接发送 `webhook.test` 载荷用于联通性检查
- 真实业务链路中的 Webhook 投递仍然来自 durable outbox 的 `webhook` consumer

### 查询 outbox 事件
`GET /api/manage/outbox`

Query Params:

- `eventType`
- `consumerName`
- `status`

### 查询 outbox 事件详情
`GET /api/manage/outbox/:eventId`

### 重放预演
`POST /api/manage/audit-replay/dry-run`

### 执行重放
`POST /api/manage/audit-replay/execute`

说明：

- `audit-replay/execute` 属于高风险运维操作
- 适用于修复通知/Webhook/缓存消费者历史缺失，而不是重写业务事实

补充说明：

- 管理端 UI 对应页面为 `/admin/outbox-ops`

## 9. 标准真实 API 回归

推荐的本地运维检查：

```bash
pnpm dev:all
pnpm test:real-api:full-chain
```

这组回归会覆盖：

- 文件上传与移动
- 商品创建与变体读取
- 订单创建、确认与订单行读取
- 从订单生成采购单、部分收货、最终收货、冲销幂等
- 订单行预留 / 出货
- 管理端通知物化
- Webhook 测试投递与全链业务事件投递

## 10. 备份

### 触发数据库备份
`POST /api/manage/backups`

### 获取备份列表
`GET /api/manage/backups`
