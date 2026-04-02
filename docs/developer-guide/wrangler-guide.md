# Wrangler 开发指南

本文档说明当前仓库在本地开发、数据库迁移和 Pages 部署中如何使用 Wrangler。

## 1. 环境要求

- Node.js 20+
- `pnpm`
- Wrangler 4.x（仓库已在 `devDependencies` 中声明）

## 2. 当前项目中的常用命令

### 本地开发

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 仅启动 Vite 前端 |
| `pnpm dev:all` | 启动 Vite + Pages Worker，并先应用本地迁移 |
| `pnpm start` | 基于 `dist` 启动本地 Pages Worker |

### 构建与部署

| 命令 | 作用 |
| --- | --- |
| `pnpm build` | 构建前端到 `dist` |
| `pnpm deploy:preview` | 部署 preview 分支构建 |
| `pnpm deploy:prod` | 部署 main 分支构建 |

### D1 迁移

| 命令 | 作用 |
| --- | --- |
| `pnpm db:migrate:local` | 应用本地迁移 |
| `pnpm db:migrate:preview:raw` | 对 preview 环境远程应用迁移 |
| `pnpm db:migrate:prod:raw` | 对 production 环境远程应用迁移 |

## 3. 当前 `wrangler.toml` 的关键点

- 项目名：`kk-life`
- 构建输出目录：`dist`
- 默认数据库名：`kk-life-db`
- 默认主存储：R2
- 已定义 `production` 与 `preview` 环境块

不要再依赖旧文档中的 `kk-image-db`、`kk-image-storage` 或 `npm run dev` 示例。

## 4. 本地开发建议

### 推荐工作流

```bash
pnpm install
pnpm db:migrate:local
pnpm dev:all
```

### Secrets 管理

- 本地敏感值放入 `.dev.vars`
- 生产敏感值放到 Cloudflare Dashboard / secrets

示例：

```env
BASIC_USER=admin
BASIC_PASS=change-me
JWT_SECRET=replace-me
```

## 5. 常见问题

### 为什么 `pnpm dev` 看不到后端接口？

因为它只启动前端开发服务器，不包含 Pages Worker。

### 为什么真实 API 测试要先跑迁移？

因为这套仓库的大部分真实链路都依赖当前 D1 schema，旧 schema 会直接导致联调失真。
