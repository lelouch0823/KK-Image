# Storage Fallback Timeout Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/storage/router.js` 中的 `getFallbackTimeout` 薄包装，直接在 `getFileWithFallback` 中读取 `env.STORAGE_FALLBACK_TIMEOUT`。

## 本批范围

仅处理：

- `functions/storage/router.js` 的 `getFallbackTimeout`
- `functions/storage/redundancy.js` 的唯一调用点
- 新增最小行为测试

## 现状

当前 helper 只做一件事：

- `return parseInt(env.STORAGE_FALLBACK_TIMEOUT || '3000', 10)`

仓内唯一调用点：

- `functions/storage/redundancy.js` 的 `getFileWithFallback`

## 方案比较

### 方案 A: 保留 wrapper

优点:
- timeout 读取有一个短名字

缺点:
- 保留单点使用的零逻辑包装
- 阅读 `getFileWithFallback` 时要跳回 router 文件才能看到默认值

### 方案 B: 在调用点直接内联

优点:
- 删除一层薄壳
- timeout 默认值在真正使用点可见
- 风险低，使用面唯一

缺点:
- `router.js` 少了一个看似对称的导出

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `getFallbackTimeout` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 新增 `getFileWithFallback` 最小行为测试，验证超时后仍会切到下一个 provider
4. 删除导出函数
5. 在 `redundancy.js` 中直接内联 `parseInt(env.STORAGE_FALLBACK_TIMEOUT || '3000', 10)`
6. 跑 fresh `eslint` 与两组测试

## 不处理内容

本批不处理：

- `getFallbackChain`
- `isFallbackEnabled`
- `SmartRouter`
- 其它 storage provider 逻辑

## 风险与控制

- 风险: timeout 默认值或解析方式写错
  控制: 新增 `getFileWithFallback` 行为测试

- 风险: 动态 import 改动后 fallback 流程失效
  控制: 行为测试要求第一 provider 超时后第二 provider 返回成功响应
