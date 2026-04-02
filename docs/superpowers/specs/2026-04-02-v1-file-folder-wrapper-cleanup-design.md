# V1 File Folder Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

继续清理 `v1/files.js` 与 `v1/folders.js` 中的局部 `requireEntity` 薄包装，减少 v1 路由层重复定义。

## 本批范围

仅处理：

- `functions/lib/hono/routes/v1/files.js` 的 `requireFile`
- `functions/lib/hono/routes/v1/folders.js` 的 `requireFolder`

## 现状

这两个 helper 都只在本文件内部使用，并且行为很薄：

- `v1/files.js` 的 `requireFile` 只是 `repo.findById(id)` + `requireEntity(...)`
- `v1/folders.js` 的 `requireFolder` 也是同样模式，只多接收一个错误文案参数

两者都没有额外缓存、鉴权或领域状态。

## 方案比较

### 方案 A: 保留 wrapper

优点:
- 调用写法更短

缺点:
- 继续保留 route 层重复定义
- `requireEntity` 语义被隐藏

### 方案 B: 调用点内联 `requireEntity`

优点:
- 删除局部薄壳
- 错误语义就地可见
- 与前两批 route cleanup 保持一致

缺点:
- `v1/folders.js` 的父目录不存在分支会多写一行错误工厂

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 扩展已有 route thin-wrapper audit test，把 `v1/files.js` 与 `v1/folders.js` 也纳入
2. 先跑 test，确认当前状态因两个 wrapper 仍存在而失败
3. 删除两个 helper，并在对应调用点直接写 `requireEntity(...)`
4. 复跑现有 v1 file/folder route tests

## 不处理内容

本批不处理：

- `v1/webhooks.js` 的 `requireWebhookById`
- `assertTargetFolderExists`
- `findDetail` 的 detail 查询路径

## 风险与控制

- 风险: `v1/folders.js` 父目录不存在时文案从 `PARENT_NOT_FOUND` 退回默认文案
  控制: 单独保留该调用点的自定义 `NotFoundError(MSG.FOLDER.PARENT_NOT_FOUND)`

- 风险: `v1/files.js` 更新/删除路径的 not-found 语义改错
  控制: 只做机械内联，不改后续逻辑
