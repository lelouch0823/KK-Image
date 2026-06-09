# 安装部署指南

本指南说明如何把 kk-life 部署到 Cloudflare Pages，并让当前代码库的 Web 管理端、销售端和共享空间链路正常工作。

## 1. 准备依赖

- Cloudflare Pages
- Cloudflare D1
- Cloudflare R2
- Node.js 20+
- `pnpm`

建议先启用 `corepack`：

```bash
corepack enable
```

## 2. 安装项目依赖

```bash
pnpm install
```

## 3. 创建 Cloudflare 资源

至少准备以下资源：

- D1 数据库：用于业务数据与 outbox
- R2 Bucket：主对象存储

推荐绑定名称：

- D1：`DB`
- R2：`R2_BUCKET`

可选资源：

- `R2_BACKUP_BUCKET`
- `KV`
- `AI_KV`

## 4. 配置 Pages 项目

推荐构建设置：

- Framework preset: `Vue`
- Build command: `pnpm build`
- Build output directory: `dist`

函数绑定需与仓库保持一致：

- D1 binding: `DB`
- R2 binding: `R2_BUCKET`

## 5. 配置环境变量

最低必需：

| 变量名       | 说明         |
| ------------ | ------------ |
| `BASIC_USER` | 管理员用户名 |
| `BASIC_PASS` | 管理员密码   |
| `JWT_SECRET` | JWT 签名密钥 |

常见可选项：

| 变量名                                        | 说明                                |
| --------------------------------------------- | ----------------------------------- |
| `WECHAT_APPID` / `WECHAT_SECRET`              | 销售端微信登录                      |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 登录页验证                          |
| `SENTRY_DSN`                                  | 错误监控                            |
| `ModerateContentApiKey`                       | 内容审查                            |
| `STORAGE_PROVIDER`                            | 默认 `r2`，也可用 `telegram` / `s3` |

详见 [环境变量配置指南](../deployment/environment-variables.md)。

## 6. 执行数据库迁移

### 本地

```bash
pnpm db:migrate:local
```

### 预览环境

```bash
pnpm db:migrate:preview:raw
```

### 生产环境

```bash
pnpm db:migrate:prod:raw
```

## 7. 构建与部署

### 预览部署

```bash
pnpm build
pnpm deploy:preview
```

### 生产部署

```bash
pnpm build
pnpm deploy:prod
```

## 8. 本地运行方式

### Web + Worker 一起启动

```bash
pnpm dev:all
```

### 仅前端

```bash
pnpm dev
```

注意：`pnpm dev` 只启动 Vite，不包含 Pages Worker、本地 D1 迁移和 Functions 模拟。

### 真实 API 回归

```bash
pnpm build
pnpm start
pnpm test:real-api:fast
```

如果你要在本地保留黑盒 Worker / HTTP 验收口径，请使用：

```bash
pnpm build
pnpm start
pnpm test:real-api:full-chain:blackbox
```

运行 real API profile 前请先确认：

- `pnpm db:migrate:local` 已成功执行
- `127.0.0.1:8080` 没有被残留 `workerd` / `wrangler pages dev` 占用
- `http://127.0.0.1:8080/api/v1/health` 返回健康响应

补充说明：

- `pnpm test:real-api` / `pnpm test:real-api:fast` 偏向开发期快速回归，仍需要 `REAL_API_BASE_URL` 指向可访问 Worker；部分销售链路会启用 direct transport。
- `pnpm test:real-api:blackbox`、`pnpm test:real-api:coverage:blackbox`、`pnpm test:real-api:full-chain:blackbox` 偏向本地高保真验收。

## 9. 部署后验证

优先检查以下入口：

- `/login`
- `/admin`
- `/admin/files`
- `/sales/:token`
- `/space/:token`

推荐继续阅读：

- [首次验证指南](first-upload.md)
- [部署指南](../deployment/README.md)
