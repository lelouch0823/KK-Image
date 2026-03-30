# kk-life 文档中心

欢迎查阅 **kk-life** (前 KK-Image) 的官方文档。这是一个高性能、低成本的企业级文件存储与业务管理平台。

## 📚 核心文档

### 🚀 快速入门
- **[项目总结与架构](project-summary.md)** (强烈推荐阅读)
  - 了解系统的 SOTA 架构 (Tailwind v4 + D1 + R2) 和业务模块 (订单/CRM/共享空间)。
- **[快速安装部署](quick-start/installation.md)**
  - 15分钟内部署自己的 kk-life 实例。

### 💾 数据库与 API
- **[数据库架构 (Schema)](DATABASE_SCHEMA.md)**
  - 完整的 D1 数据库表结构定义，包含 `order_lines`、采购事实表和 durable outbox。
- **[API 文档](api/README.md)**
  - 了解如何与 kk-life 后端交互。
- **[授权策略系统（OPA/Rego）](developer-guide/authz-policy-system.md)**
  - 权限策略设计、开发流程、测试门禁与工程标准。

### 📖 用户手册
- [用户手册](user-manual/README.md)
  - 学习如何管理文件、创建共享空间。
- **[销售端手册](user-manual/sales-guide.md)**
  - 销售人员使用指南，包括微信小程序操作。

---

## 🏗 模块导航

- **共享空间 (Shared Spaces)**
- **文件管理 (File Manager)**
- **订单系统 (Order Management)**
- **订单行级履约与采购投影 (`orders + order_lines`)**
- **客户管理 (CRM)**
- **商品与库存管理 (Product & Inventory)**
- **采购单管理 (Purchase Orders)**
- **Durable Outbox / Replay 运维**
- **Webhooks & Integrations**

---

## 📞 获取帮助

- **GitHub Issues**: [提交反馈](https://github.com/cf-pages/KK-Image/issues)
- **更新日志**: 查看根目录 [CHANGELOG](../README.md)
