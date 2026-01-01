# 部署指南

本指南提供了 kk-life 在各种环境下的详细部署说明，包括生产环境配置、性能优化和故障排除。

## 📋 部署概览

kk-life 基于 Cloudflare Pages 的无服务器架构，支持快速部署和自动扩展。本指南涵盖从基础部署到高级配置的完整流程。

## 🎯 部署目标

- **生产就绪** - 稳定可靠的生产环境部署
- **高性能** - 优化配置以获得最佳性能
- **安全性** - 完整的安全配置和防护
- **可维护** - 便于监控和维护的配置

## 📚 部署内容

### ☁️ Cloudflare Pages 部署

#### [🚀 标准部署流程](cloudflare-pages.md)
完整的 Cloudflare Pages 部署指南：
- GitHub 仓库连接和配置
- 构建设置和部署选项
- 域名配置和 SSL 设置
- 自动部署和版本管理

**部署步骤**:
1. Fork 项目仓库
2. 连接到 Cloudflare Pages
3. 配置构建设置
4. 设置环境变量
5. 完成首次部署

#### [🔧 环境变量配置](environment-variables.md)
详细的环境变量配置说明：
- 必需变量和可选变量
- 安全配置最佳实践
- 不同环境的配置差异
- 变量更新和生效机制

**核心变量**:
- `TG_Bot_Token` - Telegram Bot 令牌
- `TG_Chat_ID` - Telegram 频道 ID
- `ModerateContentApiKey` - 内容审查 API
- `BASIC_USER`/`BASIC_PASS` - 管理员认证

#### [🌐 自定义域名设置](custom-domain.md)
配置自定义域名和 SSL 证书：
- 域名添加和验证
- DNS 记录配置
- SSL 证书管理
- CDN 和缓存设置

**配置流程**:
1. 添加自定义域名
2. 配置 DNS 记录
3. 验证域名所有权
4. 启用 SSL 证书
5. 测试域名访问

## 🏗️ 高级部署配置

### 多环境部署

**环境分离**:
```
production/     # 生产环境
├── main 分支   # 自动部署到生产
staging/        # 测试环境  
├── develop 分支 # 自动部署到测试
development/    # 开发环境
├── feature/* 分支 # 预览部署
```

**环境变量管理**:
- 生产环境：完整配置，启用所有安全功能
- 测试环境：模拟生产，用于功能验证
- 开发环境：简化配置，便于开发调试

### 性能优化配置

**CDN 优化**:
```javascript
// _headers 文件配置
/file/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/api/*
  Cache-Control: no-cache, no-store, must-revalidate
  X-Content-Type-Options: nosniff
```

**函数优化**:
- 启用函数预热
- 配置合适的内存限制
- 优化冷启动时间
- 实现连接复用

### 安全配置

**安全头部**:
```javascript
// 安全响应头配置
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'"
};
```

**访问控制**:
- IP 白名单配置
- 地理位置限制
- 频率限制设置
- DDoS 防护配置

## 🔧 配置文件详解

### wrangler.toml 配置

```toml
name = "kk-image"
compatibility_date = "2024-12-01"
pages_build_output_dir = "dist"

# 兼容性和性能设置
compatibility_flags = ["nodejs_compat"]

# 静态资源优化配置
[build]
command = "npm run build"

# 全局环境变量（开发和生产环境通用）
[vars]
# Telegram 配置（必需）- 请在 Cloudflare Pages 后台设置实际值
TG_Bot_Token = "YOUR_TELEGRAM_BOT_TOKEN_HERE"
TG_Chat_ID = "YOUR_TELEGRAM_CHAT_ID_HERE"

# 内容审查配置（可选）
ModerateContentApiKey = ""

# 管理员认证配置（可选）
BASIC_USER = ""
BASIC_PASS = ""

# 功能开关（可选）
WhiteList_Mode = "false"
disable_telemetry = "false"

# 生产环境配置
[env.production.vars]
COMPRESS_STATIC_ASSETS = "true"

# 开发环境配置
[env.development]
compatibility_date = "2024-12-01"

[env.development.vars]
COMPRESS_STATIC_ASSETS = "false"
# 开发环境可以使用测试值
TG_Bot_Token = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
TG_Chat_ID = "-1001234567890"
BASIC_USER = "admin"
BASIC_PASS = "123456"

# KV 命名空间配置
[[kv_namespaces]]
binding = "img_url"
id = "local-kv-namespace"
preview_id = "local-kv-namespace"
```

