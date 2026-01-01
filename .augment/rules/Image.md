---
type: "always_apply"---
# kk-life 项目开发规范

## 项目概述
kk-life 是一个基于 Cloudflare Pages 全栈架构的高性能企业级文件存储与业务管理平台。采用 Vue 3 + Tailwind CSS v4 + D1/R2 技术栈，提供订单管理、CRM、共享空间、CAS 文件存储等核心功能。

## 技术栈规范

### 前端技术栈
- **Vue.js 3.5+** (`<script setup>`)
- **Tailwind CSS v4** (样式引擎)
- **Vite 6.x** (构建工具)
- **VueUse** (组合式工具库)

### 后端技术栈 (Cloudflare Pages Functions)
- **D1 Database** (核心业务数据：订单/客户/文件索引)
- **R2 Storage** (物理文件存储)
- **Cloudflare KV** (配置与缓存)
- **Hono** (轻量级 Web 框架，部分 API 使用)

### 存储架构 (CAS)
- **Files Table**: 存储逻辑文件名和目录结构
- **Blobs Table**: 存储文件内容哈希 (SHA-256)
- **R2 Bucket**: 以哈希值为 Key 存储物理文件，实现全局去重

## 架构设计原则

### 全栈边缘计算
- 前后端逻辑均运行在 Cloudflare Edge Network
- 数据库 (D1) 和存储 (R2) 紧密集成
- 使用 Smart Placement 优化访问延迟

### 模块化设计
- `functions/api/manage`: 管理端 API (Admin Auth)
- `functions/api/sales`: 销售端 API (Token Auth)
- `functions/api/space`: 访客端 API (Share Token + Password)

## 代码规范

### 命名规范
- 文件/目录：kebab-case (如 `order-list.vue`)
- 变量/函数：camelCase
- 组件名：PascalCase (如 `OrderTimeline.vue`)

### 数据库交互
- 使用 `db.prepare().bind().run()` 防止 SQL 注入
- 批量插入使用 `db.batch()`
- 读写分离逻辑由 D1 自动处理

## 部署规范
- **Production**: `npm run build` -> `dist/`
- **Wrangler**: `pages_build_output_dir = "./dist"`
- **Bindings**: 必须准确绑定 DB, R2_BUCKET, R2_BACKUP_BUCKET

## 文档规范
- 所有文档在 `docs/` 目录下维护
- 保持 `project-summary.md` 和 `DATABASE_SCHEMA.md` 作为事实来源

