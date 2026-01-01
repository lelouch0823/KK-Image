# Sales API

> **Base URL**: `/api/sales/:token`
> **Token**: 销售人员的专属 Access Token

## 核心流程

### 1. 初始化/检查 Token
`GET /api/sales/:token/auth`

验证 Token 是否有效，并返回销售人员基础信息。

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sales_123",
    "name": "张三",
    "store": "旗舰店"
  }
}
```

### 2. 创建订单
`POST /api/sales/:token/orders`

**Body:**
```json
{
  "customer_name": "李四",
  "customer_phone": "13800138000",
  "products": [
    {
      "name": "定制相框",
      "sku": "FRAME-001",
      "price": 100
    }
  ],
  "remark": "加急"
}
```

### 3. 获取我的订单
`GET /api/sales/:token/orders`

**Query Params:**
- `page`: 页码
- `status`: 状态筛选

### 4. 获取订单详情
`GET /api/sales/:token/orders/:orderId`

### 5. 修正订单 (仅 Pending 状态)
`PUT /api/sales/:token/orders/:orderId`

允许销售人员在管理员确认前修正订单信息。
