# KK-Image API Reference

本文档提供第三方客户端、自动化脚本和内部联调时最常用的接口总览。

## 1. 鉴权机制

### 1.1 管理端

管理端接口位于 `/api/manage/*`，支持：

- `Authorization: Bearer <admin-jwt>`
- Cookie 会话
- `X-API-Key`

### 1.2 销售端

销售端业务接口位于 `/api/sales/:accessToken/*`，需要：

1. 路径中的 `accessToken`
2. `Authorization: Bearer <sales-jwt>`

## 2. 核心接口总览

### 2.1 公共接口

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| GET | `/api/common/config` | 获取系统公开配置 |
| POST | `/api/sales/wechat-login` | 微信小程序登录 |

### 2.2 销售端接口

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| POST | `/api/sales/login` | 用户名/手机号登录 |
| POST | `/api/sales/:accessToken/auth` | access token 登录 |
| GET | `/api/sales/:accessToken/auth` | 获取当前销售员信息 |
| POST | `/api/sales/:accessToken/bind-wechat` | 绑定微信 |
| GET | `/api/sales/:accessToken/orders` | 获取订单列表 |
| POST | `/api/sales/:accessToken/orders` | 创建订单，默认会生成 1 条兼容性 `order_lines` |
| GET | `/api/sales/:accessToken/orders/:id` | 获取订单详情，包含 `lines` / `files` / `timeline` |
| POST | `/api/sales/:accessToken/upload` | 上传文件 |

### 2.3 管理端接口

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| GET | `/api/manage/dashboard/overview` | 仪表盘概览 |
| GET | `/api/manage/orders` | 订单列表，支持 `procurementStatus` |
| GET | `/api/manage/orders/:id` | 订单详情，包含 `lines` |
| POST | `/api/manage/orders` | 创建订单 |
| PATCH | `/api/manage/orders/:id` | 修改订单字段 |
| PATCH | `/api/manage/orders/:id/status` | 修改订单状态 |
| POST | `/api/manage/orders/:id/comment` | 添加订单评论 |
| GET/POST | `/api/manage/products` | 商品 SPU 管理 |
| GET/POST | `/api/manage/products/:id/variants` | 商品变体管理 |
| GET | `/api/manage/goods-overview` | 基于 `order_lines` 的订货总览 |
| GET | `/api/manage/inventory/ledger` | 库存分类账 |
| GET/POST | `/api/manage/purchase-orders` | 采购单列表 / 创建 |
| GET | `/api/manage/purchase-orders/:id` | 采购单详情，包含 `items` / `receipts` |
| POST | `/api/manage/purchase-orders/from-orders` | 从已确认订单生成采购单 |
| PUT | `/api/manage/purchase-orders/:id` | 修改采购单基础信息 |
| PATCH | `/api/manage/purchase-orders/:id/status` | 修改采购单状态 |
| POST | `/api/manage/purchase-orders/:id/receipts` | 记录收货 |
| POST | `/api/manage/purchase-orders/:id/receipts/:receiptId/reversal` | 冲销收货 |
| POST | `/api/manage/purchase-orders/:id/allocate` | 重新分摊成本 |
| GET | `/api/manage/outbox` | outbox 事件列表 |
| GET | `/api/manage/outbox/:eventId` | outbox 事件详情 |
| POST | `/api/manage/audit-replay/dry-run` | replay 预演 |
| POST | `/api/manage/audit-replay/execute` | replay 执行 |

## 3. 架构约定

### 3.1 订单模型

订单模块当前采用：

- `orders` 作为头信息和兼容读模型
- `order_lines` 作为采购/履约核心粒度

因此：

- 订单详情接口会返回 `lines`
- 采购进度筛选优先使用订单行聚合后的展示状态

### 3.2 副作用处理

订单创建、订单状态变化、采购收货、采购冲销等关键写操作会发布 durable outbox 事件，再由消费者异步处理：

- 通知
- 缓存失效
- Webhook
- Replay / 审计补充

客户端不应依赖这些副作用在主请求返回前同步完成。

## 4. 错误响应

统一错误响应形态：

```json
{
  "success": false,
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

常见状态码：

- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `429 Too Many Requests`
- `500 Internal Server Error`
