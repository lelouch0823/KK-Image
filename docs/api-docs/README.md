# API 文档

欢迎使用 Telegraph-Image API 文档！本文档提供了完整的 API 接口说明，帮助开发者集成和使用 Telegraph-Image 服务。

## 📖 API 概览

Telegraph-Image 提供了 RESTful API 接口，支持文件上传、访问、管理等核心功能。所有 API 都基于 HTTP/HTTPS 协议，使用 JSON 格式进行数据交换。

## 🚀 快速开始

### 基础信息

**API 基础 URL**:
```
https://your-domain.pages.dev
```

**支持的 HTTP 方法**:
- `GET` - 获取资源
- `POST` - 创建资源
- `DELETE` - 删除资源

**响应格式**:
- 内容类型：`application/json`
- 字符编码：`UTF-8`
- 状态码：标准 HTTP 状态码

### 认证方式

**公开接口**:
- 文件上传：无需认证
- 文件访问：无需认证（除非启用白名单模式）

**管理接口**:
- 需要 Basic Authentication
- 用户名/密码：环境变量 `BASIC_USER`/`BASIC_PASS`

## 📚 API 接口分类

### 🔄 核心 API

#### [📤 上传 API](upload-api.md)
文件上传相关接口：
- `POST /upload` - 上传文件
- 支持多种文件格式
- 批量上传支持
- 上传进度跟踪

**主要功能**:
- 单文件上传
- 多文件批量上传
- 文件格式验证
- 上传状态返回

#### [📁 文件访问 API](file-api.md)
文件访问和获取接口：
- `GET /file/{id}` - 获取文件
- 支持缓存控制
- 访问权限验证
- 内容类型识别

**核心特性**:
- 直接文件访问
- CDN 缓存支持
- 访问控制
- 元数据获取

#### [⚙️ 管理 API](management-api.md)
后台管理相关接口：
- `GET /api/manage/list` - 获取文件列表
- `DELETE /api/manage/delete` - 删除文件
- `POST /api/manage/batch` - 批量操作
- `GET /api/manage/stats` - 统计信息

**管理功能**:
- 文件列表查询
- 文件删除操作
- 批量管理操作
- 统计数据获取

## 🔧 API 使用示例

### 文件上传示例

**cURL 示例**:
```bash
curl -X POST https://your-domain.pages.dev/upload \
  -F "file=@/path/to/image.jpg" \
  -H "Content-Type: multipart/form-data"
```

**JavaScript 示例**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

**Python 示例**:
```python
import requests

with open('image.jpg', 'rb') as f:
    files = {'file': f}
    response = requests.post('https://your-domain.pages.dev/upload', files=files)
    print(response.json())
```

### 文件访问示例

**直接访问**:
```
GET https://your-domain.pages.dev/file/AgACAgEAAxkDAAMDZt1Gzs4W8dQPWiQJxO5YSH5X-gsAAt-sMRuWNelGOSaEM_9lHHgBAAMCAANtAAM2BA.png
```

**带参数访问**:
```
GET https://your-domain.pages.dev/file/image-id.jpg?download=true
```

### 管理 API 示例

**获取文件列表**:
```bash
curl -X GET https://your-domain.pages.dev/api/manage/list \
  -u "admin:password" \
  -H "Accept: application/json"
```

**删除文件**:
```bash
curl -X DELETE https://your-domain.pages.dev/api/manage/delete \
  -u "admin:password" \
  -H "Content-Type: application/json" \
  -d '{"id": "file-id"}'
```

## 📊 响应格式

### 成功响应

**上传成功**:
```json
[
  {
    "src": "/file/AgACAgEAAxkDAAMDZt1Gzs4W8dQPWiQJxO5YSH5X-gsAAt-sMRuWNelGOSaEM_9lHHgBAAMCAANtAAM2BA.png"
  }
]
```

**列表查询成功**:
```json
{
  "success": true,
  "data": [
    {
      "id": "file-id",
      "filename": "image.jpg",
      "size": 1024000,
      "uploadTime": "2024-07-04T10:30:00Z",
      "type": "image/jpeg"
    }
  ],
  "total": 1,
  "page": 1
}
```

