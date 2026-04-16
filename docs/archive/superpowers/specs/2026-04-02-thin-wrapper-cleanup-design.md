# Thin Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除采购命令与订单履约 service 中已经退化成“只转发到 shared helper”的薄包装方法，直接在调用点使用 shared helper，减少重复定义和类表面积。

## 现状

经过前几批 helper 抽取后，以下 service 中仍保留多组薄包装方法：

- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`
- `functions/services/OrderLineFulfillmentService.js`

这些方法的共同特征：

- 不维护独立状态
- 只把 `this.db` / 少量固定 options 转发给 shared helper
- 仅在本类内部被调用

## 方案比较

### 方案 A: 保留这些包装方法

优点:
- 名称读起来更像业务动作

缺点:
- 同类重复定义继续存在
- 需要在多处维护“转发壳”

### 方案 B: 直接在调用点使用 shared helper

优点:
- 代码更短
- 重复定义减少最明显
- shared helper 成为真实单一来源

缺点:
- 个别调用点会多出一段 options

### 方案 C: 再加一层 factory 生成包装方法

优点:
- 表面上保留语义名字

缺点:
- 只是把薄包装换了种写法
- 不符合当前去重目标

## 采用方案

采用方案 B。

## 范围

清理对象只限于薄包装方法，不动以下内容：

- 具有独立 SQL 或业务算法的方法
- reversal 专有的采购单聚合/状态回退逻辑
- outbox 组装、批处理控制、错误文案判断

## 审计方式

新增一个轻量 audit 测试，直接检查这些 service 的 prototype 不再包含已被 shared helper 取代的包装方法。这样后续如果又长回同类重复定义，测试会先红。

## 受影响文件

- `functions/services/OrderProcurementDomainService.js`
- `functions/services/OrderProcurementReceiptReversalService.js`
- `functions/services/PurchaseOrderShortageClosureService.js`
- `functions/services/OrderLineFulfillmentService.js`
- `functions/services/__tests__/service-thin-wrappers.audit.test.js`

## 风险与控制

- 风险: 直接内联 shared helper 后参数顺序写错
  控制: 依赖现有 service SQL 回归测试

- 风险: 删除方法后外部调用方依赖这些实例方法
  控制: 先全仓 `rg` 确认仅本类内引用，再删除
