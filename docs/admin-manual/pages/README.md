# 后台逐页教程

本目录按当前后台实际 `/admin/*` 路由拆分，每个业务页单独一篇教程，适合值班、交接和快速定位页面职责。

截图基于 `2026-04-02` 的当前后台界面与本地演示数据整理。

## 逐页入口

- [仪表盘](dashboard.md)
- [文件管理](files.md)
- [空间管理](spaces.md)
- [销售员管理](salespersons.md)
- [商品管理](products.md)
- [订单管理](orders.md)
- [订货总览](goods-overview.md)
- [采购单管理](purchase-orders.md)
- [客户管理](customers.md)
- [统计分析](stats.md)
- [系统设置](settings.md)
- [审计日志](audit-logs.md)
- [Outbox 运维](outbox-ops.md)

## 说明

- 本目录覆盖当前所有后台业务页。
- `forbidden`、`not-found` 之类状态页不单独写业务教程。
- 如果你想看跨页面工作流，请先读 [管理端使用手册（带截图）](../admin-console-guide.md)。
- 如果你想看模块级规则，请继续参考 [商品与库存管理](../product-inventory.md)、[销售人员管理](../sales-management.md)、[审计与 Outbox 运维手册](../audit-operations.md) 等专题文档。
