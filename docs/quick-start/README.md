# 快速开始

欢迎使用 Telegraph-Image！本指南将帮助您在 15 分钟内完成部署并开始使用。

## 🎯 概览

Telegraph-Image 是一个免费的图床解决方案，只需要一个 Cloudflare 账户即可开始使用。整个部署过程包括：

1. **准备工作** - 获取必要的账户和权限
2. **项目部署** - Fork 项目并部署到 Cloudflare Pages
3. **配置设置** - 设置 Telegram Bot 和环境变量
4. **功能测试** - 验证上传和访问功能

## ⏱️ 预计时间

- **首次部署**: 10-15 分钟
- **配置优化**: 5-10 分钟
- **功能测试**: 2-3 分钟

## 📋 前置要求

在开始之前，请确保您拥有：

### 必需账户
- ✅ [GitHub 账户](https://github.com) - 用于 Fork 项目
- ✅ [Cloudflare 账户](https://cloudflare.com) - 用于部署和托管
- ✅ [Telegram 账户](https://telegram.org) - 用于创建 Bot 和频道

### 可选账户
- 🔧 [ModerateContent 账户](https://moderatecontent.com) - 用于内容审查（可选）

## 🚀 快速部署流程

### 第一步：项目准备
1. 访问 [Telegraph-Image GitHub 仓库](https://github.com/cf-pages/Telegraph-Image)
2. 点击右上角的 **Fork** 按钮
3. 等待 Fork 完成

### 第二步：Cloudflare Pages 部署
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Pages** 页面
3. 点击 **创建项目** → **连接到 Git 提供程序**
4. 选择您刚才 Fork 的仓库
5. 配置构建设置（使用默认设置即可）
6. 点击 **部署站点**

### 第三步：Telegram Bot 配置
详细步骤请参考：[安装部署指南](installation.md#telegram-配置)

### 第四步：环境变量设置
在 Cloudflare Pages 后台设置以下环境变量：
- `TG_Bot_Token` - Telegram Bot Token
- `TG_Chat_ID` - Telegram 频道 ID

### 第五步：功能测试
按照 [首次上传教程](first-upload.md) 验证功能。

## 📖 详细指南

- **[📋 安装部署指南](installation.md)** - 详细的部署步骤和配置说明
- **[🎯 首次上传教程](first-upload.md)** - 完成部署后的功能验证

## ❓ 常见问题

### Q: 部署失败怎么办？
A: 检查 GitHub 仓库是否正确 Fork，确保 Cloudflare Pages 有访问权限。

### Q: 上传失败怎么办？
A: 确认 Telegram Bot Token 和 Chat ID 配置正确，Bot 已添加为频道管理员。

### Q: 图片无法访问怎么办？
A: 检查域名是否正确，确认部署已完成且无错误。

## 🔗 相关链接

- [用户手册](../user-manual/README.md) - 详细的使用指南
- [管理员手册](../admin-manual/README.md) - 后台管理功能
- [故障排除](../deployment/README.md#故障排除) - 常见问题解决方案

## 💡 小贴士

- 建议先在测试环境验证功能后再正式使用
- 定期备份重要配置信息
- 关注项目更新以获取最新功能

---

🎉 **恭喜！** 完成快速开始后，您就可以开始使用 Telegraph-Image 了！
