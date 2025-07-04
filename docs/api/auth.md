# 认证管理 API

## 概述

认证管理 API 提供 JWT Token 生成和 API Key 管理功能，支持不同权限级别的访问控制。

## 端点列表

### 1. 生成 JWT Token

**请求**
```http
POST /api/v1/auth/token
Content-Type: application/json
```

**请求体**
```json
{
  "username": "admin",
  "password": "your_password",
  "expiresIn": 3600
}
```

**请求参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `password` | string | 是 | 密码 |
| `expiresIn` | integer | 否 | Token 有效期（秒），默认 3600 |

**权限要求**: 无（公开端点）

**响应示例**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "admin",
      "name": "admin",
      "permissions": ["read", "write", "delete", "admin"]
    }
  }
}
```

### 2. 获取 API Key 列表

**请求**
```http
GET /api/v1/auth/api-keys
```

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": "key_1234567890_abc123",
      "name": "Production API Key",
      "permissions": ["read", "write"],
      "createdAt": 1705312200000,
      "createdBy": "admin",
      "expiresAt": null,
      "disabled": false,
      "key": "tk_abcd1234...xyz9"
    },
    {
      "id": "key_0987654321_def456",
      "name": "Read-only Key",
      "permissions": ["read"],
      "createdAt": 1705398600000,
      "createdBy": "admin",
      "expiresAt": 1736934600000,
      "disabled": false,
      "key": "tk_efgh5678...uvw0"
    }
  ]
}
```

### 3. 创建 API Key

**请求**
```http
POST /api/v1/auth/api-keys
Content-Type: application/json
```

**请求体**
```json
{
  "name": "My API Key",
  "permissions": ["read", "write"],
  "expiresAt": 1736934600000
}
```

**请求参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `name` | string | 是 | API Key 名称 |
| `permissions` | array | 否 | 权限列表，默认 ["read"] |
| `expiresAt` | integer | 否 | 过期时间戳（毫秒），null 表示永不过期 |

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": "key_1234567890_abc123",
    "name": "My API Key",
    "permissions": ["read", "write"],
    "createdAt": 1705312200000,
    "createdBy": "admin",
    "expiresAt": 1736934600000,
    "disabled": false,
    "key": "tk_abcd1234...xyz9"
  },
  "fullKey": "tk_abcd1234efgh5678ijkl9012mnop3456qrst7890uvwxyz12"
}
```

**注意**: `fullKey` 字段只在创建时返回，请妥善保存。

### 4. 删除 API Key

**请求**
```http
DELETE /api/v1/auth/api-keys/{id}
```

**路径参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `id` | string | 是 | API Key ID |

**权限要求**: `admin`

**响应示例**
```json
{
  "success": true,
  "message": "API Key deleted successfully"
}
```

## 权限级别说明

### read
- 查看文件列表和详情
- 访问系统信息端点

### write
- 上传文件
- 更新文件信息
- 包含 read 权限的所有功能

### delete
- 删除文件
- 包含 write 权限的所有功能

### admin
- 管理 API Key
- 管理 Webhook
- 访问所有管理功能
- 包含 delete 权限的所有功能

## 认证方式详解

### API Key 认证
API Key 是一个以 `tk_` 开头的 48 位字符串，通过 HTTP 头部传递：

```http
X-API-Key: tk_abcd1234efgh5678ijkl9012mnop3456qrst7890uvwxyz12
```

### JWT Token 认证
JWT Token 通过 Authorization 头部传递：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

JWT Token 包含以下信息：
- 用户 ID 和名称
- 权限列表
- 过期时间
- 签发时间

## 错误响应

### 认证失败
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid credentials",
    "details": "Username or password is incorrect"
  }
}
```

### API Key 无效
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key 无效",
    "details": "The provided API key is invalid or expired"
  }
}
```

### Token 过期
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

### 权限不足
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

## 使用示例

### JavaScript
```javascript
// 生成 JWT Token
const tokenResponse = await fetch('/api/v1/auth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'your_password',
    expiresIn: 7200
  })
});

const tokenData = await tokenResponse.json();
const token = tokenData.data.token;

// 使用 Token 访问 API
const filesResponse = await fetch('/api/v1/files', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 创建 API Key
const keyResponse = await fetch('/api/v1/auth/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Frontend App Key',
    permissions: ['read', 'write']
  })
});

