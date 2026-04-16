# Storage Index Provider Re-Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/storage/index.js` 中仓内无使用面的 provider class re-export：

- `BaseStorageProvider`
- `TelegramStorageProvider`
- `R2StorageProvider`
- `S3StorageProvider`

## 本批范围

仅处理：

- `functions/storage/index.js`
- 一条静态 audit test

## 现状

仓内搜索结果显示：

- 这 4 个名字只出现在各自定义文件、`storage/index.js` 的 re-export 行，以及架构文档
- 仓内没有运行时代码从 `functions/storage/index.js` 导入这些 re-export

## 方案比较

### 方案 A: 保留 re-export

优点:
- `storage/index.js` 看起来更像统一出口

缺点:
- 仓内无真实使用
- 继续扩大 `storage/index.js` 的公开表面积
- 容易让维护者误以为这是稳定入口

### 方案 B: 删除死 re-export

优点:
- 继续收缩 storage 工厂模块的无用导出
- 不影响 provider 类自身定义文件
- 改动集中、收益明确

缺点:
- 如果未来想从 `storage/index.js` 统一导入 provider class，需要重新加回

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 4 个 re-export 不再存在
2. 先跑红灯确认 re-export 仍在
3. 删除 re-export 行
4. 运行 `eslint` 与 audit test

## 不处理内容

本批不处理：

- `getStorageProvider`
- `StorageProviderType`
- `providerRegistry`
- 各 provider 实现文件和 `base-provider.js`

## 风险与控制

- 风险: 仓外代码可能把 `storage/index.js` 当统一入口
  控制: 本批仅删除仓内 `0` 使用的 class re-export，不动类定义本身；若后续确认需要公开入口，可单独恢复
