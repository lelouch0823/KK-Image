# Storage Index Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/storage/index.js` 中仓内无使用面的死导出：

- `getProviderForFile`
- `listAvailableProviders`
- `clearProviderCache`

## 本批范围

仅处理：

- `functions/storage/index.js`
- 一条静态 audit test

## 现状

仓内搜索结果显示：

- `getProviderForFile` 仅在定义处出现
- `listAvailableProviders` 仅在定义处出现
- `clearProviderCache` 仅在定义处出现

这三个接口都不参与当前仓库内的真实运行路径。

## 方案比较

### 方案 A: 保留死导出

优点:
- 如果未来要用，已有接口

缺点:
- 当前是无使用面的导出噪音
- 增加 storage 工厂模块的表面积
- 容易误导后续维护者把它们当成仍在使用的稳定 API

### 方案 B: 直接删除死导出

优点:
- 一次收缩三个无用接口
- 收益高于继续清单个薄壳
- 风险低，因为仓内没有调用点

缺点:
- 如果未来需要，要重新加回

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定三处死导出不再存在
2. 先跑红灯确认导出仍在
3. 删除三个导出函数
4. 运行 `eslint` 与 audit test，确认模块保持干净

## 不处理内容

本批不处理：

- `getStorageProvider`
- provider class re-export
- `StorageProviderType`
- 各 provider 实现文件

## 风险与控制

- 风险: 误删仓外约定的公开 API
  控制: 当前策略仅针对仓内 `0` 使用且无运行路径覆盖的死导出；本批不动 `getStorageProvider` 和 provider class re-export
