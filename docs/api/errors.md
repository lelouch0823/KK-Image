# API 错误处理指南

## 概述

Telegraph-Image API 使用标准的 HTTP 状态码和结构化的错误响应格式，帮助开发者快速识别和处理各种错误情况。

## 错误响应格式

所有错误响应都遵循统一的 JSON 格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误描述",
    "details": "详细的技术错误信息",
    "timestamp": "2024-01-20T16:00:00Z",
    "requestId": "req_1234567890abcdef"
  }
}
```

## HTTP 状态码

### 2xx 成功
- **200 OK**: 请求成功
- **201 Created**: 资源创建成功

### 4xx 客户端错误
- **400 Bad Request**: 请求参数错误
- **401 Unauthorized**: 认证失败
- **403 Forbidden**: 权限不足
- **404 Not Found**: 资源不存在
- **409 Conflict**: 资源冲突
- **413 Payload Too Large**: 请求体过大
- **422 Unprocessable Entity**: 请求格式正确但语义错误
- **429 Too Many Requests**: 请求频率超限

### 5xx 服务器错误
- **500 Internal Server Error**: 服务器内部错误
- **502 Bad Gateway**: 网关错误
- **503 Service Unavailable**: 服务不可用
- **504 Gateway Timeout**: 网关超时

## 错误代码详解

### 认证相关错误

#### INVALID_API_KEY
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key 无效",
    "details": "The provided API key is invalid, expired, or disabled"
  }
}
```
**解决方案**: 检查 API Key 是否正确，是否已过期或被禁用

#### INVALID_TOKEN
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT Token 无效",
    "details": "Token signature verification failed"
  }
}
```
**解决方案**: 重新生成 JWT Token

#### TOKEN_EXPIRED
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "JWT Token 已过期",
    "details": "Token expired at 2024-01-15T10:30:00Z"
  }
}
```
**解决方案**: 使用刷新 Token 或重新登录

#### INSUFFICIENT_PERMISSIONS
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "权限不足",
    "details": "Admin permission required for this operation"
  }
}
```
**解决方案**: 使用具有足够权限的 API Key 或 Token

### 请求验证错误

#### VALIDATION_ERROR
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": "Field 'name' is required",
    "fields": {
      "name": "This field is required",
      "email": "Invalid email format"
    }
  }
}
```
**解决方案**: 检查并修正请求参数

#### MISSING_REQUIRED_FIELD
```json
{
  "success": false,
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "缺少必需字段",
    "details": "Required field 'file' is missing"
  }
}
```
**解决方案**: 添加缺少的必需字段

### 文件相关错误

#### FILE_NOT_FOUND
```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "文件不存在",
    "details": "File with ID 'img_1234567890' not found"
  }
}
```
**解决方案**: 检查文件 ID 是否正确

#### FILE_TOO_LARGE
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "文件大小超出限制",
    "details": "File size 15MB exceeds the limit of 10MB for images",
    "limits": {
      "maxSize": 10485760,
      "actualSize": 15728640
    }
  }
}
```
**解决方案**: 压缩文件或使用符合大小限制的文件

#### UNSUPPORTED_FILE_TYPE
```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "不支持的文件类型",
    "details": "File type 'application/pdf' is not supported",
    "supportedTypes": ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"]
  }
}
```
**解决方案**: 使用支持的文件类型

#### FILE_UPLOAD_FAILED
```json
{
  "success": false,
  "error": {
    "code": "FILE_UPLOAD_FAILED",
    "message": "文件上传失败",
    "details": "Storage service temporarily unavailable"
  }
}
```
**解决方案**: 稍后重试或联系技术支持

### 速率限制错误

#### RATE_LIMIT_EXCEEDED
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超出限制",
    "details": "Rate limit of 100 requests per minute exceeded",
    "rateLimit": {
      "limit": 100,
      "remaining": 0,
      "resetTime": "2024-01-20T16:01:00Z"
    }
  }
}
```
**解决方案**: 等待速率限制重置或优化请求频率

### Webhook 相关错误

#### WEBHOOK_NOT_FOUND
```json
{
  "success": false,
  "error": {
    "code": "WEBHOOK_NOT_FOUND",
    "message": "Webhook 不存在",
    "details": "Webhook with ID 'webhook_1234567890' not found"
  }
}
```
**解决方案**: 检查 Webhook ID 是否正确

