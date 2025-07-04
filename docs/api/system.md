# 系统监控 API

## 概述

系统监控 API 提供健康检查和系统信息查询功能，用于监控 API 服务状态和获取系统信息。

## 端点列表

### 1. 健康检查

**请求**
```http
GET /api/v1/health
```

**权限要求**: 无（公开端点）

**响应示例**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-20T16:00:00Z",
    "uptime": 86400,
    "services": {
      "kv_storage": {
        "status": "healthy",
        "responseTime": 12
      },
      "file_storage": {
        "status": "healthy",
        "responseTime": 8
      }
    },
    "version": "1.0.0",
    "environment": "production"
  }
}
```

**状态说明**
- `healthy`: 所有服务正常
- `degraded`: 部分服务异常但核心功能可用
- `unhealthy`: 核心服务异常

### 2. 系统信息

**请求**
```http
GET /api/v1/info
```

**权限要求**: 无（公开端点）

**响应示例**
```json
{
  "success": true,
  "data": {
    "name": "Telegraph-Image API",
    "version": "1.0.0",
    "description": "Telegraph-Image RESTful API for file management",
    "documentation": "https://your-domain.com/docs/api/",
    "contact": {
      "email": "support@your-domain.com",
      "url": "https://your-domain.com/support"
    },
    "authentication": {
      "methods": ["api_key", "jwt_token"],
      "apiKeyHeader": "X-API-Key",
      "jwtHeader": "Authorization"
    },
    "endpoints": {
      "files": "/api/v1/files",
      "auth": "/api/v1/auth",
      "webhooks": "/api/v1/webhooks",
      "health": "/api/v1/health",
      "info": "/api/v1/info"
    },
    "limits": {
      "rateLimit": {
        "requests": 100,
        "window": "1 minute"
      },
      "fileSize": {
        "image": "10MB",
        "video": "100MB"
      },
      "supportedFormats": {
        "images": ["jpeg", "png", "gif", "webp"],
        "videos": ["mp4"]
      }
    },
    "features": {
      "fileUpload": true,
      "fileManagement": true,
      "webhooks": true,
      "authentication": true,
      "rateLimit": true
    },
    "webhookEvents": [
      "file.uploaded",
      "file.updated",
      "file.deleted",
      "webhook.test"
    ],
    "buildInfo": {
      "buildTime": "2024-01-15T08:00:00Z",
      "gitCommit": "abc123def456",
      "environment": "production"
    }
  }
}
```

## 监控指标

### 健康检查详情

**KV 存储服务**
- 检查 KV 存储的读写能力
- 测量响应时间
- 检查存储空间使用情况

**文件存储服务**
- 检查文件存储的可用性
- 测量文件访问响应时间
- 检查存储配额

### 性能指标

**响应时间**
- `responseTime`: 服务响应时间（毫秒）
- 正常范围: < 100ms
- 警告范围: 100-500ms
- 异常范围: > 500ms

**系统运行时间**
- `uptime`: 系统运行时间（秒）
- 自上次重启以来的运行时间

## 状态码说明

### 健康状态
- **200 OK**: 系统健康
- **503 Service Unavailable**: 系统不健康

### 服务状态
- `healthy`: 服务正常运行
- `degraded`: 服务性能下降但仍可用
- `unhealthy`: 服务不可用

## 使用示例

### JavaScript
```javascript
// 检查系统健康状态
async function checkHealth() {
  try {
    const response = await fetch('/api/v1/health');
    const health = await response.json();
    
    if (health.data.status === 'healthy') {
      console.log('系统运行正常');
    } else {
      console.warn('系统状态异常:', health.data.status);
    }
    
    return health.data;
  } catch (error) {
    console.error('健康检查失败:', error);
    return null;
  }
}

// 获取系统信息
async function getSystemInfo() {
  try {
    const response = await fetch('/api/v1/info');
    const info = await response.json();
    
    console.log('API 版本:', info.data.version);
    console.log('支持的文件格式:', info.data.limits.supportedFormats);
    
    return info.data;
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return null;
  }
}

// 定期健康检查
setInterval(checkHealth, 30000); // 每30秒检查一次
```

### cURL
```bash
# 健康检查
curl https://your-domain.com/api/v1/health

# 获取系统信息
curl https://your-domain.com/api/v1/info

# 检查特定服务状态
curl -s https://your-domain.com/api/v1/health | jq '.data.services.kv_storage.status'
```

### 监控脚本示例
```bash
#!/bin/bash

# 健康检查脚本
API_URL="https://your-domain.com/api/v1/health"
WEBHOOK_URL="https://your-monitoring.com/webhook"

# 检查健康状态
HEALTH_STATUS=$(curl -s $API_URL | jq -r '.data.status')

if [ "$HEALTH_STATUS" != "healthy" ]; then
  # 发送告警
  curl -X POST $WEBHOOK_URL \
    -H "Content-Type: application/json" \
    -d "{
      \"alert\": \"API Health Check Failed\",
      \"status\": \"$HEALTH_STATUS\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }"
fi
```

## 监控集成

### Prometheus 指标
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'telegraph-image-api'
    static_configs:
      - targets: ['your-domain.com']
    metrics_path: '/api/v1/health'
    scrape_interval: 30s
```

### Grafana 仪表板
```json
{
  "dashboard": {
    "title": "Telegraph-Image API Monitoring",
    "panels": [
      {
        "title": "API Health Status",
        "type": "stat",
        "targets": [
          {
            "expr": "api_health_status",
            "legendFormat": "Health Status"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "api_response_time",
            "legendFormat": "Response Time (ms)"
          }
        ]
      }
    ]
  }
}
```

### 告警规则
```yaml
# alerting.yml
groups:
  - name: telegraph-image-api
    rules:
      - alert: APIHealthCheckFailed
        expr: api_health_status != 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Telegraph-Image API health check failed"
          description: "API health status is {{ $value }}"
      
      - alert: APIResponseTimeTooHigh
        expr: api_response_time > 1000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "API response time is too high"
          description: "Response time is {{ $value }}ms"
```

## 故障排除

### 常见问题

**KV 存储服务异常**
- 检查 Cloudflare KV 配置
- 验证 KV 命名空间绑定
- 检查 KV 存储配额

**文件存储服务异常**
- 检查文件存储配置
- 验证存储权限设置
- 检查存储空间使用情况

**响应时间过长**
- 检查网络连接
- 优化数据库查询
- 检查缓存配置

### 调试信息
```javascript
// 获取详细的调试信息
const debugInfo = {
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  url: window.location.href,
  apiEndpoint: '/api/v1/health'
};

console.log('Debug Info:', debugInfo);
```
