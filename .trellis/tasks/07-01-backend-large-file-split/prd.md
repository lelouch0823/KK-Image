# 后端大文件拆分 (F6-F10)

## Goal

根据 CODEBASE-AUDIT-REPORT.md 中 [F6]-[F10] 的拆分方案，将 5 个后端大文件逐一拆分为更小的模块，**不改变现有功能**。降低单文件复杂度，提升可维护性。

## 文件清单（按优先级排序）

| # | 文件 | 行数 | 复杂度 | 拆分目标 |
|---|------|------|--------|----------|
| F6 | `functions/repositories/order/mutations.js` | 1293 | 中 | → mutation-helpers.js + mutations-lifecycle.js |
| F7 | `functions/lib/hono/routes/manage/products/[id].js` | 1264 | 高 | → dimensions.js + variant-images.js + price-rules.js + index.js |
| F8 | `functions/lib/hono/routes/manage/purchase-orders.js` | 1193 | 中 | → helpers.js + items.js + receipts.js + index.js |
| F9 | `functions/lib/hono/routes/manage/orders/detail.js` | 995 | 中 | → helpers.js + logistics.js + mutations.js + lifecycle.js + index.js |
| F10 | `functions/services/OrderLineFulfillmentService.js` | 847 | 中 | → validators.js + statement-builders.js + helpers.js + index.js |

## Requirements

### F6: order/mutations.js (1293 → ~770)
- 提取 `mutation-helpers.js`：纯无副作用工具函数（unread映射、归档断言、断言语句、行规范化、快照构建、文件权限校验、batch执行），约 270 行
- 提取 `mutations-lifecycle.js`：归档/恢复/级联删除/已读标记（archive、restore、deleteWithRelations、markAsRead、setUnread），约 95 行
- 保留 `mutations.js`：核心写操作（create、updateData、updateComposite、updateStatus、updateFiles、batchUpdateStatus），约 770 行

### F7: products/[id].js (1264 → ~400)
- 拆为目录结构 `products/[id]/`
- 提取 `dimensions.js`：规格维度相关路由（create/update/archive/values/restore/impact），约 330 行
- 提取 `variant-images.js`：变体图片路由（add/sort/primary/delete），约 220 行
- 提取 `price-rules.js`：价格规则路由（get/upsert/delete），约 90 行
- 保留 `index.js`：商品主体路由 + 子路由挂载，约 400 行

### F8: purchase-orders.js (1193 → ~500)
- 拆为目录结构 `purchase-orders/`
- 提取 `helpers.js`：幂等键、fingerprint构建、校验辅助、审计声明，约 250 行
- 提取 `items.js`：明细 CRUD（POST items, PATCH item, DELETE item），约 130 行
- 提取 `receipts.js`：收货、收货冲销、缺口关闭，约 155 行
- 保留 `index.js`：列表/统计/建议/详情/创建/更新/状态变更/成本分摊，约 500 行

### F9: orders/detail.js (995 → ~80)
- 拆为目录结构 `orders/detail/`
- 提取 `helpers.js`：行规范化、状态断言、outbox调度、admin actor等，约 135 行
- 提取 `logistics.js`：物流查询+更新，约 80 行
- 提取 `mutations.js`：订单修改+状态变更，约 370 行
- 提取 `lifecycle.js`：送达确认+备注+归档+恢复+删除，约 295 行
- 保留 `index.js`：详情查询 + 路由挂载，约 80 行

### F10: OrderLineFulfillmentService.js (847 → ~460)
- 拆为目录结构 `order-line-fulfillment/`
- 提取 `validators.js`：查询/断言方法，约 90 行
- 提取 `statement-builders.js`：发货台账、库存变动、outbox、命令结果构建，约 175 行
- 提取 `helpers.js`：模块级工具函数，约 100 行
- 保留 `index.js`：类定义 + 5个命令方法 + 构造函数，约 460 行

## Acceptance Criteria

- [ ] 每个文件拆分后行数接近目标值
- [ ] 所有现有功能不变（无行为变更）
- [ ] 拆分出的模块有清晰的接口（参数/返回值）
- [ ] 现有测试全部通过 `pnpm test:unit:run`
- [ ] Lint 通过 `pnpm lint`
- [ ] 每个文件拆分独立提交，方便 review

## Definition of Done

- 所有 5 个文件拆分完成
- 单元测试通过
- Lint 通过
- 无功能回归

## Technical Notes

- 后端使用 Hono 框架，路由文件导出 `export default app`
- 仓库层使用命名导出函数
- 服务层使用命名导出类
- 拆分 Hono 路由时需要使用 `app.route()` 挂载子路由
- 拆分后需更新所有引用该文件的 import 路径

## Implementation Plan

按优先级逐个文件拆分，每完成一个文件独立提交：

1. **F6: order/mutations.js** — 最大文件，helpers 提取收益高
2. **F7: products/[id].js** — 4 个独立子资源域
3. **F8: purchase-orders.js** — helpers + items/receipts 可独立
4. **F9: orders/detail.js** — 按职责层拆为 5 个文件
5. **F10: OrderLineFulfillmentService.js** — validators + builders 提取
