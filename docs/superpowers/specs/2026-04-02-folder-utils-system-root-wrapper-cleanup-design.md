# Folder Utils System Root Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/api/utils/folder-utils.js` 中的 `ensureSystemRoot` 薄包装，直接在调用点使用 `ensureFolder(env, '_System', null, true)`。

## 本批范围

仅处理：

- `functions/api/utils/folder-utils.js` 的 `ensureSystemRoot`

## 现状

当前 helper 只做一件事：

- `return await ensureFolder(env, '_System', null, true)`

仓内实际调用点只有同文件内的：

- `ensureProductFolder`
- `ensureOrderFolder`
- `ensureSpaceFolder`

以及一个对应测试。

## 方案比较

### 方案 A: 保留 helper

优点:
- `_System` 根目录的意图名字更短

缺点:
- 继续保留导出薄包装
- 仓内没有真实跨模块复用价值

### 方案 B: 在调用点内联 `ensureFolder`

优点:
- 删除一层无业务语义 wrapper
- 三个调用点都能直接看见 `_System` 根目录创建参数
- 改动面很小

缺点:
- `_System` 参数会重复三次

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `ensureSystemRoot` 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除导出函数
4. 在三个调用点直接内联 `ensureFolder(env, '_System', null, true)`
5. 更新 `folder-utils.test.js`，不再 import 该 helper，并把原测试改成验证 `ensureProductFolder` 会先创建 `_System` 再创建 `Products`

## 不处理内容

本批不处理：

- `ensureFolder` 主体逻辑
- `ensureVariantFolder`
- `moveFilesToFolder`

## 风险与控制

- 风险: 内联后 `_System` 参数写错
  控制: 用现有测试锁 `bind` 调用参数

- 风险: 丢掉系统根目录创建顺序
  控制: 将原 `ensureSystemRoot` 测试改为检查 `ensureProductFolder` 的两次创建顺序