#### WEBHOOK_DELIVERY_FAILED
```json
{
  "success": false,
  "error": {
    "code": "WEBHOOK_DELIVERY_FAILED",
    "message": "Webhook 投递失败",
    "details": "Failed to deliver webhook after 3 retries",
    "lastError": "Connection timeout"
  }
}
```
**解决方案**: 检查 Webhook URL 是否可访问

#### INVALID_WEBHOOK_URL
```json
{
  "success": false,
  "error": {
    "code": "INVALID_WEBHOOK_URL",
    "message": "Webhook URL 无效",
    "details": "URL must be a valid HTTPS endpoint"
  }
}
```
**解决方案**: 使用有效的 HTTPS URL

### 系统错误

#### INTERNAL_SERVER_ERROR
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "服务器内部错误",
    "details": "An unexpected error occurred",
    "requestId": "req_1234567890abcdef"
  }
}
```
**解决方案**: 稍后重试或联系技术支持

#### SERVICE_UNAVAILABLE
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "服务暂时不可用",
    "details": "Database connection failed"
  }
}
```
**解决方案**: 稍后重试

## 错误处理最佳实践

### 1. 客户端错误处理

```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new APIError(data.error, response.status);
    }
    
    return data;
  } catch (error) {
    if (error instanceof APIError) {
      handleAPIError(error);
    } else {
      handleNetworkError(error);
    }
    throw error;
  }
}

class APIError extends Error {
  constructor(errorData, statusCode) {
    super(errorData.message);
    this.name = 'APIError';
    this.code = errorData.code;
    this.details = errorData.details;
    this.statusCode = statusCode;
  }
}

function handleAPIError(error) {
  switch (error.code) {
    case 'INVALID_API_KEY':
    case 'TOKEN_EXPIRED':
      // 重新认证
      redirectToLogin();
      break;
    
    case 'RATE_LIMIT_EXCEEDED':
      // 显示速率限制提示
      showRateLimitWarning(error.details);
      break;
    
    case 'FILE_TOO_LARGE':
      // 显示文件大小错误
      showFileSizeError(error.details);
      break;
    
    default:
      // 显示通用错误消息
      showGenericError(error.message);
  }
}
```

### 2. 重试机制

```javascript
async function apiRequestWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await apiRequest(url, options);
    } catch (error) {
      lastError = error;
      
      // 不重试客户端错误
      if (error.statusCode < 500) {
        throw error;
      }
      
      // 最后一次重试失败
      if (i === maxRetries) {
        throw error;
      }
      
      // 指数退避
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### 3. 错误日志记录

```javascript
function logError(error, context = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    },
    context: context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  // 发送到错误监控服务
  sendToErrorMonitoring(errorLog);
  
  // 本地日志记录
  console.error('API Error:', errorLog);
}
```

### 4. 用户友好的错误提示

```javascript
function getErrorMessage(error) {
  const errorMessages = {
    'INVALID_API_KEY': '认证失败，请重新登录',
    'FILE_TOO_LARGE': '文件太大，请选择小于 10MB 的文件',
    'UNSUPPORTED_FILE_TYPE': '不支持的文件格式，请选择图片或视频文件',
    'RATE_LIMIT_EXCEEDED': '请求过于频繁，请稍后再试',
    'NETWORK_ERROR': '网络连接失败，请检查网络设置'
  };
  
  return errorMessages[error.code] || '操作失败，请稍后重试';
}
```

## 调试技巧

### 1. 启用详细错误信息
在开发环境中，可以通过请求头获取更详细的错误信息：

```http
X-Debug-Mode: true
```

### 2. 请求 ID 追踪
每个错误响应都包含 `requestId`，可用于日志追踪：

```javascript
if (error.requestId) {
  console.log(`Request ID: ${error.requestId}`);
}
```

### 3. 错误监控集成
```javascript
// Sentry 集成示例
import * as Sentry from '@sentry/browser';

Sentry.captureException(error, {
  tags: {
    api_endpoint: url,
    error_code: error.code
  },
  extra: {
    request_id: error.requestId,
    response_details: error.details
  }
});
```
