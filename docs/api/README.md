# kk-life API 文档

**kk-life** 提供三套独立的 API 体系，分别面向不同的使用场景。

## 1. Management API (管理端)
> **Base URL**: `/api/manage`  
> **Auth**: Basic Auth / JWT (Admin)

用于后台管理系统的核心 API，包含文件上传、订单管理、CRM、销售人员管理等所有特权操作。

- **[管理端 API 文档](management.md)**
  - 文件上传 (`/upload`, `/check-hash`)
  - 订单管理 (`/orders`)
  - 客户与销售人员管理

## 2. Sales API (销售端)
> **Base URL**: `/api/sales/:token`  
> **Auth**: Bearer Token (in Path)

专为移动端销售工具设计，通过 `access_token` 进行鉴权。

- **[销售端 API 文档](sales.md)**
  - 创建订单
  - 查看个人业绩
  - 更新订单状态

## 3. Space API (访客端)
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

### 错误处理
HTTP 状态码用于指示请求状态：
- 200: 成功
- 400: 请求参数错误
- 401: 未认证 (Token 无效/缺失)
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误
