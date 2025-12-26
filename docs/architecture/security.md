# 安全架构

本文档详细说明 Telegraph-Image 的安全设计和实现，包括认证、授权、数据保护等方面。

## 🔐 认证机制

### Basic Authentication

后台管理界面使用 HTTP Basic Authentication：

- **配置方式**: 通过环境变量 `BASIC_USER` 和 `BASIC_PASS` 设置
- **安全头**: 返回 `WWW-Authenticate: Basic realm="Admin Dashboard"`
- **会话控制**: 支持 `Clear-Site-Data` 头清除会话缓存

### JWT Token 认证

API 接口支持 JWT Token 认证：

**安全特性**:
- ✅ **URL-safe Base64 编码** - 符合 RFC 4648 标准
- ✅ **Unicode 支持** - 正确处理非 ASCII 字符
- ✅ **恒定时间比较** - 防止时序攻击
- ✅ **HMAC-SHA256 签名** - 强加密签名

**Token 格式**:
```
header.payload.signature
```

**配置**:
```
JWT_SECRET=your-secure-random-secret-at-least-32-chars
```

### API Key 认证

支持 API Key 用于程序化访问：

- 支持权限范围控制
- 支持过期时间设置
- 支持禁用/启用状态

## 🔑 密码存储

### PBKDF2 密钥派生

**当前实现** (SOTA 级别):

```
算法: PBKDF2
哈希函数: SHA-256
迭代次数: 100,000
密钥长度: 256 位
盐长度: 32 字节（密码学安全随机）
```

**存储格式**:
```
pbkdf2:100000:salt:hash
```

**安全优势**:
- 🛡️ 高迭代次数抵御 GPU/ASIC 暴力破解
- 🛡️ 随机盐防止彩虹表攻击
- 🛡️ 包含算法信息便于未来升级

### 向后兼容

系统支持三种历史密码格式，确保旧用户可以正常登录：

| 版本 | 格式 | 安全级别 |
|------|------|----------|
| V1 | `hash` (固定盐) | ⚠️ 低 |
| V2 | `salt:hash` (随机盐 + SHA-256) | 🔶 中 |
| V3 | `pbkdf2:iterations:salt:hash` | ✅ 高 |

> **注意**: 新创建的用户自动使用 V3 格式。建议现有用户更新密码以升级安全级别。

## 🛡️ 请求安全

### CORS 配置

```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
```

### 安全响应头

通过 `_headers` 文件配置：

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self' 'unsafe-inline' ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### 速率限制

| 接口类型 | 限制 |
|----------|------|
| 上传接口 | 60 次/分钟 |
| 访问接口 | 1000 次/分钟 |
| 管理接口 | 100 次/分钟 |

## 🔒 数据保护

### 传输加密

- **强制 HTTPS** - 所有通信使用 TLS 加密
- **TLS 1.3** - 使用最新协议版本
- **自动证书** - Cloudflare 自动管理证书

### 敏感数据处理

- ❌ 不在日志中记录敏感信息
- ❌ 不在错误响应中暴露堆栈信息
- ✅ 敏感配置使用环境变量
- ✅ 密码通过 PBKDF2 哈希存储

## 📋 内容安全

### 内容审查

集成第三方内容审查 API：

- **提供商**: ModerateContent
- **审查类型**: 自动检测不当内容
- **处理方式**: 违规内容自动屏蔽

### 访问控制

**黑名单模式**:
- 手动标记的不当内容无法访问
- 自动审查失败的内容进入黑名单

**白名单模式**:
- 只有审核通过的内容可以访问
- 适合高安全要求的场景

## 🔍 监控与审计

### Sentry 集成

- **错误追踪**: 自动收集运行时错误
- **性能监控**: 请求延迟和性能指标
- **用户会话**: 用户行为分析

**配置**:
```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### 日志记录

- 结构化 JSON 日志格式
- 分级日志记录（error, warn, info）
- 敏感信息脱敏处理

## 📚 相关文档

- **[环境变量配置](../deployment/environment-variables.md)** - 安全配置说明
- **[API 文档](../api-docs/README.md)** - 接口认证说明
- **[部署指南](../deployment/README.md)** - 安全部署最佳实践

---

🔐 **安全提醒**: 定期更新依赖、轮换密钥、审查访问日志是保持系统安全的关键！
