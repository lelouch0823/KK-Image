# Sales API

> Base URL: `/api/sales`

销售端接口分为两组：

1. Public Auth Routes
2. Protected Business Routes（挂在 `/api/sales/:token/*`）

## 1. 认证

### 用户名/手机号登录
`POST /api/sales/login`

### 微信登录
`POST /api/sales/wechat-login`

### access token 登录
`POST /api/sales/:token/auth`

### 获取当前销售员信息
`GET /api/sales/:token/auth`

### 绑定微信
`POST /api/sales/:token/bind-wechat`

## 2. 订单

> 所有业务接口都需要 `Authorization: Bearer <JWT>`

### 获取订单列表
`GET /api/sales/:token/orders`

Query Params:

- `page`
- `limit`
- `status`

### 创建订单
`POST /api/sales/:token/orders`

Body 示例：

```json
{
  "name": "定制海报",
  "brand": "KK",
  "series": "2026 春季",
  "sku": "SKU-001",
  "size": "50x70cm",
  "color": "黑色",
  "material": "相纸",
  "remark": "加急",
  "deadline": "2026-04-10",
  "quantity": 2,
  "fileIds": ["file_1", "file_2"],
  "productId": "prod_xxx",
  "variantId": "var_xxx"
}
```

说明：

- 创建时默认会生成 1 条兼容性 `order_lines`
- 后续采购/部分到货/冲销进度都基于订单行推进
- 管理员通知、缓存失效、Webhook 通过 outbox 异步处理

### 获取订单详情
`GET /api/sales/:token/orders/:id`

返回值包含：

- 订单头字段
- `lines`
- `files`
- `timeline`

### 标记已读
`PATCH /api/sales/:token/orders/:id/read`

### 更新订单
`PATCH /api/sales/:token/orders/:id`

### 删除/作废订单
`DELETE /api/sales/:token/orders/:id`

### 添加评论
`POST /api/sales/:token/orders/:id/comment`

## 3. 文件上传

### 上传文件
`POST /api/sales/:token/upload`

支持 `FormData` 上传。

常见用途：

- 先上传图片
- 再把返回的 `fileIds` 带入订单创建请求

## 4. 其他业务接口

### 获取个人统计
`GET /api/sales/:token/stats`

### 获取销售端商品数据
`GET /api/sales/:token/products`

### 获取销售端通知
`GET /api/sales/:token/notifications`
