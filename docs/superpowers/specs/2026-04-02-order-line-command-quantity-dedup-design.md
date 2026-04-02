# Order Line Command Quantity 去重设计

**日期**: 2026-04-02

## 目标

收敛订单行命令里的正整数数量解析逻辑，避免路由层和服务层各自维护同一份 `normalizeQuantity` helper。

## 现状

当前重复定义存在于：

- `functions/services/OrderLineFulfillmentService.js`
  - `normalizeQuantity(payload)`
- `functions/lib/hono/routes/manage/orders/lines.js`
  - `normalizeQuantity(body)`

两者行为一致：

- 从 `quantity` / `qty` / `amount` 读取数量
- 非正数或非法值抛 `BadRequestError('quantity must be a positive number')`
- 返回 `Math.floor(quantity)`

## 方案比较

### 方案 A: 保留两处局部 helper

优点:
- 各自文件内就地可读

缺点:
- 同一规则分散维护
- 路由和服务后续容易产生细微分叉

### 方案 B: 提取到 `order-line-shared.js`

优点:
- 已是订单行路由/服务共享 helper 的自然落点
- 变更范围小
- 可用单测直接锁住数量解析契约

缺点:
- 共享模块需要引入 `BadRequestError`

### 方案 C: 提取到更泛化的全局数值 util

优点:
- 无明显额外收益

缺点:
- 抽象过度，超出当前批次需要

## 采用方案

采用方案 B。

## 设计

在 `functions/services/order-line-shared.js` 中新增共享 helper，例如：

- `parsePositiveLineCommandQuantity(payload)`

实现要求：

1. 保持现有字段兼容顺序：`quantity ?? qty ?? amount`
2. 保持错误消息完全不变
3. 保持向下取整行为不变

然后让：

- `OrderLineFulfillmentService`
- `manage/orders/lines`

统一复用该 helper，并移除各自的局部 `normalizeQuantity`

## 调整边界

本批只处理订单行命令数量解析，不处理：

- `toNonNegativeInt` 的其他重复定义
- `repositories/order/mutations.js` 的 `normalizeQuantity`
- 其他非订单行域的数量 helper

## 受影响文件

- `functions/services/order-line-shared.js`
- `functions/services/OrderLineFulfillmentService.js`
- `functions/lib/hono/routes/manage/orders/lines.js`
- `functions/services/__tests__/order-line-shared.test.js`
- 新增一份订单行数量 dedup audit test
- 相关服务/路由测试文件

## 风险与控制

- 风险: 路由层与服务层的错误类型或报错文案发生变化
  控制: 先补共享 helper 单测和现有路由/服务测试，再改实现

- 风险: 去重后局部 helper 回归
  控制: 增加 audit test，直接约束两处不再定义本地 `normalizeQuantity`
