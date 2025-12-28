# 安装部署指南

本指南将详细介绍如何部署 **KK-Image (Pro)** 到 Cloudflare Pages。
本项目基于现代化全栈架构 (Vue 3 + D1 + R2)，请务必完整阅读以下步骤。

## 📋 部署概览

主要组件包括：
- **Cloudflare Pages**: 托管前端和后端 Functions
- **Cloudflare D1**: SQL 数据库 (存放空间、文件索引) **(必需)**
- **Cloudflare R2**: 对象存储 (存放图片文件) **(必需)**
- **Cloudflare KV**: 配置存储

## 🔧 详细部署步骤

### 步骤 1: Fork 项目

1. 访问 [KK-Image GitHub 仓库](https://github.com/cf-pages/KK-Image)
2. 点击 **Fork** 按钮到您的账户

### 步骤 2: Cloudflare 资源准备 (关键)

在部署之前，由于 Cloudflare Pages 部署流程的限制，建议先在 Cloudflare Dashboard 创建好必要的数据库和存储桶。

#### 2.1 创建 D1 数据库
1. 登录 Cloudflare Dashboard -> **Workers & Pages** -> **D1 SQL Database**.
2. 点击 **Create**，命名为 `kk-image-db`.
3. 创建成功后，记下 database ID (部署绑定时可能用到，但在 Pages 界面通常只需选择名称)。

#### 2.2 创建 R2 存储桶
1. 进入 **R2 Object Storage**.
2. 点击 **Create bucket**，命名为 `kk-image-storage` (或自定义).
3. 保持默认设置创建。

### 步骤 3: Cloudflare Pages 部署

1. 进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. 选择您 Fork 的 `KK-Image` 仓库。
3. **构建配置 (Build settings)**:
    - **Project name**: `kk-image` (任意)
    - **Production branch**: `main`
    - **Framework preset**: `Vue` (或者 None)
    - **Build command**: `npm run build`
    - **Build output directory**: `dist`

4. **不要立即点击部署**，或者等待失败后再去设置绑定。建议先保存项目（如果可以）或在首次部署失败后配置绑定。

### 步骤 4: 绑定资源 (Bindings)

进入 Pages 项目 -> **Settings** -> **Functions**:

1. **D1 Database Bindings**:
    - Variable name: `DB` (必须完全一致)
    - D1 database: 选择 `kk-image-db`
2. **R2 Bucket Bindings**:
    - Variable name: `R2_BUCKET` (必须完全一致)
    - R2 bucket: 选择 `kk-image-storage`
3. **KV Namespace Bindings**:
    - Variable name: `KV`
    - Namespace: 创建一个新的 KV 命名空间并绑定

### 步骤 5: 环境变量 (Environment Variables)

进入 Pages 项目 -> **Settings** -> **Environment variables**:

| 变量名 | 必填 | 说明 |
|--------|-----|------|
| `BASIC_USER` | 是 | 后台管理员用户名 (如 admin) |
| `BASIC_PASS` | 是 | 后台管理员密码 |
| `TG_Bot_Token` | 否 | (可选) Telegram Bot Token |
| `TG_Chat_ID` | 否 | (可选) Telegram Channel ID |

### 步骤 6: 初始化数据库

部署完成后，由于 D1 是空的，需要初始化表结构。
推荐使用 Wrangler 本地操作（需安装 Node.js 和 Wrangler）：

```bash
# 登录 Cloudflare
npx wrangler login

# 在本地执行远程迁移 (将 id 替换为您的 D1 ID)
npx wrangler d1 execute kk-image-db --remote --file=./migrations/0002_create_spaces_table.sql
```
*(注：如果无法本地操作，可以通过后台提供的数据库初始化 API，或等待后续版本集成的网页端初始化工具)*

### 步骤 7: 完成

访问您的 `*.pages.dev` 域名，使用 `BASIC_USER` 和 `BASIC_PASS` 登录后台。
