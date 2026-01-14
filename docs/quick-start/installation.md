# 安装部署指南

本指南将详细介绍如何部署 **kk-life** 到 Cloudflare Pages。
本项目基于现代化全栈架构 (Vue 3 + Tailwind CSS v4 + Cloudflare D1/R2)，请务必完整阅读以下步骤。

## 📋 部署概览 (Cloudflare Components)

- **Cloudflare Pages**: 托管前端静态资源和后端 Functions
- **Cloudflare D1**: SQL 数据库 (核心元数据、订单、空间索引) **(必需)**
- **Cloudflare R2**: 对象存储 (存放图片/视频文件) **(必需)**

## 🔧 详细部署步骤

### 步骤 1: Fork 项目

1. 访问 [kk-life GitHub 仓库](https://github.com/cf-pages/kk-life)
2. 点击 **Fork** 按钮到您的账户

### 步骤 2: Cloudflare 资源准备 (Dashboard 操作)

建议在部署前创建好必要的数据库和存储桶。

#### 2.1 创建 D1 数据库
1. 登录 Cloudflare Dashboard -> **Workers & Pages** -> **D1 SQL Database**.
2. 点击 **Create**，命名为 `kk-life-db`.
3. 创建成功后，无需记录 ID，Pages 绑定时可直接选择名称。

#### 2.2 创建 R2 存储桶
1. 进入 **R2 Object Storage**.
2. 点击 **Create bucket**，命名为 `kk-life-storage` (主存储).
3. (可选) 创建另一个桶 `kk-life-backup` 用于异地备份。

### 步骤 3: Cloudflare Pages 部署

1. 进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. 选择您 Fork 的仓库。
3. **构建配置 (Build settings)**:
    - **Project name**: `kk-life`
    - **Production branch**: `main`
    - **Framework preset**: `Vue`
    - **Build command**: `npm run build`
    - **Build output directory**: `dist`

4. **⚠️ 重要**: 不要立即点击部署！或者等待首次部署失败后再配置绑定。

### 步骤 4: 绑定资源 (Bindings)

进入 Pages 项目 -> **Settings** -> **Functions**:

1. **D1 Database Bindings**:
    - Variable name: `DB` (必须完全一致)
    - D1 database: 选择 `kk-life-db`

2. **R2 Bucket Bindings**:
    - Variable name: `R2_BUCKET` (必须完全一致)
    - R2 bucket: 选择 `kk-life-storage`
    - (可选) Variable name: `R2_BACKUP_BUCKET` -> `kk-life-backup`

3. **KV Namespace Bindings** (兼容旧版):
    - 如果需要迁移旧数据，可绑定相关 KV，否则新版主要依赖 D1。

### 步骤 5: 环境变量 (Environment Variables)

进入 Pages 项目 -> **Settings** -> **Environment variables**:

| 变量名 | 必填 | 说明 |
|--------|-----|------|
| `BASIC_USER` | 是 | 后台管理员用户名 (如 admin) |
| `BASIC_PASS` | 是 | 后台管理员密码 |
| `JWT_SECRET` | 是 | JWT 签名密钥 (生成一个随机长字符串) |
| `STORAGE_PROVIDER`| 否 | 默认 `r2`，可选 `telegram`, `s3` |
| `WECHAT_APPID` | 否 | 销售端小程序 AppID (可选) |
| `WECHAT_SECRET` | 否 | 销售端小程序 Secret (可选) |

### 步骤 6: 初始化数据库 (Schema Setup)

部署完成后，必须初始化 D1 数据库表结构。

**方法 A: 使用 Wrangler (推荐本地操作)**
```bash
# 登录
npx wrangler login

# 执行初始化脚本 (替换 DATABASE_ID 为实际 ID)
npx wrangler d1 execute kk-life-db --remote --file=./scripts/init-database.sql
```

**方法 B: Cloudflare Dashboard (手动)**
1. 打开 D1 -> `kk-life-db` -> **Console**.
2. 复制 `scripts/init-database.sql` 的内容并在控制台执行。

### 步骤 7: 完成验证

访问您的 `*.pages.dev` 域名：
1. **后台管理**: 访问 `/admin`，使用 BASIC Auth 登录。
2. **销售端**: 需先在后台创建销售账号。
3. **访客端**: 需先创建共享空间。
