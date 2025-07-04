# 安装部署指南

本指南将详细介绍如何从零开始部署 Telegraph-Image 到 Cloudflare Pages。

## 📋 部署概览

Telegraph-Image 采用无服务器架构，主要组件包括：
- **Cloudflare Pages** - 静态网站托管和 Functions 运行环境
- **Telegram Bot API** - 图片存储后端
- **Cloudflare KV** - 元数据存储（可选）

## 🔧 详细部署步骤

### 步骤 1: Fork 项目

1. 访问 [Telegraph-Image GitHub 仓库](https://github.com/cf-pages/Telegraph-Image)
2. 点击右上角的 **Fork** 按钮
3. 选择您的 GitHub 账户
4. 等待 Fork 完成

> 💡 **注意**: 必须使用 Fork 方式，直接下载代码包无法正常部署。

### 步骤 2: Cloudflare Pages 配置

#### 2.1 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在左侧菜单中选择 **Pages**
3. 点击 **创建项目**
4. 选择 **连接到 Git 提供程序**

#### 2.2 连接 GitHub 仓库

1. 选择 **GitHub** 作为 Git 提供程序
2. 授权 Cloudflare 访问您的 GitHub 账户
3. 在仓库列表中找到您 Fork 的 `Telegraph-Image` 项目
4. 点击 **开始设置**

#### 2.3 配置构建设置

使用以下配置：

| 设置项 | 值 |
|--------|-----|
| 项目名称 | `telegraph-image`（或您喜欢的名称） |
| 生产分支 | `main` |
| 构建命令 | 留空 |
| 构建输出目录 | `/` |

#### 2.4 部署项目

1. 点击 **保存并部署**
2. 等待首次部署完成（通常需要 2-5 分钟）
3. 部署成功后，您将获得一个 `*.pages.dev` 域名

### 步骤 3: Telegram 配置

#### 3.1 创建 Telegram Bot

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送命令 `/newbot`
3. 按提示输入 Bot 名称和用户名
4. 保存返回的 `Bot Token`（格式：`123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`）

#### 3.2 创建 Telegram 频道

1. 在 Telegram 中创建一个新频道
2. 将刚创建的 Bot 添加为频道管理员
3. 确保 Bot 有发送消息的权限

#### 3.3 获取频道 ID

使用以下方法之一获取频道 ID：

**方法一：使用 @VersaToolsBot**
1. 搜索 [@VersaToolsBot](https://t.me/VersaToolsBot)
2. 按照指示获取频道 ID

**方法二：使用 @GetTheirIDBot**
1. 搜索 [@GetTheirIDBot](https://t.me/GetTheirIDBot)
2. 转发频道消息给该 Bot
3. 获取返回的频道 ID（格式：`-1001234567890`）

### 步骤 4: 环境变量配置

#### 4.1 设置必需环境变量

1. 在 Cloudflare Pages 项目页面，点击 **设置**
2. 选择 **环境变量**
3. 点击 **添加环境变量**

添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `TG_Bot_Token` | `123456789:ABCdefGHI...` | 从 BotFather 获取的 Token |
| `TG_Chat_ID` | `-1001234567890` | 频道 ID |

#### 4.2 设置可选环境变量

根据需要添加以下可选变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ModerateContentApiKey` | `your-api-key` | 内容审查 API Key |
| `BASIC_USER` | `admin` | 后台登录用户名 |
| `BASIC_PASS` | `your-password` | 后台登录密码 |
| `WhiteList_Mode` | `true` | 启用白名单模式 |
| `disable_telemetry` | `true` | 禁用遥测数据 |

### 步骤 5: KV 存储配置（可选）

如需启用图片管理功能：

#### 5.1 创建 KV 命名空间

1. 在 Cloudflare Dashboard 中选择 **Workers & Pages**
2. 点击 **KV**
3. 点击 **创建命名空间**
4. 输入名称（如：`telegraph-image-storage`）

#### 5.2 绑定 KV 命名空间

1. 回到 Pages 项目设置
2. 选择 **函数**
3. 点击 **KV 命名空间绑定**
4. 添加绑定：
   - 变量名称：`img_url`
   - KV 命名空间：选择刚创建的命名空间

### 步骤 6: 重新部署

1. 在 Pages 项目页面，选择 **部署**
2. 点击 **重试部署** 或等待自动部署
3. 确保部署成功完成

## ✅ 部署验证

### 验证清单

- [ ] Cloudflare Pages 部署成功
- [ ] 可以访问项目域名
- [ ] Telegram Bot 创建成功
- [ ] 频道 ID 获取正确
- [ ] 环境变量配置完成
- [ ] KV 存储绑定（如需要）

### 功能测试

1. 访问您的项目域名
2. 尝试上传一张测试图片
3. 验证图片可以正常访问
4. 检查后台管理功能（如已配置）

## 🔧 高级配置

### 自定义域名

1. 在 Pages 项目设置中选择 **自定义域**
2. 点击 **设置自定义域**
3. 输入您的域名
4. 按照提示配置 DNS 记录

### 内容审查配置

1. 注册 [ModerateContent](https://moderatecontent.com) 账户
2. 获取 API Key
3. 在环境变量中添加 `ModerateContentApiKey`

### 自动更新配置

1. 在您的 Fork 仓库中，进入 **Actions** 页面
2. 启用 **Workflows**
3. 启用 **Upstream Sync Action**

## ❗ 常见问题

### 部署失败

**问题**: 部署时出现错误
**解决方案**:
1. 检查 GitHub 仓库是否正确 Fork
2. 确认 Cloudflare 有访问仓库的权限
3. 查看部署日志中的具体错误信息

### 上传失败

**问题**: 图片上传返回错误
**解决方案**:
1. 验证 `TG_Bot_Token` 格式正确
2. 确认 `TG_Chat_ID` 为负数且正确
3. 检查 Bot 是否为频道管理员

### 环境变量不生效

**问题**: 修改环境变量后功能未更新
**解决方案**:
1. 环境变量修改后需要重新部署
2. 在部署页面手动触发重新部署
3. 等待部署完成后再测试

## 🔗 下一步

- [首次上传教程](first-upload.md) - 验证部署结果
- [用户手册](../user-manual/README.md) - 了解详细功能
- [管理员手册](../admin-manual/README.md) - 配置后台管理

---

🎉 **恭喜！** 您已成功部署 Telegraph-Image！
