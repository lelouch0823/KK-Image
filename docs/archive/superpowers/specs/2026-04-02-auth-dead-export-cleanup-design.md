# Auth Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/api/utils/auth.js` 中仓内无真实使用的 `generateApiKey` 导出。

## 本批范围

仅处理：

- `functions/api/utils/auth.js`
- 一条静态 dead-export audit test
- 现有 `functions/api/utils/__tests__/auth.test.js`

## 现状

全仓搜索结果显示：

- `generateApiKey` 只出现在 `auth.js` 定义处
- 同模块中的 `generateJWT`、`verifyTurnstile`、`__resetApiKeyCacheForTest` 仍被真实测试与运行代码使用

## 方案比较

### 方案 A: 保留死导出

优点:
- 保留未来可能直接生成 API key 的入口

缺点:
- 当前无任何调用方
- 扩大 auth util 模块导出面
- 静态审查时增加噪音

### 方案 B: 删除死导出

优点:
- 收缩模块边界
- 不影响现有 JWT / API key 校验路径
- 风险低

缺点:
- 未来如果需要直接生成 API key，需要重新添加接口

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `generateApiKey` 不再被导出
2. 先跑红灯确认当前导出仍在
3. 删除 `generateApiKey`
4. 跑现有 `auth.test.js`，确认 auth util 其余真实功能仍正常

## 不处理内容

本批不处理：

- `generateJWT`
- `verifyJWT`
- `verifyApiKey`
- `verifyTurnstile`
- API key 缓存逻辑

## 风险与控制

- 风险: 删除时误伤 `auth.js` 其余导出
  控制: 运行 `auth.test.js`

- 风险: audit test 只锁定字符串，遗漏行为问题
  控制: 配合 ESLint 与现有 auth 功能测试
