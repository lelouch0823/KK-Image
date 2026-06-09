# 快速开始

本节用于帮助你最快把 kk-life 跑起来，并完成一轮基础业务验证。

## 你将完成什么

1. 在 Cloudflare 上准备 D1 和 R2
2. 部署 Pages 项目
3. 配置基础环境变量
4. 完成数据库迁移
5. 验证 `/login`、`/admin`、文件上传和销售端链路

## 前置要求

- Cloudflare 账户
- Node.js 20+
- `pnpm`（推荐通过 `corepack enable` 启用）
- 可访问 Cloudflare Dashboard 与 Wrangler CLI

## 最短路径

### 本地开发

```bash
corepack enable
pnpm install
pnpm dev:all
pnpm test
```

如果要做快速真实 API 业务回归：

```bash
pnpm build
pnpm start
pnpm test:real-api:fast
```

如果要保留本地黑盒 Worker / HTTP 高保真口径：

```bash
pnpm build
pnpm start
pnpm test:real-api:full-chain:blackbox
```

### 生产部署

1. 在 Cloudflare 创建 D1 数据库和 R2 Bucket
2. 绑定 `DB` 与 `R2_BUCKET`
3. 配置 `BASIC_USER`、`BASIC_PASS`、`JWT_SECRET`
4. 构建并部署
5. 远程执行 D1 迁移

## 当前入口与验证重点

- `/login`：系统登录页
- `/admin`：管理端后台
- `/sales/:token`：销售端门户
- `/space/:token`：公开共享空间
- `/gallery/:token`：公开相册分享

## 验证口径提醒

- `pnpm test` 代表默认仓库测试套件通过，不等于真实 API 链路已经验证。
- `pnpm test:real-api` / `pnpm test:real-api:fast` 默认是本地快速回归口径，仍需要 `REAL_API_BASE_URL` 指向可访问 Worker；部分销售链路会使用 direct in-process transport，不等于黑盒 HTTP 真实性验证。
- `pnpm test:real-api:blackbox` 与 `pnpm test:real-api:full-chain:blackbox` 更接近本地真实 Worker / HTTP 形态。
- 跑 real API 前应确认本地 Worker 在 `127.0.0.1:8080` 正常启动，并且 `/api/v1/health` 可访问；只有显式 direct-only 单文件调试例外。

## 下一步阅读

- [安装部署指南](installation.md)
- [首次验证指南](first-upload.md)
- [环境变量配置](../deployment/environment-variables.md)
