# 管理员手册

本手册面向当前系统的管理员、运营和维护人员，聚焦现有后台能力，而不是旧版图床后台概念。

## 当前后台入口

- 登录页：`/login`
- 管理后台：`/admin`
- 审计日志：`/admin/audit-logs`
- Outbox 运维：`/admin/outbox-ops`

## 当前可用文档

- [管理端使用手册（带截图）](admin-console-guide.md)
- [后台逐页教程](pages/README.md)
- [文件与空间管理](files-and-spaces.md)
- [订单与客户操作手册](order-and-customer-operations.md)
- [统计与系统设置](stats-and-settings.md)
- [审计与 Outbox 运维手册](audit-operations.md)
- [商品与库存管理](product-inventory.md)
- [销售人员管理](sales-management.md)

## 管理员当前负责的模块

- 文件与共享空间
- 销售员与客户
- 商品、订单、采购
- 统计、系统设置与备份
- 审计日志与 replay 运维
- 系统配置与权限

## 基础检查项

- `DB` 与 `R2_BUCKET` 绑定正确
- `BASIC_USER` / `BASIC_PASS` / `JWT_SECRET` 已配置
- D1 迁移已完成
- 如启用微信登录、Turnstile、Sentry、AI 或多存储 provider，对应变量已配置

## 说明

- 旧文档中的独立“网格视图后台页 / 瀑布流后台页”已不是当前后台入口模型
- 当前后台以 `/admin/*` 单页应用路由为主
- 当前截图版手册基于 `2026-04-02` 的现有后台界面整理
- 如果你只想按页面查操作，优先从 [后台逐页教程](pages/README.md) 进入
