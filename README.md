# kk-life

kk-life 是一个基于 Cloudflare Pages / Functions、D1、R2 构建的业务管理平台，覆盖文件管理、共享空间、销售端下单、订单协同、商品与采购、库存与审计运维等能力。

[English](README-EN.md) | 中文

## 核心能力

- 文件管理与共享空间
- 管理端后台：订单、客户、商品、采购、统计、系统设置
- 销售端：`/sales/:token` Web 门户与 `minisales/` 微信小程序
- 订单行级履约与采购投影：`orders + order_lines`
- Durable outbox、Webhook、审计日志与 replay 运维
- 默认 R2 存储，支持 Telegram / S3 兼容存储作为可选提供者

## 技术栈

- 前端：Vue 3 + Vite + Tailwind CSS v4
- 后端：Cloudflare Pages Functions + Hono
- 数据库：Cloudflare D1
- 对象存储：Cloudflare R2
- 认证：Basic Auth、JWT、Sales access token、API Key

## 当前主要入口

- 根路径 `/` 会重定向到 `/login`
- 管理端：`/admin`
- 销售端门户：`/sales/:token`
- 公开共享空间：`/space/:token`
- 公开相册：`/gallery/:token`

## 本地开发

建议使用 `pnpm`：

```bash
corepack enable
pnpm install
pnpm dev:all
```

常用命令：

```bash
pnpm test:unit
pnpm test:real-api
pnpm test:real-api:blackbox
pnpm test:real-api:full-chain
pnpm build
```

说明：

- `pnpm test:real-api` / `pnpm test:real-api:fast`：本地快速回归，部分重销售链路会启用 direct transport 加速。
- `pnpm test:real-api:blackbox`：本地高保真黑盒 Worker / HTTP 冒烟，保留真实 `wrangler pages dev` 请求路径。
- `pnpm test:real-api:coverage:blackbox` 与 `pnpm test:real-api:full-chain:blackbox`：更慢，但更接近本地真实部署形态。

`pnpm dev:all` 会先应用本地 D1 迁移，再启动 Vite 和 Pages Worker。

## 部署摘要

最低要求：

- D1 绑定：`DB`
- R2 绑定：`R2_BUCKET`
- 环境变量：`BASIC_USER`、`BASIC_PASS`、`JWT_SECRET`

常用命令：

```bash
pnpm build
pnpm db:migrate:prod:raw
pnpm deploy:prod
```

更完整的部署说明见 [docs/deployment/README.md](docs/deployment/README.md)。

## 文档导航

- [文档中心](docs/README.md)
- [快速开始](docs/quick-start/README.md)
- [部署指南](docs/deployment/README.md)
- [API 文档](docs/api/README.md)
- [开发者指南](docs/developer-guide/README.md)
- [用户手册](docs/user-manual/README.md)
- [管理员手册](docs/admin-manual/README.md)
- [架构文档](docs/architecture/README.md)

## 备注

- 当前系统不是旧版公开匿名图床首页；默认访问入口是登录页。
- Telegram 存储已降级为可选提供者，不再是必需部署条件。
- 历史计划、评审和归档文档保存在 `docs/plans`、`docs/archive`、`docs/reviews`、`docs/superpowers`，它们不代表当前产品入口文案。
