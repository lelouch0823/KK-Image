# Storage Fallback Enabled Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/storage/router.js` 中的 `isFallbackEnabled` 薄包装，直接在 `getFileWithFallback` 中读取 `env.STORAGE_FALLBACK_ENABLED`。

## 本批范围

仅处理：

- `functions/storage/router.js` 的 `isFallbackEnabled`
- `functions/storage/redundancy.js` 的唯一调用点
- 已存在 storage 行为测试的补充覆盖

## 现状

当前 helper 只做一件事：

- `return env.STORAGE_FALLBACK_ENABLED !== 'false'`

仓内唯一调用点：

- `functions/storage/redundancy.js` 的 `getFileWithFallback`

## 方案比较

### 方案 A: 保留 wrapper

优点:
- 逻辑名字更短

缺点:
- 保留单点使用的零逻辑包装
- 真实开关规则仍需跳回 `router.js` 查看

### 方案 B: 在调用点直接内联

优点:
- 删除一层薄壳
- fallback 开关规则在真正分支处可见
- 改动很小

缺点:
- `getFileWithFallback` 分支判断略长

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 扩展现有 static audit test，锁定 `isFallbackEnabled` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 扩展行为测试，验证开关关闭时直接走默认 provider，不进入回退链
4. 删除导出函数
5. 在 `getFileWithFallback` 里直接使用 `env.STORAGE_FALLBACK_ENABLED !== 'false'`
6. 跑 fresh `eslint` 与 storage focused tests

## 不处理内容

本批不处理：

- `getFallbackChain`
- `SmartRouter`
- timeout 逻辑
- provider 选择策略

## 风险与控制

- 风险: 开关关闭时仍进入 fallback 链
  控制: 新增行为测试断言只调用默认 provider

- 风险: `router.js` import 清理不完整
  控制: 跑 `eslint`
