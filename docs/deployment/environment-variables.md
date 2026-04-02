# 环境变量配置指南

本文档汇总当前仓库仍在使用的主要环境变量。实际默认值与环境分层以仓库根目录的 `wrangler.toml` 为准。

## 1. 基础认证

| 变量名 | 必需 | 说明 |
| --- | --- | --- |
| `BASIC_USER` | 是 | 管理员用户名 |
| `BASIC_PASS` | 是 | 管理员密码 |
| `JWT_SECRET` | 是 | JWT 签名密钥 |

## 2. 存储配置

| 变量名 | 必需 | 说明 |
| --- | --- | --- |
| `STORAGE_MODE` | 否 | `single` / `redundant` / `smart` |
| `STORAGE_PROVIDER` | 否 | 默认存储提供者，通常为 `r2` |
| `STORAGE_PRIMARY` | 否 | 主存储提供者 |
| `STORAGE_MIRRORS` | 否 | 镜像提供者列表 |
| `STORAGE_MIRROR_ASYNC` | 否 | 是否异步镜像 |
| `STORAGE_FALLBACK_ENABLED` | 否 | 是否启用回退链 |
| `STORAGE_FALLBACK_CHAIN` | 否 | 回退链，如 `r2,s3,telegram` |
| `STORAGE_FALLBACK_TIMEOUT` | 否 | 单次回退超时毫秒数 |
| `S3_REGION` | 否 | S3 兼容存储区域，默认 `auto` |

### 默认推荐

- `STORAGE_PROVIDER=r2`
- `STORAGE_PRIMARY=r2`
- `STORAGE_MODE=single`

## 3. Telegram 存储（可选）

仅在使用 Telegram 作为存储提供者时需要：

- `TG_Bot_Token`
- `TG_Chat_ID`

## 4. S3 兼容存储（可选）

仅在使用 `s3` 提供者时需要：

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## 5. 登录与安全增强（可选）

| 变量名 | 说明 |
| --- | --- |
| `TURNSTILE_SITE_KEY` | 登录页 / 公开页面使用的 Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key |
| `SENTRY_DSN` | Sentry 错误监控 |
| `ModerateContentApiKey` | 内容审查服务 |
| `WhiteList_Mode` | 白名单模式开关 |
| `disable_telemetry` | 关闭遥测 |

## 6. 微信销售端（可选）

若启用小程序一键登录：

- `WECHAT_APPID`
- `WECHAT_SECRET`

## 7. AI 配置（可选）

若启用 AI 设置页与 AI 路由：

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODELS`
- `AI_MODEL_SWITCH_THRESHOLD`

## 8. 绑定不是环境变量

以下内容需要在 Cloudflare 绑定，而不是写成普通字符串环境变量：

- D1：`DB`
- R2：`R2_BUCKET`
- 可选 R2：`R2_BACKUP_BUCKET`
- 可选 KV：`KV`
- 可选 KV：`AI_KV`

## 9. 推荐做法

- 生产环境优先通过 Dashboard 或 secret 管理敏感值
- 本地开发将敏感值放在 `.dev.vars`
- 不要把真实密钥直接提交到仓库
