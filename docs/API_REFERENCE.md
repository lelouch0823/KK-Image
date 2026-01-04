# KK-Image API Reference

本文档供移动端 App、小程序或其他第三方客户端接入使用。

## 1. 鉴权机制 (Authentication)

### 1.1 管理员 (Admin)
管理员接口通常位于 `/api/manage/*`。
支持两种鉴权方式（推荐使用 Bearer Token）：

- **HTTP Header**:
  ```http
  Authorization: Bearer <Admin_JWT_Token>
  ```
- **Cookie** (浏览器默认):
  `ADMIN_AUTH=<Admin_JWT_Token>`

> **注意**: 管理员 Token 可通过登录接口 POST `/api/auth/login` 获取。

### 1.2 销售端 (Salesperson)
销售端接口位于 `/api/sales/:accessToken/*`。
**必须**同时满足以下两个条件：

1.  **URL Path Token**: 接口路径中必须包含销售员的 Access Token (由管理员分配)。
    - 例: `/api/sales/tk_12345/orders`
2.  **Session Token (JWT)**: 用于验证当前会话有效性。
    - **Header**: `Authorization: Bearer <Sales_JWT_Token>`
    - 或 **Cookie**: `sales_token=<Sales_JWT_Token>`

> **注意**: 销售员首次访问（或 Token 过期）时，需调用登录接口 POST `/api/sales/:accessToken/login` 获取 Session JWT。

---

## 2. 核心接口 (Endpoints)

### 2.1 公共接口
无需鉴权。

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| GET | `/api/common/config` | 获取系统公开配置 |

### 2.2 销售端接口
Base URL: `/api/sales/:accessToken`

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| POST | `/login` | 销售员登录 (换取 Session JWT) |
| GET | `/orders` | 获取订单列表 |
| POST | `/orders` | 创建新订单 |
| GET | `/orders/:id` | 获取订单详情 |
| POST | `/upload` | 上传文件 (图片/视频) |

**示例: 获取订单列表**
```http
GET /api/sales/tk_sales_abc123/orders?page=1&status=pending
Authorization: Bearer eyJhbGciOiJIUz...
```

### 2.3 管理端接口
Base URL: `/api/manage`

| Method | Endpoint | 描述 |
| :--- | :--- | :--- |
| GET | `/dashboard/overview` | 仪表盘统计数据 |
| GET | `/orders` | 订单管理列表 |
| PUT | `/orders/:id` | 修改订单 |
| POST | `/salespersons` | 创建销售员 |

---

## 3. 错误码 (Error Codes)

API 统一返回 JSON 格式：
```json
{
  "success": false,
  "message": "错误描述",
  "data": null
}
```

常见状态码：
- `401 Unauthorized`: 未登录或 Token 过期
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `429 Too Many Requests`: 请求过于频繁
- `500 Internal Server Error`: 服务器内部错误
