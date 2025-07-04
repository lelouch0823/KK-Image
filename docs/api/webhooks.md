# Webhook API

## 概述

Webhook API 提供事件通知机制，当系统中发生特定事件时，会自动向注册的 URL 发送 HTTP POST 请求。

## 端点列表

### 1. 获取 Webhook 列表

**请求**
```http
GET /api/v1/webhooks
```

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": "webhook_1234567890",
      "url": "https://your-app.com/webhook",
      "events": ["file.uploaded", "file.deleted"],
      "secret": "whsec_1234567890abcdef",
      "active": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": "admin",
      "lastTriggered": "2024-01-20T15:45:00Z",
      "successCount": 42,
      "failureCount": 2,
      "headers": {
        "X-Custom-Header": "custom-value"
      }
    }
  ],
  "supportedEvents": [
    "file.uploaded",
    "file.updated", 
    "file.deleted",
    "webhook.test"
  ]
}
```

### 2. 创建 Webhook

**请求**
```http
POST /api/v1/webhooks
Content-Type: application/json
```

**请求体**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["file.uploaded", "file.deleted"],
  "secret": "your_webhook_secret",
  "headers": {
    "X-Custom-Header": "custom-value"
  }
}
```

**请求参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `url` | string | 是 | Webhook 接收 URL |
| `events` | array | 否 | 监听的事件类型，默认所有事件 |
| `secret` | string | 否 | 用于签名验证的密钥 |
| `headers` | object | 否 | 自定义 HTTP 头部 |

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": "webhook_1234567890",
    "url": "https://your-app.com/webhook",
    "events": ["file.uploaded", "file.deleted"],
    "secret": "whsec_1234567890abcdef",
    "active": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "createdBy": "admin",
    "headers": {
      "X-Custom-Header": "custom-value"
    }
  }
}
```

### 3. 删除 Webhook

**请求**
```http
DELETE /api/v1/webhooks/{id}
```

**路径参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `id` | string | 是 | Webhook ID |

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "message": "Webhook deleted successfully"
}
```

### 4. 测试 Webhook

**请求**
```http
POST /api/v1/webhooks/{id}/test
```

**路径参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `id` | string | 是 | Webhook ID |

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": 200,
    "statusText": "OK",
    "headers": {
      "content-type": "application/json",
      "server": "nginx/1.18.0"
    },
    "timestamp": "2024-01-20T16:00:00Z"
  }
}
```

## 事件类型

### file.uploaded
文件上传完成时触发

**载荷示例**
```json
{
  "event": "file.uploaded",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "file": {
      "id": "img_1234567890",
      "filename": "example.jpg",
      "url": "https://your-domain.com/file/img_1234567890",
      "type": "image/jpeg",
      "size": 1024000,
      "uploadTime": "2024-01-15T10:30:00Z"
    },
    "user": {
      "id": "user123",
      "name": "John Doe"
    }
  },
  "id": "evt_1234567890abcdef"
}
```

### file.updated
文件信息更新时触发

**载荷示例**
```json
{
  "event": "file.updated",
  "timestamp": "2024-01-15T11:00:00Z",
  "data": {
    "file": {
      "id": "img_1234567890",
      "filename": "updated-example.jpg",
      "url": "https://your-domain.com/file/img_1234567890",
      "lastModified": "2024-01-15T11:00:00Z"
    },
    "changes": {
      "filename": {
        "old": "example.jpg",
        "new": "updated-example.jpg"
      },
      "tags": {
        "old": ["photo"],
        "new": ["photo", "landscape"]
      }
    },
    "user": {
      "id": "user123",
      "name": "John Doe"
    }
  },
  "id": "evt_0987654321fedcba"
}
```

### file.deleted
文件删除时触发

**载荷示例**
```json
{
  "event": "file.deleted",
  "timestamp": "2024-01-15T12:00:00Z",
  "data": {
    "file": {
      "id": "img_1234567890",
      "filename": "example.jpg",
      "deletedAt": "2024-01-15T12:00:00Z",
      "permanent": false
    },
    "user": {
      "id": "user123",
      "name": "John Doe"
    }
  },
  "id": "evt_abcdef1234567890"
}
```

### webhook.test
Webhook 测试时触发

**载荷示例**
```json
{
  "event": "webhook.test",
  "timestamp": "2024-01-20T16:00:00Z",
  "data": {
    "message": "This is a test webhook from Telegraph-Image",
    "webhook": {
      "id": "webhook_1234567890",
      "url": "https://your-app.com/webhook"
    },
    "user": {
      "id": "admin",
      "name": "admin"
    }
  },
  "id": "test_1705766400000"
}
```

## Webhook 安全

### 签名验证
如果设置了 `secret`，每个 Webhook 请求都会包含签名头部：

```http
X-Webhook-Signature: sha256=a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3
```

**验证方法 (Node.js)**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const receivedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );
}

// 使用示例
const isValid = verifyWebhookSignature(
  JSON.stringify(webhookPayload),
  req.headers['x-webhook-signature'],
  'your_webhook_secret'
);
```

### 请求头部
每个 Webhook 请求都包含以下头部：

```http
Content-Type: application/json
User-Agent: Telegraph-Image-Webhook/1.0
X-Webhook-Event: file.uploaded
X-Webhook-ID: evt_1234567890abcdef
X-Webhook-Timestamp: 2024-01-15T10:30:00Z
X-Webhook-Signature: sha256=... (如果设置了 secret)
```

## 重试机制

当 Webhook 投递失败时，系统会自动重试：

- **重试次数**: 最多 3 次
- **重试间隔**: 指数退避 (1s, 2s, 4s)
- **失败条件**: HTTP 状态码 >= 400 或网络错误
- **超时时间**: 10 秒

## 错误响应

### Webhook 不存在
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

### URL 无效
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

### 事件类型无效
```json
{
  "success": false,
  "error": {
    "code": "INVALID_EVENT_TYPE",
    "message": "无效的事件类型",
    "details": "Event 'invalid.event' is not supported"
  }
}
```

## 使用示例

### JavaScript (Express.js)
```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Webhook 接收端点
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  // 验证签名
  if (signature) {
    const isValid = verifyWebhookSignature(payload, signature, 'your_secret');
    if (!isValid) {
      return res.status(401).send('Invalid signature');
    }
  }
  
  // 处理事件
  const { event, data } = req.body;
  
  switch (event) {
    case 'file.uploaded':
      console.log('New file uploaded:', data.file.filename);
      break;
    case 'file.deleted':
      console.log('File deleted:', data.file.filename);
      break;
    default:
      console.log('Unknown event:', event);
  }
  
  res.status(200).send('OK');
});

app.listen(3000);
```

### cURL
```bash
# 创建 Webhook
curl -X POST \
  -H "X-API-Key: tk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["file.uploaded", "file.deleted"],
    "secret": "your_webhook_secret"
  }' \
  https://your-domain.com/api/v1/webhooks

# 测试 Webhook
curl -X POST \
  -H "X-API-Key: tk_your_api_key_here" \
  https://your-domain.com/api/v1/webhooks/webhook_1234567890/test

# 删除 Webhook
curl -X DELETE \
  -H "X-API-Key: tk_your_api_key_here" \
  https://your-domain.com/api/v1/webhooks/webhook_1234567890
```
