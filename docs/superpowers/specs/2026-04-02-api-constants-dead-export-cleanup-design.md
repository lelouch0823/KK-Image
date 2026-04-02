# API Constants Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/api/utils/constants.js` 中仓内无真实使用的死常量导出：

- `WEBHOOK_TIMEOUT_MS`
- `MAX_WEBHOOK_RETRIES`
- `SHARE_TOKEN_LENGTH`
- `DEFAULT_PAGE_SIZE`
- `MAX_PAGE_SIZE`

## 本批范围

仅处理：

- `functions/api/utils/constants.js`
- 一条静态 dead-export audit test
- 现有 `order-queries.progress-filter.test.js` 作为消费者回归验证

## 现状

全仓搜索结果显示：

- 上述 5 个标识只出现在 `functions/api/utils/constants.js` 定义处
- `constants.js` 里其余导出仍被真实使用，例如：
  - `CORS_MAX_AGE`
  - `ORDER_STATUSES`
  - `ORDER_PROCUREMENT_STATUSES`
  - `normalizeOrderProcurementStatus`
  - `expandOrderProcurementStatusFilter`

## 方案比较

### 方案 A: 保留死导出

优点:
- 保留未来可能复用的名字

缺点:
- 当前无任何真实调用方
- 扩大常量模块导出面
- 给静态审查和重复定义清理制造噪音

### 方案 B: 删除死导出

优点:
- 一次收掉 5 个无效接口
- 不影响现有真实消费者
- 风险低，收益高

缺点:
- 未来若需要，需要重新定义或导出

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定这 5 个常量不再被导出
2. 先跑红灯确认当前死导出仍在
3. 删除这 5 个导出常量
4. 跑现有 `order-queries.progress-filter.test.js`，确认仍在使用的订单进度过滤常量与函数行为不变

## 不处理内容

本批不处理：

- `CORS_MAX_AGE`
- `ORDER_STATUSES`
- `ORDER_PROCUREMENT_STATUSES`
- `normalizeOrderProcurementStatus`
- `expandOrderProcurementStatusFilter`

## 风险与控制

- 风险: 误删仍被订单查询依赖的导出
  控制: 保留真实使用导出，并运行 `order-queries.progress-filter.test.js`

- 风险: 删除常量时误改模块结构
  控制: 使用静态 audit test 和 ESLint 双重检查
