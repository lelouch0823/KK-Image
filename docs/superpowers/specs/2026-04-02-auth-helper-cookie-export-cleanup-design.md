# Auth Helper Cookie Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/_shared/auth-helpers.js` 中仅在同文件内部使用的 `setSalesTokenCookie` 导出。

## 本批范围

仅处理：

- `functions/lib/hono/_shared/auth-helpers.js`
- 一条静态 dead-export audit test
- 现有 `auth-helpers.audit.test.js`

## 现状

仓内搜索结果显示：

- `setSalesTokenCookie` 只在定义处和 `generateSalesToken` 内部调用处出现
- `getUserAgent` 仍被 `functions/lib/hono/routes/sales/auth.js` 真实使用
- `generateSalesToken` 仍被销售鉴权路由真实使用

## 方案比较

### 方案 A: 保留导出

优点:
- 保留一个可复用名字

缺点:
- 当前无外部调用方
- 增大 shared auth helper 模块表面积
- 给后续重复定义清理留下噪音

### 方案 B: 降为局部函数

优点:
- 收缩导出面
- 不改动真实业务调用链
- 风险极低

缺点:
- 如果未来外部需要复用，要重新导出

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `setSalesTokenCookie` 不再以导出函数形式存在
2. 先跑红灯确认当前导出仍在
3. 将 `setSalesTokenCookie` 改为局部函数
4. 跑现有 `auth-helpers.audit.test.js`，确认锁定与失败审计行为不变

## 不处理内容

本批不处理：

- `getUserAgent`
- `generateSalesToken`
- 管理端认证逻辑
- 登录锁定与失败审计逻辑

## 风险与控制

- 风险: 误删或误改销售端 token cookie 设置逻辑
  控制: 运行现有 `auth-helpers.audit.test.js` 并配合 ESLint 检查

- 风险: 把仍有外部使用的 helper 一并错误收缩
  控制: 先做仓内搜索，确认只处理 `setSalesTokenCookie`
