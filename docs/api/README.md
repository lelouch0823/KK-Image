# Telegraph-Image API v1 文档

## 概述

Telegraph-Image API v1 是一个完整的 RESTful API，提供图片和视频文件的管理功能，支持上传、查询、更新和删除操作。API 采用标准的 HTTP 方法和状态码，支持 JSON 格式的请求和响应。

## 基础信息

- **API 版本**: v1
- **基础 URL**: `https://your-domain.com/api/v1`
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 认证方式

API 支持两种认证方式：

### 1. API Key 认证
```http
X-API-Key: tk_your_api_key_here
```

### 2. JWT Token 认证
```http
Authorization: Bearer your_jwt_token_here
```

## 权限级别

- **read**: 只读权限，可以查询文件信息
- **write**: 写入权限，可以上传和更新文件
- **delete**: 删除权限，可以删除文件
- **admin**: 管理员权限，可以管理 API Key 和 Webhook

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "pagination": {  // 仅分页查询时包含
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  }
}
```

## HTTP 状态码

- **200 OK**: 请求成功
- **201 Created**: 资源创建成功
- **400 Bad Request**: 请求参数错误
- **401 Unauthorized**: 认证失败
- **403 Forbidden**: 权限不足
- **404 Not Found**: 资源不存在
- **429 Too Many Requests**: 请求频率超限
- **500 Internal Server Error**: 服务器内部错误

## 速率限制

- **限制**: 每个 IP 每分钟最多 100 次请求
- **响应头**: 
  - `X-RateLimit-Limit`: 速率限制
  - `X-RateLimit-Remaining`: 剩余请求次数
  - `X-RateLimit-Reset`: 重置时间戳

## API 端点概览

### 系统监控
- `GET /health` - 健康检查
- `GET /info` - API 信息

### 认证管理
- `POST /auth/token` - 生成 JWT Token
- `GET /auth/api-keys` - 获取 API Key 列表
- `POST /auth/api-keys` - 创建 API Key
- `DELETE /auth/api-keys/{id}` - 删除 API Key

### 文件管理
- `GET /files` - 获取文件列表
- `GET /files/{id}` - 获取单个文件信息
- `POST /files` - 上传文件
- `PUT /files/{id}` - 更新文件信息
- `DELETE /files/{id}` - 删除文件

### Webhook 管理
- `GET /webhooks` - 获取 Webhook 列表
- `POST /webhooks` - 创建 Webhook
- `DELETE /webhooks/{id}` - 删除 Webhook
- `POST /webhooks/{id}/test` - 测试 Webhook

## 支持的文件类型

### 图片格式
- JPEG (image/jpeg)
- PNG (image/png)
- GIF (image/gif)
- WebP (image/webp)

### 视频格式
- MP4 (video/mp4)

## 文件大小限制

- **图片**: 最大 10MB
- **视频**: 最大 100MB

## Webhook 事件类型

- `file.uploaded` - 文件上传完成
- `file.updated` - 文件信息更新
- `file.deleted` - 文件删除
- `webhook.test` - Webhook 测试事件

## 错误代码

| 错误代码 | 描述 |
|---------|------|
| `INVALID_API_KEY` | API Key 无效 |
| `INVALID_TOKEN` | JWT Token 无效 |
| `INSUFFICIENT_PERMISSIONS` | 权限不足 |
| `VALIDATION_ERROR` | 请求参数验证失败 |
| `FILE_NOT_FOUND` | 文件不存在 |
| `FILE_TOO_LARGE` | 文件大小超限 |
| `UNSUPPORTED_FILE_TYPE` | 不支持的文件类型 |
| `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| `WEBHOOK_NOT_FOUND` | Webhook 不存在 |
| `WEBHOOK_DELIVERY_FAILED` | Webhook 投递失败 |

## 示例代码

### JavaScript (Fetch API)
```javascript
// 获取文件列表
const response = await fetch('/api/v1/files', {
  headers: {
    'X-API-Key': 'tk_your_api_key_here'
  }
});
const data = await response.json();
```

### cURL
```bash
# 获取文件列表
curl -H "X-API-Key: tk_your_api_key_here" \
     https://your-domain.com/api/v1/files

# 上传文件
curl -X POST \
     -H "X-API-Key: tk_your_api_key_here" \
     -F "file=@image.jpg" \
     https://your-domain.com/api/v1/files
```

## 更多文档

- [认证管理 API](./auth.md)
- [文件管理 API](./files.md)
- [Webhook API](./webhooks.md)
- [系统监控 API](./system.md)
- [错误处理指南](./errors.md)
- [SDK 和示例](./examples.md)
