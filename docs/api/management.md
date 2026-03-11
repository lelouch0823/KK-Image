# Management API (管理端)

> **Base URL**: `/api/manage`
> **Auth**: Bearer Token (JWT) 或 Basic Auth
> **External**: 支持通过 `X-API-Key` 请求头进行外部调用

## 1. 仪表盘 (Dashboard)

### 获取概览数据
`GET /api/manage/dashboard/overview`

**Response:**
```json
{
  "success": true,
  "data": {
    "todayCount": 5,
    "pendingCount": 12,
    "weekCount": 35,
    "lastWeekCount": 28,
    "activeSharesCount": 3,
    "recentPendingOrders": [ ... ]
  }
}
```

---

## 2. 订单管理 (Orders)

### 获取订单列表
`GET /api/manage/orders`

**Query Params:**
| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | int | 页码 (default: 1) |
| `limit` | int | 每页条数 (default: 20) |
| `status` | string | 状态筛选 (`pending`, `confirmed`, `rejected`, `production`, `shipping`, `arrived`, `delivered`, `void`) |
| `search` | string | 搜索关键词 (订单号/客户名) |
| `salesperson_id` | string | 筛选指定销售的订单 |

### 获取订单详情
`GET /api/manage/orders/:id`

### 更新订单 (字段修改)
`PATCH /api/manage/orders/:id`

**Body:**
```json
{
  "current_data": { "name": "新名称", "color": "调整后的颜色" },
  "reason": "客户要求修改"
}
```
> 必须提供 `reason`，用于时间轴记录。

### 变更订单状态
`POST /api/manage/orders/:id/status`

**Body:**
```json
{
  "status": "production",
  "comment": "开始生产，预计3天完成"
}
```

### 添加留言
`POST /api/manage/orders/:id/comment`

**Body:**
```json
{
  "comment": "已联系客户确认尺寸"
}
```

### 批量更新状态
`POST /api/manage/orders/batch`

**Body:**
```json
{
  "ids": ["order_1", "order_2"],
  "action": "status_change",
  "status": "confirmed"
}
```

### 导出订单
`GET /api/manage/orders/export`

**Query Params:**
- `format`: `xlsx` | `csv`
- `status`, `start_date`, `end_date` 等筛选条件

---

## 3. 销售人员管理 (Salespersons)

### 获取销售列表
`GET /api/manage/salespersons`

**Query Params:**
- `page`, `limit`, `search`, `is_active`

### 创建销售员
`POST /api/manage/salespersons`

**Body:**
```json
{
  "name": "张三",
  "store": "旗舰店",
  "phone": "13800000000",
  "password": "initial_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sp_xxx",
    "accessToken": "tk_sales_abc123",
    "accessUrl": "/order/tk_sales_abc123"
  }
}
```

### 获取销售详情
`GET /api/manage/salespersons/:id`

### 更新销售
`PATCH /api/manage/salespersons/:id`

**Body:**
```json
{
  "name": "新姓名",
  "store": "新门店",
  "isActive": false,
  "password": "new_password"
}
```

### 删除销售
`DELETE /api/manage/salespersons/:id`
> 如果该销售有关联订单，将返回 400 错误。

### 重置访问 Token
`POST /api/manage/salespersons/:id/reset-token`

---

## 4. 客户管理 (Customers)

### 获取客户列表
`GET /api/manage/customers`

### 搜索客户
`GET /api/manage/customers/search?q=keyword`

### 获取客户详情
`GET /api/manage/customers/:id`

### 创建客户
`POST /api/manage/customers`

**Body:**
```json
{
  "name": "李四",
  "phone": "13900000000",
  "company": "ABC公司",
  "tags": ["VIP", "老客户"],
  "remark": "重要客户"
}
```

### 更新客户
`PUT /api/manage/customers/:id`

### 删除客户
`DELETE /api/manage/customers/:id`
> 如果该客户有关联订单，将返回 400 错误。

---

## 5. 文件上传 (Files)

### 检查文件哈希 (秒传)
`POST /api/manage/check-hash`

**Body:**
```json
{
  "hash": "sha256_hash_string"
}
```
**Response:**
- `exists`: true/false
- `url`: 如果存在，返回现有 URL

### 上传文件
`POST /api/manage/upload`

> 支持使用 `X-API-Key` 进行外部调用。

**Form Data:**
- `file`: 文件二进制
- `folder_id`: 目标文件夹 ID (可选)

---

## 6. 统计 (Stats)

### 销售业绩统计
`GET /api/manage/stats`

**Query Params:**
- `period`: `week`, `month`, `quarter`
- `salesperson_id`: 可选，筛选指定销售

---

---

## 7. 商品与库存系统 (Product & Inventory)

### 获取商品列表 (SPU)
`GET /api/manage/products`

### 创建商品 SPU
`POST /api/manage/products`

### 获取/管理变体 (SKU)
`GET /api/manage/products/:id/variants`
`POST /api/manage/products/:id/variants`

### 查询库存分类账
`GET /api/manage/inventory/ledger`

---

## 8. 采购单管理 (Purchase Orders)

### 获取采购单列表
`GET /api/manage/purchase-orders`

### 创建采购单
`POST /api/manage/purchase-orders`

### 更新采购单状态
`POST /api/manage/purchase-orders/:id/status`

---

## 9. 备份 (Backups)

### 触发数据库备份
`POST /api/manage/backups`

### 获取备份列表
`GET /api/manage/backups`
