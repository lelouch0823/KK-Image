# Sales API (销售端)

> **Base URL**: `/api/sales`

销售端 API 分为两类：
1. **Public**: 初始认证接口，无需 Path Token。
2. **Protected**: 业务接口，路径需包含 `access_token` (`/api/sales/:token/...`)。

## 1. 认证 (Authentication)

### 1.1 微信小程序登录 (Public)
`POST /api/sales/wechat-login`

通过微信 `wx.login` 获取的 code 换取登录凭证。

**Body:**
```json
{
  "code": "091xxxxxx"
}
```

**Response (已绑定):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUz...", // Session JWT
    "user": { "name": "张三", "store": "旗舰店" }
  }
}
```

**Response (未绑定):**
```json
{
  "success": true,
  "data": {
    "needBind": true,
    "openid": "oOpenId..." // 暂存用于后续绑定
  }
}
```

### 1.2 密码登录 (Protected)
`POST /api/sales/:token/auth`

使用管理员分配的 `access_token` 和密码进行登录。

**Body:**
```json
{
  "password": "your_password"
}
```

**Response:**
与微信登录成功响应一致，返回 JWT。

### 1.3 检查会话 (Protected)
`GET /api/sales/:token/auth`

验证 JWT 是否有效，并获取当前销售员信息。
**Headers:** `Authorization: Bearer <JWT>`

### 1.4 绑定微信 (Protected)
`POST /api/sales/:token/bind-wechat`

将当前登录账号绑定到微信 OpenID。

**Body:**
```json
{
  "code": "091xxxxxx" // 微信 code
}
```

---

## 2. 订单管理 (Orders)

> **注意**: 所有业务接口需在 Header 中携带 `Authorization: Bearer <JWT>`。

### 2.1 创建订单
`POST /api/sales/:token/orders`

**Body:**
```json
{
  "name": "定制海报",
  "size": "50x70cm",
  "data": {
    "customer_name": "李四",
    "customer_phone": "13800138000"
  },
  "fileIds": ["file_id_1", "file_id_2"], // 关联上传的文件
  "remark": "加急"
}
```

### 2.2 获取订单列表
`GET /api/sales/:token/orders`

**Query Params:**
- `page`: 页码 (default 1)
- `limit`: 每页数量 (default 20)
- `status`: 筛选状态 (e.g., `pending`, `confirmed`)

### 2.3 获取订单详情
`GET /api/sales/:token/orders/:orderId`

---

## 3. 文件上传
`POST /api/upload` (或 `/api/sales/:token/upload`)

支持 `FormData` 上传文件。
