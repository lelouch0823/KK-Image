# 快速开始

欢迎使用 kk-life！本指南将帮助您在 15 分钟内完成部署并开始使用。

## 🎯 概览

kk-life 是一个基于 Cloudflare 全栈架构 (Workers + Pages + D1 + R2) 的现代化图床与销售管理系统。

**主要步骤：**
1. **GitHub** - Fork 项目代码
2. **Cloudflare** - 创建数据库 (D1) 和存储桶 (R2)
3. **Pages** - 连接 Git 并部署
4. **Init** - 初始化数据库表结构

## ⏱️ 预计时间

- **首次部署**: 15-20 分钟
- **配置优化**: 5-10 分钟

## 📋 前置要求

- ✅ [GitHub 账户](https://github.com)
- ✅ [Cloudflare 账户](https://cloudflare.com)
- ❌ **无需** 服务器或购买域名 (可以使用 `*.pages.dev`)

## 🚀 快速部署流程

### 第一步：项目准备
1. 访问 [kk-life GitHub 仓库](https://github.com/cf-pages/kk-life)
2. 点击右上角的 **Fork** 按钮

### 第二步：资源准备 (Cloudflare Dashboard)
1. **R2 存储**: 创建一个 Bucket (推荐命名 `kk-life-storage`)
2. **D1 数据库**: 创建一个 Database (推荐命名 `kk-life-db`)

### 第三步：Pages 部署
1. 进入 Cloudflare Pages -> **Create application** -> **Connect to Git**
2. 选择 Fork 的仓库，框架选择 **Vue**
3. **重要**：在 **Settings** -> **Functions** 中绑定 D1 (`DB`) 和 R2 (`R2_BUCKET`)
4. 在 **Settings** -> **Environment variables** 设置管理员账号 (`BASIC_USER`, `BASIC_PASS`, `JWT_SECRET`)

### 第四步：初始化数据库
1. 部署完成后，在 D1 控制台 或使用 Wrangler 运行 `scripts/init-database.sql`
2. 这将创建必要的表结构 (Orders, Files, etc.)

## 📖 详细指南

- **[📋 安装部署指南](installation.md)** - 包含图文的详细步骤及故障排除
- **[🎯 首次上传教程](first-upload.md)** - 验证部署是否成功

## ❓ 常见问题

### Q: 必须绑定域名吗？
A: 不需要，默认提供的 `*.pages.dev` 目前已支持 HTTPS 和 R2 访问。

### Q: 为什么无法登录后台？
A: 请检查环境变量 `JWT_SECRET` 是否设置，以及 `BASIC_USER` 密码是否正确。

### Q: 上传提示 "Internal Server Error"？
A: 通常是因为 R2 未正确绑定 (`R2_BUCKET`) 或数据库未初始化。

## 🔗 相关链接

- [用户手册](../user-manual/README.md)
- [管理员手册](../admin-manual/README.md)
- [部署故障排除](../deployment/README.md)

---

🎉 **恭喜！** 完成部署后，您拥有了一个企业级的 Sales & File 系统！
