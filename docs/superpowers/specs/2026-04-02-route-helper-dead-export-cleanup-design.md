# Route Helper Dead Export Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/lib/hono/_shared/route-helpers.js` 中仓内无使用面的 `createCacheInvalidator` 导出。

## 本批范围

仅处理：

- `functions/lib/hono/_shared/route-helpers.js`
- 一条静态 audit test
- 现有 list-cache 测试

## 现状

仓内搜索结果显示：

- `createCacheInvalidator` 只出现在定义处和历史计划文档
- 当前真实缓存路径使用的是 `buildListCacheUrls` 与 `createListCacheInvalidator`

## 方案比较

### 方案 A: 保留死导出

优点:
- 保留一个简单工厂接口

缺点:
- 仓内无人使用
- 增加共享 helper 模块表面积

### 方案 B: 删除死导出

优点:
- 清理无用接口
- 不影响当前真实调用方
- 风险很低

缺点:
- 如果未来需要，要重新加回

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `createCacheInvalidator` 不再存在
2. 先跑红灯确认导出仍在
3. 删除导出函数
4. 跑 `route-helpers.list-cache.test.js` 确认剩余缓存 helper 行为不变

## 不处理内容

本批不处理：

- `buildListCacheUrls`
- `createListCacheInvalidator`
- 分页与销售 token helper

## 风险与控制

- 风险: 删除时误伤同文件其它缓存 helper
  控制: 运行现有 `route-helpers.list-cache.test.js`