const keyData = await keyResponse.json();
const apiKey = keyData.fullKey;
```

### cURL
```bash
# 生成 JWT Token
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' \
  https://your-domain.com/api/v1/auth/token

# 创建 API Key
curl -X POST \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Key","permissions":["read","write"]}' \
  https://your-domain.com/api/v1/auth/api-keys

# 获取 API Key 列表
curl -H "Authorization: Bearer your_jwt_token" \
  https://your-domain.com/api/v1/auth/api-keys

# 删除 API Key
curl -X DELETE \
  -H "Authorization: Bearer your_jwt_token" \
  https://your-domain.com/api/v1/auth/api-keys/key_1234567890_abc123
```

## 安全建议

1. **API Key 安全**
   - 不要在客户端代码中硬编码 API Key
   - 定期轮换 API Key
   - 为不同用途创建不同权限的 API Key

2. **JWT Token 安全**
   - 设置合理的过期时间
   - 在安全的地方存储 Token
   - 实现 Token 刷新机制

3. **权限控制**
   - 遵循最小权限原则
   - 定期审查权限分配
   - 及时删除不再使用的 API Key

## 用户管理 API

### 获取用户列表

**请求**
```http
GET /api/v1/users
Authorization: Bearer {jwt_token}
```

**权限要求**: `admin:full`

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_1234567890",
      "username": "john_doe",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "uploader",
      "permissions": ["read", "write"],
      "status": "active",
      "createdAt": 1640995200000,
      "lastLoginAt": 1640995200000,
      "loginCount": 5
    }
  ]
}
```

### 创建用户

**请求**
```http
POST /api/v1/users
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**权限要求**: `admin:full`

**请求体**
```json
{
  "username": "new_user",
  "password": "secure_password",
  "name": "New User",
  "email": "user@example.com",
  "role": "uploader",
  "status": "active"
}
```

### 生成用户 API Token

**请求**
```http
POST /api/v1/users/{userId}/token
Authorization: Bearer {jwt_token}
```

**权限要求**: 用户可以为自己生成 Token，管理员可以为任何用户生成

## 权限管理 API

### 获取权限定义

**请求**
```http
GET /api/v1/permissions/definitions
Authorization: Bearer {jwt_token}
```

**权限要求**: 任何认证用户

**响应示例**
```json
{
  "success": true,
  "data": {
    "permissions": {
      "files:read": "查看文件信息",
      "files:upload": "上传文件",
      "admin:full": "完全管理权限"
    },
    "permissionGroups": {
      "read": ["files:read", "files:list"],
      "write": ["files:upload", "files:update"],
      "admin": ["admin:full"]
    },
    "roles": {
      "viewer": {
        "name": "查看者",
        "permissions": ["read"]
      },
      "admin": {
        "name": "超级管理员",
        "permissions": ["read", "write", "delete", "admin"]
      }
    }
  }
}
```

### 检查权限

**请求**
```http
POST /api/v1/permissions/check
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**请求体**
```json
{
  "permissions": ["files:read", "files:upload", "admin:full"]
}
```

**响应示例**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "name": "John Doe",
      "type": "jwt"
    },
    "permissions": {
      "files:read": true,
      "files:upload": true,
      "admin:full": false
    },
    "checkedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

## 增强权限系统

### 细粒度权限

新的权限系统支持更细粒度的权限控制：

| 权限 | 描述 |
|------|------|
| `files:read` | 查看文件信息 |
| `files:list` | 列出文件 |
| `files:upload` | 上传文件 |
| `files:update` | 更新文件元数据 |
| `files:delete` | 删除文件 |
| `apikeys:create` | 创建 API Key |
| `apikeys:read` | 查看 API Key |
| `apikeys:delete` | 删除 API Key |
| `webhooks:create` | 创建 Webhook |
| `webhooks:read` | 查看 Webhook |
| `webhooks:delete` | 删除 Webhook |
| `stats:read` | 查看统计信息 |
| `admin:full` | 完全管理权限 |

### 用户角色

| 角色 | 权限组 | 描述 |
|------|--------|------|
| `viewer` | `read` | 查看者，只能查看文件 |
| `uploader` | `read`, `write` | 上传者，可以上传和管理文件 |
| `moderator` | `read`, `write`, `delete` | 管理员，可以管理所有文件 |
| `admin` | `read`, `write`, `delete`, `admin` | 超级管理员，拥有所有权限 |
