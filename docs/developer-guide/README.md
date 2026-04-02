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

| 层级 | 技术 |
| --- | --- |
| Web 前端 | Vue 3 + Vite + Tailwind CSS v4 |
| 小程序 | 微信小程序 + TypeScript + SCSS + Skyline / glass-easel |
| 后端 | Cloudflare Pages Functions + Hono |
| 数据库 | Cloudflare D1 |
| 存储 | Cloudflare R2（默认） |
| 认证 | Basic Auth + 自定义 JWT + Sales access token |

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
pnpm test:unit
pnpm test:real-api:full-chain
```

### 数据库迁移

```bash
pnpm db:migrate:local
pnpm db:migrate:preview:raw
pnpm db:migrate:prod:raw
```

## 说明

- `pnpm dev` 只启动 Vite，不会拉起本地 Pages Worker
- 若要联调 Hono 路由、D1 和 R2，请使用 `pnpm dev:all`
- 当前数据库名称与 `wrangler.toml` 保持一致，为 `kk-life-db`
