# Manage Media Route Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

继续清理 manage 媒体路由中只透传到 `requireEntity` 的局部 helper，减少 albums、folders、files 三个模块里的重复定义。

## 本批范围

仅处理以下三个 wrapper：

- `functions/lib/hono/routes/manage/albums.js` 的 `requireAlbum`
- `functions/lib/hono/routes/manage/folders.js` 的 `requireFolder`
- `functions/lib/hono/routes/manage/files.js` 的 `requireFile`

## 现状

这三个 helper 都是同一模式：

- 调用 `repo.findById(...)`
- 立即转发给 `requireEntity(...)`
- 只负责拼一个 `NotFoundError`

它们没有额外状态或业务分支，属于典型 route 层薄壳。

## 方案比较

### 方案 A: 保留局部 wrapper

优点:
- 调用名更短

缺点:
- 重复定义继续留在多个路由文件
- 阅读时必须来回跳转

### 方案 B: 在调用点内联 `requireEntity`

优点:
- 删除同形态重复壳
- 404 语义在使用点更直接
- 改动边界小，容易分批验证

缺点:
- 调用表达式更长一些

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 扩展已有 route thin-wrapper audit test，把这三个 wrapper 也锁掉
2. 运行 test，确认当前状态因 wrapper 仍存在而失败
3. 删除三个 helper，并在原调用点内联 `requireEntity(...)`
4. 跑现有 albums / folders / files route tests 回归

## 不处理内容

本批不处理：

- `assertTargetFolderExists`
- `v1/files.js`、`v1/folders.js`
- `sales/orders.js`
- `manage/spaces/route-helpers.js`

## 风险与控制

- 风险: 某个调用点遗漏原来的 not-found 文案
  控制: 内联时保留原 `MSG.*.NOT_FOUND`

- 风险: `folders.js` 中更新后再次读取实体的位置改错
  控制: 只替换实体读取写法，不调整任何后续逻辑
