# Space Transformer Export Cleanup 设计

**日期**: 2026-04-02

## 目标

收缩 `functions/lib/hono/routes/manage/spaces/transformers.js` 的无用导出面：

- 将 `transformFile` 从导出函数降为局部函数
- 删除仓内无使用面的 `transformSpaceStats`

## 本批范围

仅处理：

- `functions/lib/hono/routes/manage/spaces/transformers.js`
- 相关静态 audit test
- 现有 transformer 行为测试

## 现状

仓内搜索结果显示：

- `transformFile` 只在同文件内被 `transformSpaceDetail` 调用
- `transformSpaceStats` 无仓内调用点

这意味着当前导出面大于真实使用面。

## 方案比较

### 方案 A: 保留当前导出面

优点:
- 未来若需要，可直接单独 import

缺点:
- 暴露了不需要的实现细节
- 增加模块表面积
- `transformSpaceStats` 已经是死导出

### 方案 B: 收缩导出面

优点:
- 模块接口更贴近真实用途
- 一次删除一个死导出并收回一个内部实现细节
- 不影响当前调用方

缺点:
- 如果未来真要单独复用，需要重新导出

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `transformFile` 与 `transformSpaceStats` 不再作为导出存在
2. 先跑红灯确认当前导出仍在
3. 将 `transformFile` 改为局部函数
4. 删除 `transformSpaceStats`
5. 运行现有 `transformers.test.js` 确认公开行为不变

## 不处理内容

本批不处理：

- `projectSpaceTemplateData`
- `transformSpaceListItem`
- `transformSpaceDetail`
- spaces route 本身的行为

## 风险与控制

- 风险: `transformSpaceDetail` 因局部函数调整而输出变化
  控制: 运行现有 `transformers.test.js`

- 风险: 仓外代码可能依赖 `transformSpaceStats`
  控制: 本批仅基于仓内 `0` 使用面清理；若后续确认需要公开，可单独恢复
