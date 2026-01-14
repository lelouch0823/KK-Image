# Management API

> **Base URL**: `/api/manage`

## 1. 订单管理 (Orders)

### 获取订单列表
`GET /api/manage/orders`

**Query Params:**
- `page`: 页码 (default: 1)
- `limit`: 每页条数 (default: 20)
- `status`: 状态筛选 (`pending`, `confirmed`, `production`, `shipping`, `delivered`)
- `search`: 搜索关键词 (订单号/客户名)

### 获取订单详情
`GET /api/manage/orders/:id`

### 更新订单状态
`POST /api/manage/orders/:id/status`

**Body:**
```json
{
  "status": "production",
  "comment": "开始生产"
}
```

### 导出订单
`GET /api/manage/orders/export`
- 导出为 Excel/CSV 格式。

---

## 2. 文件上传 (Files)

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

> **Note**: 支持使用 `X-API-Key` 进行外部调用。

**Form Data:**
- `file`: 文件二进制
- `folder_id`: 目标文件夹 ID (可选)

---

## 3. 销售人员管理 (Salespersons)

### 获取列表
`GET /api/manage/salespersons`

### 创建销售员
`POST /api/manage/salespersons`

**Body:**
```json
{
  "name": "张三",
  "store": "旗舰店"
}
```
**Response:**
- 返回包含 `access_token` 的完整信息。

---

## 4. 客户管理 (Customers)

### 获取列表
`GET /api/manage/customers`

### 搜索客户
`GET /api/manage/customers/search?q=keyword`
