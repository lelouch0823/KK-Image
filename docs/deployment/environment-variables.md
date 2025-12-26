# 环境变量配置指南

本文档详细说明了 Telegraph-Image 项目中所有环境变量的配置方法、用途和最佳实践。

## 📋 环境变量概览

Telegraph-Image 使用环境变量来管理不同环境下的配置，包括 Telegram 集成、内容审查、管理员认证等功能的配置。

## 🔧 配置方式

### 本地开发环境

环境变量已预配置在 `wrangler.toml` 文件中：

```toml
# 全局环境变量（开发和生产环境通用）
[vars]
# Telegram 配置（必需）- 请在 Cloudflare Pages 后台设置实际值
TG_Bot_Token = "YOUR_TELEGRAM_BOT_TOKEN_HERE"
TG_Chat_ID = "YOUR_TELEGRAM_CHAT_ID_HERE"

# 内容审查配置（可选）
ModerateContentApiKey = ""

# 管理员认证配置（可选）
BASIC_USER = ""
BASIC_PASS = ""

# 功能开关（可选）
WhiteList_Mode = "false"
disable_telemetry = "false"

# 开发环境配置
[env.development.vars]
COMPRESS_STATIC_ASSETS = "false"
# 开发环境可以使用测试值
TG_Bot_Token = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
TG_Chat_ID = "-1001234567890"
BASIC_USER = "admin"
BASIC_PASS = "123456"
```

### 生产环境（Cloudflare Pages）

在 Cloudflare Pages 后台设置环境变量：

1. 登录 Cloudflare Dashboard
2. 进入 Pages 项目设置
3. 选择 "Environment variables" 选项卡
4. 添加或更新环境变量

## 📝 环境变量详解

### 🔴 必需变量

#### `STORAGE_PROVIDER`
- **用途**: 选择文件存储后端
- **可选值**: `"telegram"` | `"r2"` | `"s3"`
- **默认值**: `"telegram"`
- **安全级别**: 🟢 低敏感
- **示例**: `"telegram"`

**存储选项说明**:
| 值 | 存储服务 | 特点 |
|----|----------|------|
| `telegram` | Telegram Bot API | 无限免费存储，5MB 单文件限制 |
| `r2` | Cloudflare R2 | 原生集成，无出站费用，需绑定 R2 桶 |
| `s3` | S3 兼容服务 | 支持 AWS S3、MinIO、阿里云 OSS 等 |

