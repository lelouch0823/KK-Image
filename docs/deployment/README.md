# 部署指南

本指南只保留当前仓库实际存在、且与代码一致的部署信息。

## 1. 必需资源

- Cloudflare Pages
- Cloudflare D1
- Cloudflare R2

必需绑定：

- `DB`
- `R2_BUCKET`

## 2. 必需环境变量

- `BASIC_USER`
- `BASIC_PASS`
- `JWT_SECRET`

其余变量见 [environment-variables.md](environment-variables.md)。

## 3. 推荐命令

### 本地

```bash
pnpm install
pnpm db:migrate:local
pnpm dev:all
pnpm test
```

### 预览

```bash
pnpm build
pnpm db:migrate:preview:raw
pnpm deploy:preview
```

### 生产

```bash
pnpm build
pnpm db:migrate:prod:raw
pnpm deploy:prod
```

## 4. Pages 构建设置

- Build command: `pnpm build`
- Output directory: `dist`

## 5. `wrangler.toml` 说明

仓库已经提供当前使用的 `wrangler.toml`，其中包含：

- 本地开发默认绑定
- `production` / `preview` 环境变量示例
- D1 / R2 / KV 绑定结构
- 多存储后端相关配置

部署时应以仓库根目录的 [wrangler.toml](../../wrangler.toml) 为准，而不是手写旧版示例。

## 6. 建议的部署后检查

完成部署后，优先验证：

- `/login`
- `/admin`
- `/admin/files`
- `/sales/:token`
- `/space/:token`

如果要验证全链业务回归，建议在本地或预览环境执行：

```bash
pnpm build
pnpm start
pnpm test:real-api:full-chain
```

如果你要在本地保留更接近部署形态的黑盒 Worker / HTTP 验收口径，请改用：

```bash
pnpm build
pnpm start
pnpm test:real-api:blackbox
```

补充说明：

- `pnpm test:real-api` / `pnpm test:real-api:fast` 偏向开发期快速回归，部分重销售链路会启用 direct in-process transport。
- `pnpm test:real-api:blackbox`、`pnpm test:real-api:coverage:blackbox`、`pnpm test:real-api:full-chain:blackbox` 保留本地 `wrangler pages dev` 黑盒 HTTP 口径，更适合做高保真验收。

开始前请先确认：

- 本地迁移已应用
- `127.0.0.1:8080` 没有残留 Worker 占用
- `http://127.0.0.1:8080/api/v1/health` 返回健康响应

## 7. 常见误区

- `pnpm dev` 只启动前端，不会启动 Pages Worker
- `pnpm test` 不等于真实 API 已验证
- 根路径 `/` 不是公开上传页，而是会跳转到 `/login`
- Telegram 存储不是必需项；默认推荐使用 R2
