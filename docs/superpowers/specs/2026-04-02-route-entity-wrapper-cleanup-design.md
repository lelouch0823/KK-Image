# Route Entity Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 manage route 中两个只透传到 `requireEntity` 的局部 helper，直接在调用点内联实体校验，继续压缩重复定义。

## 本批范围

仅处理以下两个局部 wrapper：

- `functions/lib/hono/routes/manage/purchase-orders.js`
- `functions/lib/hono/routes/manage/orders/detail.js`

对应待删除定义：

- `requirePurchaseOrder(repo, poId)`
- `requireOrder(repo, orderId)`

## 现状

这两个函数都只有一层透传：

- 调用 `repo.findById(...)`
- 调用 `requireEntity(...)`
- 组装本地 `NotFoundError`

它们没有额外状态、缓存、鉴权或领域语义，只增加一次跳转。

## 方案比较

### 方案 A: 保留局部 wrapper

优点:
- 调用名稍短

缺点:
- 继续保留重复定义
- `requireEntity` 的实际语义被包了一层

### 方案 B: 直接在调用点内联 `requireEntity`

优点:
- 删除无价值 helper
- 就地呈现 404 语义
- 改动边界小，便于小批次提交

缺点:
- 个别调用点稍长

## 采用方案

采用方案 B。

## 设计

调整顺序：

1. 先新增一个静态 audit test，锁定这两个 wrapper 不再存在
2. 删除两个局部 helper
3. 在原调用点直接写 `requireEntity(repo.findById(...), ...)`
4. 复跑现有 route 测试，确认行为不变

## 不处理内容

本批不扩展到以下相邻候选：

- `albums.js`
- `files.js`
- `folders.js`
- `v1` / `sales` 路由中的同类 wrapper

## 风险与控制

- 风险: 内联时遗漏某个 `NotFoundError` 文案
  控制: 保持原错误工厂不变，并跑现有 route tests

- 风险: 同文件内二次读取实体的调用点改错
  控制: 只做机械式替换，不改其他业务逻辑