### 错误响应

**标准错误格式**:
```json
{
  "error": {
    "code": 400,
    "message": "Error message description",
    "type": "VALIDATION_ERROR",
    "timestamp": "2024-07-04T10:30:00.000Z"
  }
}
```

**带详情的错误响应**:
```json
{
  "error": {
    "code": 400,
    "message": "Validation failed",
    "type": "VALIDATION_ERROR",
    "timestamp": "2024-07-04T10:30:00.000Z",
    "details": {
      "field": "file",
      "reason": "File size exceeds limit"
    }
  }
}
```

**常见错误类型**:
| HTTP 状态码 | 错误类型 | 说明 |
|-------------|----------|------|
| `400` | `VALIDATION_ERROR` | 请求参数验证失败 |
| `401` | `AUTHENTICATION_ERROR` | 认证失败 |
| `403` | `AUTHORIZATION_ERROR` | 权限不足 |
| `404` | `NOT_FOUND` | 资源不存在 |
| `409` | `CONFLICT` | 资源冲突 |
| `429` | `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| `500` | `INTERNAL_ERROR` | 服务器内部错误 |

## 🔒 安全和限制

### 请求限制

**文件大小限制**:
- 单文件最大：5MB
- 批量上传：最多 10 个文件
- 总大小限制：50MB

**频率限制**:
- 上传接口：每分钟 60 次
- 访问接口：每分钟 1000 次
- 管理接口：每分钟 100 次

### 安全措施

**输入验证**:
- 文件类型检查
- 文件大小验证
- 参数格式验证
- SQL 注入防护

**访问控制**:
- IP 白名单支持
- 认证令牌验证
- 权限级别控制
- 操作日志记录

## 🌐 跨域支持

### CORS 配置

**允许的源**:
```
Access-Control-Allow-Origin: *
```

**允许的方法**:
```
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
```

**允许的头部**:
```
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 预检请求

对于复杂请求，浏览器会发送 OPTIONS 预检请求：

```javascript
// 浏览器自动发送的预检请求
OPTIONS /upload HTTP/1.1
Origin: https://example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type
```

## 📱 SDK 和工具

### 官方 SDK

**JavaScript SDK**:
```javascript
import TelegraphImage from 'telegraph-image-sdk';

const client = new TelegraphImage('https://your-domain.pages.dev');
const result = await client.upload(file);
```

**Python SDK**:
```python
from telegraph_image import TelegraphImageClient

client = TelegraphImageClient('https://your-domain.pages.dev')
result = client.upload('image.jpg')
```

### 第三方工具

**Postman Collection**:
- 完整的 API 测试集合
- 环境变量配置
- 自动化测试脚本

**OpenAPI 规范**:
- Swagger 文档支持
- 代码生成工具
- API 测试工具

## 🔍 调试和测试

### 调试技巧

**请求日志**:
- 启用详细日志记录
- 查看请求和响应头
- 分析错误信息

**测试工具**:
- 使用 Postman 或 Insomnia
- 浏览器开发者工具
- cURL 命令行工具

### 常见问题

**上传失败**:
1. 检查文件大小和格式
2. 验证网络连接
3. 确认 API 端点正确
4. 查看错误响应信息

**认证失败**:
1. 确认用户名密码正确
2. 检查 Basic Auth 格式
3. 验证权限配置
4. 查看认证头部

## 📈 性能优化

### 最佳实践

**上传优化**:
- 压缩文件大小
- 使用批量上传
- 实现断点续传
- 添加重试机制

**访问优化**:
- 利用 CDN 缓存
- 设置合适的缓存头
- 使用压缩传输
- 实现懒加载

### 监控指标

**关键指标**:
- API 响应时间
- 成功率统计
- 错误率分析
- 并发用户数

## 🔗 相关文档

- **[快速开始](../quick-start/README.md)** - 基础部署和配置
- **[用户手册](../user-manual/README.md)** - 用户使用指南
- **[开发者指南](../developer-guide/README.md)** - 开发和集成指南

---

🚀 **开始使用**: 选择您需要的 API 接口，参考相应的详细文档开始集成！
