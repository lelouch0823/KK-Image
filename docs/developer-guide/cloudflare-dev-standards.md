# Cloudflare 平台开发规范

本文档记录当前仓库在 Cloudflare Pages Functions、D1、R2 侧的工程约束。

## 1. 路由组织

- 业务主路由统一由 `functions/lib/hono/app.js` 挂载
- 不再把 `functions/api/*` 的文件式业务路由视为主结构
- 中间件统一放在 `functions/lib/hono/middleware/`

## 2. D1 规范

- 必须使用参数绑定，禁止 SQL 字符串拼接
- 批量写入优先使用 `env.DB.batch(...)`
- 数据库结构变更统一走 `migrations/`

## 3. R2 与存储规范

- 默认对象存储为 R2
- Telegram / S3 兼容存储属于可选 provider
- 对外公开访问能力由应用层路由、公开分享页和对象 URL 规则共同决定，不再把本项目简单描述为“公开图床”

## 4. Secrets 与配置

- 本地敏感值放 `.dev.vars`
- 生产敏感值放 Dashboard / secrets
- 绑定和环境变量以根目录 `wrangler.toml` 为准

## 5. 本地开发约定

- 只调前端：`pnpm dev`
- 联调 Pages Worker、D1、R2：`pnpm dev:all`
- 真实链路回归：`pnpm test:real-api:full-chain`
