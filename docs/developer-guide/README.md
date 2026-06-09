# 开发者指南

本节面向当前仓库的维护者与二次开发者，默认以“真实代码结构 + 当前脚本”作为唯一准绳。

## 入口文档

- [系统架构设计](architecture.md)
- [Cloudflare 开发规范](cloudflare-dev-standards.md)
- [Wrangler 指南](wrangler-guide.md)
- [Pages Context](cloudflare-pages-context.md)
- [授权策略系统](authz-policy-system.md)
- [审计保留与归档](audit-retention.md)
- [审计告警与升级钩子](audit-alerting.md)
- [微信小程序（minisales）](minisales.md)

## 技术栈

| 层级     | 技术                                                   |
| -------- | ------------------------------------------------------ |
| Web 前端 | Vue 3 + Vite + Tailwind CSS v4                         |
| 小程序   | 微信小程序 + TypeScript + SCSS + Skyline / glass-easel |
| 后端     | Cloudflare Pages Functions + Hono                      |
| 数据库   | Cloudflare D1                                          |
| 存储     | Cloudflare R2（默认）                                  |
| 认证     | Basic Auth + 自定义 JWT + Sales access token           |

## 常用命令

### 本地开发

```bash
pnpm install
pnpm dev:all
```

### 仅前端

```bash
pnpm dev
```

### 测试

```bash
pnpm test
pnpm test:unit:run
pnpm test:real-api:fast
pnpm test:e2e
```

测试口径：

- `pnpm test` 是默认仓库测试套件。
- `pnpm test:unit:run` 适合非交互、文件级验证。
- `pnpm test:real-api` / `pnpm test:real-api:fast` 是快速真实 API 业务回归，需要 `REAL_API_BASE_URL` 指向可访问 Worker；部分销售链路使用 direct in-process transport。
- `pnpm test:real-api:blackbox`、`pnpm test:real-api:full-chain:blackbox` 是本地 Worker / HTTP 高保真验收口径，需要先 `pnpm build` + `pnpm start`。
- `pnpm test:e2e` 走 Playwright；仓库已声明 `@playwright/test`，首次运行前按本地环境需要安装浏览器。

### 数据库迁移

```bash
pnpm db:migrate:local
pnpm db:migrate:preview:raw
pnpm db:migrate:prod:raw
```

## 说明

- `pnpm dev` 只启动 Vite，不会拉起本地 Pages Worker
- 若要联调 Hono 路由、D1 和 R2，请使用 `pnpm dev:all`
- 当前后端是 Hono 主业务路由加少量文件式 public/cron 路由并存
- 管理端路由、侧边栏、命令面板、最近访问和 AI context inference 的 feature metadata 以 `src/config/admin-features.ts` 为准
- 当前数据库名称与 `wrangler.toml` 保持一致，为 `kk-life-db`
