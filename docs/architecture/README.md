# 架构文档

本目录说明 kk-life 当前真实采用的架构，而不是早期图床阶段或中间重构阶段的临时形态。

## 当前架构摘要

- 前端：Vue 3.5 + Vue Router 4 + Tailwind CSS v4 + Vite 6
- 后端主干：Cloudflare Pages Functions + Hono
- 公共补充入口：少量文件式 Functions，主要用于 `space`、`gallery`、Turnstile、cron
- 数据：Cloudflare D1
- 存储：Cloudflare R2 为默认主存储，S3 / Telegram 为可选 provider
- 副作用：durable outbox 驱动通知、Webhook、缓存失效与 replay

## 建议阅读顺序

1. [系统概览](system-overview.md)
2. [安全架构](security.md)
3. [API 路由](modules/api-routes.md)
4. [页面视图](modules/frontend-views.md)
5. [预订单创建链路](modules/preorder-creation-flow.md)
6. [仓储层](modules/repository-layer.md)

## 模块索引

### 前端

- [前端组件库](modules/frontend-components.md)
- [页面视图](modules/frontend-views.md)
- [组合式函数](modules/frontend-composables.md)

### 后端

- [API 路由](modules/api-routes.md)
- [数据访问层](modules/repository-layer.md)
- [存储层](modules/storage-layer.md)
- [预订单创建链路](modules/preorder-creation-flow.md)

## 当前关键事实

- 主业务 API 由 `functions/lib/hono/app.js` 挂载，不再以散落的文件式业务路由为主。
- 但仓库不是“纯 Hono”结构；`functions/api/space/[token].js`、`functions/api/gallery/[token].js`、`functions/api/cron/*` 仍然是当前线上路径的一部分。
- 订单域真实模型是 `orders + order_lines`，不是旧的单表订单模型。
- 采购、通知、Webhook、缓存刷新和 replay 都依赖 durable outbox，而不是主事务里的同步副作用。
- 默认测试口径是 `pnpm test`；真实链路验证需要本地 Worker 启动后再跑 `pnpm test:real-api` 或 `pnpm test:real-api:full-chain`。

## 相关文档

- [开发者指南](../developer-guide/README.md)
- [API 文档](../api/README.md)
- [部署指南](../deployment/README.md)
