# Auth Helpers Locked Message Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/_shared/auth-helpers.js` 中的 `getLockedMessage` 薄包装，直接在锁定响应分支内联格式化逻辑。

## 本批范围

仅处理：

- `functions/lib/hono/_shared/auth-helpers.js` 的 `getLockedMessage`
- 该文件内两个锁定响应分支

## 现状

当前 helper 只做一件事：

- `return MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(retryAfter))`

仓内调用面只有同文件内的：

- `checkAndRespondLockout`
- `handleLoginFailure`

## 方案比较

### 方案 A: 保留 wrapper

优点:
- 锁定消息有一个短名字

缺点:
- 保留一层零逻辑包装
- 使用点只有两个且都在同一文件
- 阅读时还要跳回 helper 看真实格式化逻辑

### 方案 B: 在调用点直接内联

优点:
- 删除一层薄壳
- 响应体构造更直接
- 改动面极小

缺点:
- 锁定消息模板会重复两次

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `getLockedMessage` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除导出函数
4. 在两个 `error` 字段处直接内联 `MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(...))`
5. 跑现有 `auth-helpers.audit.test.js` 确认锁定和失败路径行为不变

## 不处理内容

本批不处理：

- `formatRetryAfter`
- 登录失败审计逻辑
- Cookie/JWT 相关 helper

## 风险与控制

- 风险: 内联时把锁定消息模板写错
  控制: 运行现有 `auth-helpers.audit.test.js`

- 风险: 误改未锁定失败路径
  控制: 同一测试文件同时覆盖锁定与普通失败分支
