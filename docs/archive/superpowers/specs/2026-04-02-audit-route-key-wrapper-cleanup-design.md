# Audit Route Key Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/_shared/audit-route-exclusions.js` 中未被使用的 `getIgnoredAuditRouteKeys` 薄包装。

## 本批范围

仅处理：

- `functions/lib/hono/_shared/audit-route-exclusions.js` 的 `getIgnoredAuditRouteKeys`

## 现状

当前 helper 只做一件事：

- `return ignoredAuditRoutes.map((route) => route.key)`

仓内搜索结果显示：

- `getIgnoredAuditRouteKeys` 无调用点
- `ignoredAuditRoutes` 也无外部调用点

## 方案比较

### 方案 A: 保留 wrapper

优点:
- 如果未来要拿 key 列表，有现成函数

缺点:
- 当前是死代码
- 保留了无使用面的薄包装

### 方案 B: 直接删除 wrapper

优点:
- 清掉无用导出
- 降低共享模块噪音
- 风险极低

缺点:
- 如果未来需要 key 列表，需要重新添加或在调用点 map

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `getIgnoredAuditRouteKeys` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除导出函数
4. 运行 lint 与 audit test，确认文件保持干净

## 不处理内容

本批不处理：

- `ignoredAuditRoutes` 常量
- `defineAuditRouteExclusion`
- 任何 audit route 声明逻辑

## 风险与控制

- 风险: 误删仍被动态使用的导出
  控制: 仓内搜索确认 `0` 调用点，并用静态 audit 锁定