### package.json 脚本

```json
{
  "scripts": {
    "dev": "wrangler pages dev .",
    "build": "vite build",
    "start": "npm run dev",
    "deploy": "npm run build && wrangler pages deploy .",
    "deploy:staging": "npm run build && wrangler pages deploy . --env staging",
    "test": "mocha test/**/*.test.js"
  }
}
```

## 📊 监控和日志

### 监控配置

**Sentry 集成**:
```javascript
// functions/_middleware.js
import { Sentry } from '@cloudflare/pages-plugin-sentry';

export const onRequest = Sentry({
  dsn: 'your-sentry-dsn',
  environment: 'production',
  tracesSampleRate: 1.0
});
```

**Cloudflare Analytics**:
- 启用 Web Analytics
- 配置自定义事件跟踪
- 设置性能监控
- 配置告警规则

### 日志管理

**结构化日志**:
```javascript
const logger = {
  info: (message, data) => console.log(JSON.stringify({
    level: 'info',
    message,
    data,
    timestamp: new Date().toISOString()
  })),
  error: (message, error) => console.error(JSON.stringify({
    level: 'error',
    message,
    error: error.stack,
    timestamp: new Date().toISOString()
  }))
};
```

## 🚀 CI/CD 配置

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: kk-image
          directory: .
```

### 自动更新配置

```yaml
# .github/workflows/upstream-sync.yml
name: Upstream Sync

on:
  schedule:
    - cron: '0 2 * * *' # 每天凌晨2点检查更新
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync upstream changes
        uses: aormsby/Fork-Sync-With-Upstream-action@v3.4
        with:
          upstream_sync_repo: cf-pages/kk-life
          upstream_sync_branch: main
          target_sync_branch: main
```

## 🔍 故障排除

### 常见部署问题

**部署失败**:
```bash
# 检查部署日志
wrangler pages deployment list --project-name=kk-image

# 查看具体错误
wrangler pages deployment tail --project-name=kk-image
```

**环境变量问题**:
```bash
# 列出环境变量
wrangler pages secret list --project-name=kk-image

# 更新环境变量
wrangler pages secret put VARIABLE_NAME --project-name=kk-image
```

**函数错误**:
```javascript
// 添加错误处理
export async function onRequest(context) {
  try {
    // 业务逻辑
  } catch (error) {
    console.error('Function error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### 性能问题诊断

**响应时间分析**:
- 使用 Cloudflare Analytics 查看响应时间
- 检查函数执行时间
- 分析网络延迟
- 优化数据库查询

**内存使用优化**:
- 监控函数内存使用
- 优化对象创建和销毁
- 实现对象池
- 减少内存泄漏

## 📈 扩展和优化

### 水平扩展

**多区域部署**:
- 配置多个 Cloudflare 区域
- 实现地理位置路由
- 数据同步策略
- 故障转移机制

**负载均衡**:
- Cloudflare Load Balancer
- 健康检查配置
- 流量分配策略
- 故障检测和恢复

### 成本优化

**资源使用优化**:
- 监控 Cloudflare 使用量
- 优化函数执行时间
- 减少 KV 读写次数
- 合理配置缓存策略

**成本监控**:
- 设置使用量告警
- 定期审查资源使用
- 优化不必要的请求
- 实现成本控制策略

## ✅ 部署检查清单

### 部署前检查
- [ ] 代码审查和测试完成
- [ ] 环境变量配置正确
- [ ] 安全配置已启用
- [ ] 监控和日志已配置

### 部署后验证
- [ ] 网站可以正常访问
- [ ] 文件上传功能正常
- [ ] 管理界面可以登录
- [ ] 监控数据正常收集

### 生产环境检查
- [ ] SSL 证书有效
- [ ] 自定义域名解析正确
- [ ] 性能指标符合预期
- [ ] 安全扫描通过

## 🔗 相关资源

- **[快速开始](../quick-start/README.md)** - 基础部署指南
- **[管理员手册](../admin-manual/README.md)** - 系统管理和维护
- **[架构文档](../architecture/README.md)** - 系统架构设计

---

🚀 **生产就绪**: 按照本指南完成部署后，您将拥有一个稳定、安全、高性能的 kk-life 服务！
