# 开发者指南

本指南专为 kk-life 项目开发者设计，涵盖开发规范、架构设计和最佳实践。

## 📚 文档目录

### 核心开发规范
- **[Cloudflare 开发规范](cloudflare-dev-standards.md)** - D1/R2/Functions 最佳实践
- **[Wrangler 指南](wrangler-guide.md)** - CLI 工具使用说明
- **[Pages Context](cloudflare-pages-context.md)** - 请求上下文和中间件
- **[授权策略系统（OPA/Rego）](authz-policy-system.md)** - 权限架构、开发流程与标准

### 客户端开发
- **[微信小程序 (minisales)](minisales.md)** - 销售端小程序开发指南

### 架构设计
- **[系统架构](architecture.md)** - 模块划分和数据流

---

## 🛠️ 技术栈概览

| 层级 | 技术 |
|------|------|
| **前端 Web** | Vue 3 + Tailwind CSS v4 + Vite |
| **前端小程序** | 微信小程序 + TypeScript + Skyline |
| **后端** | Cloudflare Pages Functions (Node.js Compat) |
| **数据库** | Cloudflare D1 (SQLite) |
| **存储** | Cloudflare R2 |
| **认证** | JWT (jose) |

## 🚀 快速开始开发

### 本地开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器 (前端 + Functions 本地模拟)
npm run dev
```

### 小程序开发
```bash
cd minisales
npm install
# 使用微信开发者工具打开 minisales/ 目录
```

### 数据库迁移
```bash
# 本地 D1
npx wrangler d1 execute kk-life-db --local --file=./scripts/init-database.sql

# 远程 D1
npx wrangler d1 execute kk-life-db --remote --file=./scripts/init-database.sql
```

## 📖 相关文档

- **[API 文档](../api/README.md)** - 完整接口说明
- **[架构文档](../architecture/README.md)** - 系统设计
- **[部署指南](../deployment/README.md)** - 生产环境部署
