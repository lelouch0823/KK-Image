# 订单模块逻辑问题：可执行修复清单

**更新日期**: 2026-03-03  
**适用范围**: `functions/repositories/order/`, `functions/lib/hono/routes/manage/orders/`, `functions/lib/hono/routes/sales/orders.js`, `functions/api/utils/order-utils.js`, `src/composables/useOrders.js`

---

## 强制业务约束

1. 库存不足时，不允许将订单状态改为 `delivered`（单条与批量都必须阻断）。
2. 阻断时必须返回可识别错误，前端可稳定展示（HTTP 400 + 明确信息）。

---

## 执行状态总览

| 优先级 | 编号 | 项目 | 状态 |
|---|---|---|---|
| P0 | P0-1 | `delivered` 前库存充足性校验（仓储层） | [x] 已完成 |
| P0 | P0-2 | 管理端状态接口映射库存不足为 400 | [x] 已完成 |
| P0 | P0-3 | `processOrderUpdate` 核心写入原子化 | [x] 已完成 |
| P0 | P0-4 | 管理端 PATCH 返回更新后订单 + 前端用回包覆盖 | [x] 已完成 |
| P1 | P1-1 | 状态流转状态机定义（前后端共享） | [ ] 待排期 |
| P1 | P1-2 | 高风险状态变更二次确认/权限分级 | [ ] 待排期 |

---

## P0 清单（上线前必须完成）

### P0-1 库存不足阻断 `delivered`

- 目标: 禁止库存不足订单进入 `delivered`，避免超卖。
- 已落地文件:
  - `functions/repositories/order/mutations.js`
  - `functions/repositories/__tests__/order-inventory-flow.test.js`
- 验收标准:
  - 单条状态变更 `pending -> delivered` 且库存不足时，抛出 `insufficient variant stock` 错误。
  - 批量状态变更中只要任一订单不足，整批阻断且不执行写入。
  - 批量校验按 `variant_id` 聚合数量，避免批内超卖。

### P0-2 管理端 API 错误语义一致化

- 目标: 仓储层库存错误在 API 层转换为业务可读的 400。
- 已落地文件:
  - `functions/lib/hono/routes/manage/orders/detail.js`
  - `functions/lib/hono/routes/manage/orders/create.js`
  - `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
  - `functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js`
- 验收标准:
  - `PATCH /api/manage/orders/:id/status` 遇库存不足返回 400。
  - `POST /api/manage/orders/batch` 执行 `status=delivered` 遇库存不足返回 400。
  - 错误信息包含 `Insufficient stock: cannot mark order as delivered`。

### P0-3 订单 PATCH 核心写入原子化

- 目标: 避免订单字段更新、状态更新、商品绑定、附件替换出现部分成功。
- 已落地文件:
  - `functions/repositories/order/mutations.js`
  - `functions/repositories/OrderRepository.js`
  - `functions/api/utils/order-utils.js`
  - `functions/api/utils/__tests__/order-utils.test.js`
  - `functions/repositories/__tests__/order-mutations.test.js`
- 验收标准:
  - `processOrderUpdate` 通过 `updateComposite` 一次性执行核心写入。
  - 核心写入失败时，不触发通知发送。
  - 时间轴和通知均在核心写入成功后执行。

### P0-4 PATCH 回包与前端状态对齐

- 目标: 消除前端乐观更新与后端真实数据偏差。
- 已落地文件:
  - `functions/lib/hono/routes/manage/orders/detail.js`
  - `src/composables/useOrders.js`
  - `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
  - `src/composables/__tests__/useOrders.update-order.test.js`
- 验收标准:
  - 管理端 `PATCH /api/manage/orders/:id` 返回 `data`（更新后的完整订单）。
  - 前端 `updateOrder` 成功后若存在 `res.data`，使用其替换本地乐观项。

---

## P1 清单（可排期优化）

### P1-1 统一状态机定义

- 目标: 避免状态流转规则散落。
- 交付物:
  - 新增共享状态机定义模块（含 `canTransition`）。
  - 管理端/销售端和前端展示层复用同一份规则。

### P1-2 高风险状态变更防误操作

- 目标: 降低管理员误操作概率。
- 交付物:
  - 前端对 `void`、`delivered` 增加二次确认。
  - 可选: 按角色细分状态变更权限。

---

## 验证命令矩阵

### 必跑（P0）

```bash
npx vitest run functions/repositories/__tests__/order-inventory-flow.test.js
npx vitest run functions/repositories/__tests__/order-mutations.test.js
npx vitest run functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js
npx vitest run functions/api/utils/__tests__/order-utils.test.js
npx vitest run src/composables/__tests__/useOrders.update-order.test.js
```

### 总验收（合并前）

```bash
npx vitest run functions/repositories/__tests__/order-inventory-flow.test.js functions/repositories/__tests__/order-mutations.test.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/__tests__/order-batch-routes.test.js functions/api/utils/__tests__/order-utils.test.js src/composables/__tests__/useOrders.update-order.test.js
```

---

## 关联开发计划

- 执行计划文档: `docs/plans/2026-03-03-order-module-remediation-implementation-plan.md`
- 当前进度: P0-1 ~ P0-4 已完成，P1 待排期。
