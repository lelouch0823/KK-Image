# 环境变量配置指南

本文档汇总当前仓库仍在使用的主要环境变量。实际默认值与环境分层以仓库根目录的 `wrangler.toml` 为准。

## 1. 基础认证

| 变量名            | 必需 | 说明                                                            |
| ----------------- | ---- | --------------------------------------------------------------- |
| `BASIC_USER`      | 是   | 管理员用户名                                                    |
| `BASIC_PASS`      | 是   | 管理员密码                                                      |
| `JWT_SECRET`      | 是   | JWT 签名密钥                                                    |
| `PASSWORD_PEPPER` | 否   | 密码 / 分享口令哈希 pepper；未配置时部分路径回退到 `JWT_SECRET` |
| `DEFAULT_API_KEY` | 否   | 兼容 API key fallback；生产建议显式管理 API key                 |
| `CORS_ORIGINS`    | 否   | 允许的 Origin 列表，逗号分隔                                    |
| `CRON_SECRET`     | 是   | `/api/cron/*` 定时任务 Bearer 密钥                              |
| `ENVIRONMENT`     | 否   | 运行环境标识，如 `development` / `production`                   |
| `MAX_UPLOAD_SIZE` | 否   | 单文件上传上限字节数；未配置时使用 Cloudflare 默认上限          |

## 2. 存储配置

| 变量名                     | 必需 | 说明                                              |
| -------------------------- | ---- | ------------------------------------------------- |
| `STORAGE_MODE`             | 否   | `single` / `redundant` / `smart`                  |
| `STORAGE_PROVIDER`         | 否   | 默认存储提供者，通常为 `r2`                       |
| `STORAGE_PRIMARY`          | 否   | 主存储提供者                                      |
| `STORAGE_MIRRORS`          | 否   | 镜像提供者列表                                    |
| `STORAGE_MIRROR_ASYNC`     | 否   | 是否异步镜像                                      |
| `STORAGE_FALLBACK_ENABLED` | 否   | 是否启用回退链                                    |
| `STORAGE_FALLBACK_CHAIN`   | 否   | 回退链，如 `r2,s3,telegram`                       |
| `STORAGE_FALLBACK_TIMEOUT` | 否   | 单次回退超时毫秒数                                |
| `STORAGE_RULES`            | 否   | JSON 存储路由规则，按文件类型 / 大小选择 provider |
| `S3_REGION`                | 否   | S3 兼容存储区域，默认 `auto`                      |

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

| 变量名                           | 说明                                       |
| -------------------------------- | ------------------------------------------ |
| `TURNSTILE_SITE_KEY`             | 登录页 / 公开页面使用的 Turnstile site key |
| `TURNSTILE_SECRET_KEY`           | Turnstile secret key                       |
| `TURNSTILE_TIMEOUT_MS`           | Turnstile 服务端校验超时                   |
| `TURNSTILE_RATE_LIMIT_MAX`       | Turnstile 校验窗口内最大尝试次数           |
| `TURNSTILE_RATE_LIMIT_WINDOW_MS` | Turnstile 校验限流窗口                     |
| `SENTRY_DSN`                     | Sentry 错误监控                            |
| `SENTRY_TRACES_SAMPLE_RATE`      | Sentry trace 采样率                        |
| `ModerateContentApiKey`          | 内容审查服务                               |
| `WhiteList_Mode`                 | 白名单模式开关                             |
| `disable_telemetry`              | 关闭遥测                                   |

## 6. 微信销售端（可选）

若启用小程序一键登录：

- `WECHAT_APPID`
- `WECHAT_SECRET`

## 7. AI 配置（可选）

若启用 AI 设置页与 AI 路由：

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_MODELS`
- `AI_DYNAMIC_FALLBACK_ENABLED`
- `AI_MODEL_HEALTH_WINDOW`
- `AI_MODEL_SWITCH_THRESHOLD`
- `AI_STREAM_GATE_ENABLED`
- `AI_STREAM_GATE_STRICT_MODE`
- `AI_MAX_TOOL_ROUNDS`
- `AI_MAX_TOOLS_PER_ROUND`
- `AI_RATE_LIMIT_ENABLED`
- `AI_RATE_LIMIT_RPM`
- `AI_RATE_LIMIT_TPD`
- `AI_RATE_LIMIT_IMAGE_RPM`

AI 运行时优先读取数据库里的设置页配置；环境变量用于默认值、冷启动和无数据库配置时的 fallback。

## 8. 邮件通知（可选）

若启用邮件通知：

- `EMAIL_ENABLED`
- `EMAIL_FROM`

## 9. 绑定不是环境变量

以下内容需要在 Cloudflare 绑定，而不是写成普通字符串环境变量：

- D1：`DB`
- R2：`R2_BUCKET`
- 可选 R2：`R2_BACKUP_BUCKET`
- 可选 KV：`KV`
- 可选 KV：`AI_KV`
- 可选 KV：`RATE_LIMIT_KV`
- Pages assets：`ASSETS`

## 10. 测试 / 部署脚本专用变量

以下变量主要由脚本、测试或部署验证使用，不属于线上业务功能必需项：

- `REAL_API_BASE_URL`
- `REAL_API_PROFILE`
- `REAL_API_TRANSPORT`
- `REAL_API_SALES_DIRECT`
- `RUN_REAL_API_TESTS`
- `REAL_API_TEST_TIMEOUT_MS`
- `D1_SAFE_TRANSIENT_RETRIES`
- `D1_SAFE_MAX_FALLBACKS`
- `DEPLOY_URL`
- `TEST_USERNAME`
- `TEST_PASSWORD`
- `SDK_SPEC_URL`
- `DEPLOY_VERIFY_WAIT_ON`
- `SKIP_PREVIEW`

以下变量由 Cloudflare Pages / Vite 等平台或框架注入，通常不需要手动配置：

- `CF_PAGES_BRANCH`
- `CF_PAGES_COMMIT_SHA`
- `DEV`

## 11. 推荐做法

- 生产环境优先通过 Dashboard 或 secret 管理敏感值
- 本地开发将敏感值放在 `.dev.vars`
- 不要把真实密钥直接提交到仓库
