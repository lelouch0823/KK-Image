# V1 Cache URL Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/routes/v1/cache-urls.js` 中的两个组合薄包装：

- `getV1FolderAndShareCacheUrls`
- `getV1FileAndFolderCacheUrls`

并让 `DomainOutboxConsumers` 直接组合底层 helper。

## 本批范围

仅处理：

- `functions/lib/hono/routes/v1/cache-urls.js`
- `functions/services/DomainOutboxConsumers.js`
- 相关测试

## 现状

两个 helper 都只做数组拼接和去重：

- `getV1FolderAndShareCacheUrls` = `getV1FolderCacheUrls + getManageShareCacheUrls`
- `getV1FileAndFolderCacheUrls` = `getV1FileCacheUrls + getV1FolderDetailCacheUrls`

仓内真实使用点只有：

- `functions/services/DomainOutboxConsumers.js`

另有直接测试覆盖这些导出函数。

## 方案比较

### 方案 A: 保留 wrapper

优点:
- `DomainOutboxConsumers` 调用点名字更短

缺点:
- 保留两层零业务逻辑组合包装
- 调用点仍要跳回 helper 文件看真实拼接内容

### 方案 B: 在唯一调用点直接组合底层 helper

优点:
- 删除两个导出薄壳
- 组合逻辑回到唯一使用点
- 现有底层 helper 继续保留，语义边界更清晰

缺点:
- `DomainOutboxConsumers` 里多出两段数组去重代码

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定两个 wrapper 不再存在
2. 先跑红灯确认 wrapper 仍在
3. 删除两个导出函数
4. 让 `DomainOutboxConsumers` 直接组合：
   - `getV1FolderCacheUrls + getManageShareCacheUrls`
   - `getV1FileCacheUrls + getV1FolderDetailCacheUrls`
5. 更新 `cache-urls.test.js`，删除对已移除导出的直接测试
6. 在 `DomainOutboxConsumers.audit-cache.test.js` 增加 v1 folder 事件断言，补足 share URL 行为覆盖

## 不处理内容

本批不处理：

- `getV1FolderCacheUrls`
- `getV1FileCacheUrls`
- `getV1FolderDetailCacheUrls`
- manage/shared cache URL helper 本身

## 风险与控制

- 风险: v1 folder 事件漏掉 share cache URL
  控制: 新增 `DomainOutboxConsumers.audit-cache.test.js` 断言

- 风险: v1 file 事件漏掉 folder detail URL
  控制: 保留现有 v1 file cache invalidation 测试
