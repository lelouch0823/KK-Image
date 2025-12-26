# 环境变量配置指南

本文档详细说明了 KK-Image 项目中所有环境变量的配置方法、用途和最佳实践。

## 📋 快速开始

### 存储选择（三选一）

| 存储提供者 | 配置要求 | 推荐场景 |
|-----------|----------|----------|
| **R2** (推荐) | 绑定 R2 桶 | 默认选择，无出站费用 |
| **Telegram** | `TG_Bot_Token` + `TG_Chat_ID` | 免费无限存储，5MB 限制 |
| **S3** | `S3_*` 变量 | 已有 S3 兼容服务 |

## 🔧 配置方式

### 本地开发环境

配置已在 `wrangler.toml` 中预设：

```toml
[vars]
# 存储模式：single, smart, redundant
STORAGE_MODE = "single"

# 主存储：r2, telegram, s3
STORAGE_PROVIDER = "r2"

# Telegram 配置（使用 telegram 存储时）
TG_Bot_Token = ""
TG_Chat_ID = ""

# S3 配置（使用 s3 存储时）
S3_ENDPOINT = ""
S3_BUCKET = ""
S3_ACCESS_KEY_ID = ""
S3_SECRET_ACCESS_KEY = ""
S3_REGION = "auto"
```

### 生产环境（Cloudflare Pages）

1. 登录 Cloudflare Dashboard
2. 进入 Pages 项目 → Settings → Environment variables
3. 添加敏感变量（如 Token、密钥）

> ⚠️ **安全提示**：敏感信息（如 `TG_Bot_Token`、`S3_SECRET_ACCESS_KEY`）应通过 Dashboard 设置，不要写入 `wrangler.toml`。

---

## 📝 环境变量详解

### 🔧 存储配置

#### `STORAGE_MODE`
| 值 | 说明 |
|----|------|
| `single` | 单一存储（默认） |
| `smart` | 智能路由（根据规则自动选择） |
| `redundant` | 冗余备份（同时存储到多个后端） |

#### `STORAGE_PROVIDER` / `STORAGE_PRIMARY`
| 值 | 存储服务 | 配置要求 |
|----|----------|----------|
| `r2` | Cloudflare R2 | 绑定 R2 桶 |
| `telegram` | Telegram Bot API | `TG_Bot_Token`, `TG_Chat_ID` |
| `s3` | S3 兼容服务 | `S3_*` 变量 |

#### `STORAGE_MIRRORS`
- **用途**: 冗余模式下的镜像存储列表
- **格式**: 逗号分隔，如 `"s3,telegram"`
- **示例**: `STORAGE_MIRRORS = "telegram"` 表示主存储上传后镜像到 Telegram

#### `STORAGE_MIRROR_ASYNC`
- `"true"`: 异步镜像（快速响应，后台同步）
- `"false"`: 同步镜像（等待所有存储完成）

#### `STORAGE_FALLBACK_ENABLED`
- `"true"`: 启用回退（主存储失败时尝试其他存储）
- `"false"`: 禁用回退

#### `STORAGE_FALLBACK_CHAIN`
- **用途**: 回退顺序
- **默认**: `"r2,s3,telegram"`

#### `STORAGE_FALLBACK_TIMEOUT`
- **用途**: 回退超时时间（毫秒）
- **默认**: `"3000"`

---

### 📦 Telegram 存储配置

> 仅当 `STORAGE_PROVIDER = "telegram"` 时需要配置

#### `TG_Bot_Token`
- **用途**: Telegram Bot API 令牌
- **获取**: 通过 [@BotFather](https://t.me/BotFather) 创建 Bot
- **格式**: `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`
- **安全级别**: 🔴 高度敏感

#### `TG_Chat_ID`
- **用途**: 存储文件的频道/群组 ID
- **格式**: `-1001234567890`
- **安全级别**: 🟡 中等敏感

---

### ☁️ S3 存储配置

> 仅当 `STORAGE_PROVIDER = "s3"` 时需要配置

#### `S3_ENDPOINT`
- **用途**: S3 API 端点
- **示例**:
  - AWS: `https://s3.amazonaws.com`
  - MinIO: `https://minio.example.com`
  - 阿里云: `https://oss-cn-hangzhou.aliyuncs.com`

#### `S3_BUCKET`
- **用途**: 桶名称

#### `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
- **用途**: 访问凭证
- **安全级别**: 🔴 高度敏感

#### `S3_REGION`
- **用途**: 区域
- **默认**: `"auto"`

---

### 🔐 管理员认证

#### `BASIC_USER` / `BASIC_PASS`
- **用途**: 管理后台基础认证
- **安全建议**: 使用强密码，生产环境通过 Dashboard 设置

#### `JWT_SECRET`
- **用途**: JWT 签名密钥
- **生成**: `openssl rand -base64 32`
- **安全级别**: 🔴 高度敏感

---

### 🛡️ 功能开关

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WhiteList_Mode` | `"false"` | 白名单模式 |
| `disable_telemetry` | `"false"` | 禁用遥测 |
| `ModerateContentApiKey` | `""` | 内容审查 API |
| `SENTRY_DSN` | `""` | Sentry 错误监控 |

---

## 📊 配置示例

### 示例 1: 仅使用 R2（推荐）

```toml
[vars]
STORAGE_MODE = "single"
STORAGE_PROVIDER = "r2"
```

### 示例 2: 使用 Telegram

```toml
[vars]
STORAGE_MODE = "single"
STORAGE_PROVIDER = "telegram"
TG_Bot_Token = "your-token-here"
TG_Chat_ID = "-1001234567890"
```

### 示例 3: R2 主存储 + Telegram 备份

```toml
[vars]
STORAGE_MODE = "redundant"
STORAGE_PRIMARY = "r2"
STORAGE_MIRRORS = "telegram"
STORAGE_MIRROR_ASYNC = "true"
TG_Bot_Token = "your-token-here"
TG_Chat_ID = "-1001234567890"
```

### 示例 4: 智能路由

```toml
[vars]
STORAGE_MODE = "smart"
STORAGE_RULES = '[{"condition":"size < 5242880","storage":"telegram"},{"default":true,"storage":"r2"}]'
TG_Bot_Token = "your-token-here"
TG_Chat_ID = "-1001234567890"
```
