# V1 Permissions Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/routes/v1/_shared/permissions-validation.js` 中的 `findUnknownPermissions` 薄包装，直接使用 `findUnknownPolicyActions`。

## 本批范围

仅处理：

- `functions/lib/hono/routes/v1/_shared/permissions-validation.js` 的 `findUnknownPermissions`
- `functions/lib/hono/routes/v1/permissions.js` 对该薄包装的调用

## 现状

当前 helper 只做一件事：

- `return findUnknownPolicyActions(permissions)`

仓内使用点很窄：

- `functions/lib/hono/routes/v1/permissions.js`
- `functions/lib/hono/routes/v1/_shared/permissions-validation.js` 内部的 `assertKnownPermissions`

## 方案比较

### 方案 A: 保留 wrapper

优点:
- `permissions` 语义在 route 层看起来更贴近业务

缺点:
- 继续保留一层零逻辑转调
- `findUnknownPolicyActions` 已经是清晰、稳定的基础能力
- 增加 route 层共享文件里的重复定义

### 方案 B: 直接使用底层 helper

优点:
- 删除一层薄包装
- `permissions-validation.js` 与 `permissions.js` 都直接依赖真正的实现
- 改动范围小，回归面可控

缺点:
- route 层会直接出现 `policy actions` 命名

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `findUnknownPermissions` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除 `permissions-validation.js` 中的导出包装
4. 让 `assertKnownPermissions` 直接调用 `findUnknownPolicyActions`
5. 让 `permissions.js` 直接从 `authz/index.js` 导入 `findUnknownPolicyActions`
6. 跑现有 route/validation 测试确认行为不变

## 不处理内容

本批不处理：

- `functions/lib/authz/index.js` 的公共接口设计
- `createStructuredAbortError`
- `requireSpace`

## 风险与控制

- 风险: route 导入改错导致 `/check` 未正确拦截未知权限
  控制: 运行 `permissions-contract.test.js`

- 风险: `users.js` 的共享校验路径被破坏
  控制: 运行 `users-permissions-validation.test.js`
