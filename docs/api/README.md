# kk-life API 文档

**kk-life** 提供三套独立的 API 体系，分别面向不同的使用场景。

## 1. Management API (管理端)
> **Base URL**: `/api/manage`  
> **Auth**: Basic Auth / JWT / API Key (External)

用于后台管理系统的核心 API，包含文件上传、订单管理、CRM、销售人员管理等所有特权操作。

> **External Access**: 支持通过 `X-API-Key` 请求头进行外部调用 (如自动化脚本)。

- **[管理端 API 文档](management.md)**
  - 文件上传 (`/upload`, `/check-hash`)
  - 订单管理 (`/orders`，详情含 `lines`)
  - 客户与销售人员管理
  - 商品、订货总览与库存管理 (`/products`, `/goods-overview`, `/inventory`)
  - 采购单管理 (`/purchase-orders`，详情含 `items` / `receipts`)
  - Outbox / Replay 运维接口 (`/outbox`, `/audit-replay`)

## 2. Sales API (销售端)
> **Base URL**: `/api/sales/:token`  
> **Auth**: Path Token + Bearer JWT

专为移动端销售工具设计，通过 `access_token` 进行鉴权。

- **[销售端 API 文档](sales.md)**
  - 创建订单
  - 查看个人业绩
  - 查看订单详情 (`lines` / `files` / `timeline`)
  - **微信小程序登录** (NEW)

---

## 3. 微信小程序支持 (NEW)
> **微信登录**: `POST /api/sales/wechat-login`  
> **绑定微信**: `POST /api/sales/:token/bind-wechat`

支持微信小程序原生登录 (`wx.login`)，启用前需配置环境变量：
- `WECHAT_APPID`: 小程序 AppID
- `WECHAT_SECRET`: 小程序 AppSecret

## 4. Space API (访客端)
> **Base URL**: `/api/space/:token`  
> **Auth**: Share Token + Password (Optional)

面向外部访客的只读/受限 API，用于展示共享空间内容。

- **[空间 API 文档](space.md)**
  - 获取空间详情
  - 文件列表与下载

---

## 通用规范

### 响应格式
所有 API 均返回标准 JSON 格式：

```json
{
  "success": true, // false
  "data": { ... }, // 成功时返回数据
  "error": "Error Message" // 失败时返回错误信息
}
```

关键业务写接口的通知、缓存和 webhook 已切换为 durable outbox 异步处理；客户端应以主请求返回值和后续读模型刷新为准。

### 错误处理
HTTP 状态码用于指示请求状态：
- 200: 成功
- 400: 请求参数错误
- 401: 未认证 (Token 无效/缺失)
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误