#### `TG_Bot_Token`
- **用途**: Telegram Bot API 令牌
- **获取方式**: 通过 [@BotFather](https://t.me/BotFather) 创建 Bot 获得
- **格式**: `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`
- **安全级别**: 🔴 高度敏感
- **示例**: `"1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ123456"`

**获取步骤**:
1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 命令
3. 按提示设置 Bot 名称和用户名
4. 获得 Bot Token

#### `TG_Chat_ID`
- **用途**: Telegram 频道或群组 ID，用于存储上传的文件
- **获取方式**: 通过 Bot API 或第三方工具获得
- **格式**: `-1001234567890` (频道) 或 `1234567890` (私聊)
- **安全级别**: 🟡 中等敏感
- **示例**: `"-1001234567890"`

**获取步骤**:
1. 将 Bot 添加到目标频道/群组
2. 发送一条消息到频道/群组
3. 访问 `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
4. 在返回的 JSON 中找到 `chat.id` 字段

### 🟡 可选变量

#### `ModerateContentApiKey`
- **用途**: 内容审查 API 密钥，用于自动检测不当内容
- **提供商**: 支持多种内容审查服务
- **默认值**: `""` (禁用内容审查)
- **安全级别**: 🟡 中等敏感
- **示例**: `"your-content-moderation-api-key"`

#### `BASIC_USER`
- **用途**: 管理员界面登录用户名
- **默认值**: `""` (禁用基础认证)
- **安全级别**: 🟡 中等敏感
- **示例**: `"admin"`

#### `BASIC_PASS`
- **用途**: 管理员界面登录密码
- **默认值**: `""` (禁用基础认证)
- **安全级别**: 🔴 高度敏感
- **示例**: `"your-secure-password"`

**安全建议**:
- 使用强密码（至少12位，包含大小写字母、数字和特殊字符）
- 定期更换密码
- 不要在代码中硬编码密码

#### `WhiteList_Mode`
- **用途**: 启用白名单模式，只允许特定用户上传
- **可选值**: `"true"` | `"false"`
- **默认值**: `"false"`
- **安全级别**: 🟢 低敏感
- **示例**: `"false"`

#### `disable_telemetry`
- **用途**: 禁用遥测数据收集
- **可选值**: `"true"` | `"false"`
- **默认值**: `"false"`
- **安全级别**: 🟢 低敏感
- **示例**: `"false"`

#### `SENTRY_DSN`
- **用途**: Sentry 错误监控服务的 DSN（Data Source Name）
- **获取方式**: 在 [Sentry](https://sentry.io) 创建项目获得
- **默认值**: `""` (禁用 Sentry 监控)
- **安全级别**: 🟡 中等敏感
- **示例**: `"https://xxx@xxx.ingest.sentry.io/xxx"`

**说明**: 用于收集应用运行时错误，帮助快速定位和修复问题。

#### `JWT_SECRET`
- **用途**: JWT Token 签名密钥（用于 API 认证）
- **默认值**: 内置默认值（生产环境强烈建议自定义）
- **安全级别**: 🔴 高度敏感
- **示例**: `"your-random-secure-secret-key-at-least-32-chars"`

**安全建议**:
- 使用至少 32 个字符的随机字符串
- 可通过 `openssl rand -base64 32` 生成
- 定期轮换密钥

### 🟡 S3 存储配置

当 `STORAGE_PROVIDER = "s3"` 时需要配置以下变量：

#### `S3_ENDPOINT`
- **用途**: S3 兼容服务的 API 端点 URL
- **示例**: 
  - AWS S3: `"https://s3.amazonaws.com"`
  - MinIO: `"https://minio.example.com"`
  - 阿里云 OSS: `"https://oss-cn-hangzhou.aliyuncs.com"`
- **安全级别**: 🟢 低敏感

#### `S3_BUCKET`
- **用途**: S3 桶名称
- **示例**: `"my-image-bucket"`
- **安全级别**: 🟢 低敏感

#### `S3_ACCESS_KEY_ID`
- **用途**: S3 访问密钥 ID
- **安全级别**: 🟡 中等敏感
- **示例**: `"AKIAIOSFODNN7EXAMPLE"`

#### `S3_SECRET_ACCESS_KEY`
- **用途**: S3 访问密钥密码
- **安全级别**: 🔴 高度敏感
- **示例**: `"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"`

#### `S3_REGION`
- **用途**: S3 区域（如 AWS 区域）
- **默认值**: `"auto"`
- **安全级别**: 🟢 低敏感
- **示例**: `"us-east-1"`, `"cn-north-1"`

#### `COMPRESS_STATIC_ASSETS`
- **用途**: 启用静态资源压缩
- **可选值**: `"true"` | `"false"`
- **默认值**: 生产环境 `"true"`，开发环境 `"false"`
- **安全级别**: 🟢 低敏感
- **示例**: `"true"`

## 🔒 安全最佳实践

### 敏感信息保护

1. **永远不要在代码中硬编码敏感信息**
2. **使用环境变量管理所有配置**
3. **定期轮换 API 密钥和令牌**
4. **限制环境变量的访问权限**

### 环境分离

```toml
# 开发环境 - 使用测试值
[env.development.vars]
TG_Bot_Token = "123456789:TEST_BOT_TOKEN"
TG_Chat_ID = "-1001234567890"

# 生产环境 - 使用实际值
[env.production.vars]
TG_Bot_Token = "实际的Bot Token"
TG_Chat_ID = "实际的Chat ID"
```

### 访问控制

- **开发环境**: 可以使用测试值，便于开发调试
- **生产环境**: 必须使用实际值，通过 Cloudflare Pages 后台配置
- **敏感变量**: 只在生产环境中设置，开发环境使用占位符

## 🚀 部署配置

### Cloudflare Pages 配置

1. **项目设置**:
   ```
   Framework preset: None
   Build command: npm run build
   Build output directory: dist
   ```

2. **环境变量设置**:
   - 在 Cloudflare Pages 后台逐一添加环境变量
   - 生产环境和预览环境可以使用不同的值
   - 敏感变量只在需要的环境中设置

### 本地开发配置

1. **使用 wrangler.toml 中的开发配置**:
   ```bash
   wrangler pages dev dist --port 8080
   ```

2. **覆盖特定变量**:
   ```bash
   wrangler pages dev dist --binding TG_Bot_Token=your-test-token
   ```

## 🔍 故障排除

### 常见问题

#### Bot Token 无效
```
错误: Unauthorized: bot token is invalid
解决: 检查 TG_Bot_Token 是否正确，确保 Bot 未被删除
```

#### Chat ID 无效
```
错误: Bad Request: chat not found
解决: 检查 TG_Chat_ID 是否正确，确保 Bot 已加入频道/群组
```

#### 环境变量未生效
```
错误: 环境变量为 undefined
解决: 检查变量名拼写，确保在正确的环境中设置
```

### 调试方法

1. **检查环境变量加载**:
   ```javascript
   console.log('Environment variables:', {
     TG_Bot_Token: env.TG_Bot_Token ? '***' : 'undefined',
     TG_Chat_ID: env.TG_Chat_ID,
     // 其他非敏感变量
   });
   ```

2. **验证 Telegram 配置**:
   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/getMe"
   ```

## 📚 相关文档

- **[快速开始](../quick-start/README.md)** - 基础配置指南
- **[部署指南](README.md)** - 完整部署流程
- **[管理员手册](../admin-manual/README.md)** - 系统管理和维护

---

🔐 **安全提醒**: 请妥善保管所有敏感信息，定期检查和更新环境变量配置！
