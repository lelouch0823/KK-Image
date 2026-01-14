# 环境变量配置指南

本文档详细说明了 **kk-life** 的环境变量配置。

## 📋 基础配置 (必需)

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `BASIC_USER` | `admin` | 后台管理员用户名 |
| `BASIC_PASS` | `password123` | 后台管理员密码 |
| `JWT_SECRET` | `ChangeMe!!!` | JWT 签名密钥 (建议 32+ 字符随机串) |

---

## 🔧 存储配置 (高级)

kk-life 支持强大的多存储策略引擎，支持 R2, S3, Telegram 及其组合。

### 模式选择
`STORAGE_MODE`
- `single`: 单一存储 (默认)
- `redundant`: 冗余备份 (同时上传到主存储和镜像)
- `smart`: 智能路由 (根据文件大小/类型动态选择)

### 存储提供商
`STORAGE_PROVIDER` (或 `STORAGE_PRIMARY`)
- `r2`: Cloudflare R2 (推荐)
- `telegram`: Telegram Bot API (无限流量，单文件 <20MB)
- `s3`: 任意 S3 兼容对象存储 (AWS, MinIO, OSS)

---

## 📦 提供商详细配置

### 1. Telegram 存储
仅当 `STORAGE_PROVIDER = telegram` 时需配置：
- `TG_Bot_Token`: Bot Token (来自 @BotFather)
- `TG_Chat_ID`: 频道 ID (如 -100xxxx)

### 2. S3 兼容存储
仅当 `STORAGE_PROVIDER = s3` 时需配置：
- `S3_ENDPOINT`: API 端点 (https://s3.us-east-1.amazonaws.com)
- `S3_BUCKET`: 存储桶名称
- `S3_REGION`: 区域 (auto)
- `S3_ACCESS_KEY_ID`: Access Key
- `S3_SECRET_ACCESS_KEY`: Secret Key

---

## 🛡️ 安全与功能开关

- `WhiteList_Mode`: `"true"`/`"false"` (开启后仅允许白名单图片访问)
- `disable_telemetry`: `"true"` (禁用匿名 usage 统计)
- `ModerateContentApiKey`: 内容审查 API Key
- `SENTRY_DSN`: Sentry 错误追踪 DSN
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile 验证配置

## 📱 微信小程序集成
仅当需要启用销售端小程序一键登录时配置：

- `WECHAT_APPID`: 小程序 AppID
- `WECHAT_SECRET`: 小程序 AppSecret
