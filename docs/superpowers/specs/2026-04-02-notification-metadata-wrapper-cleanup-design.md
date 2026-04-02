# Notification Metadata Wrapper 清理设计

**日期**: 2026-04-02

## 目标

移除 `NotificationRepository` 内部对 `parseJsonObject` 的薄包装 `parseMetadata`，直接在映射点复用共享 JSON utility。

## 现状

`functions/repositories/NotificationRepository.js` 当前包含：

- `parseMetadata(metadata) { return parseJsonObject(metadata, null); }`

该 helper 仅在同文件 `_mapNotification` 中使用一次，没有额外业务语义。

## 方案比较

### 方案 A: 保留 `parseMetadata`

优点:
- 名字略短

缺点:
- 只是单行透传
- 增加阅读跳转成本

### 方案 B: 直接在 `_mapNotification` 调用 `parseJsonObject`

优点:
- 复用现有共享 utility
- 去掉一层无价值 wrapper
- 改动面极小

缺点:
- 调用表达式稍长

## 采用方案

采用方案 B。

## 设计

调整方式：

1. 删除 `parseMetadata`
2. `_mapNotification` 改为直接调用 `parseJsonObject(n.metadata, null)`
3. 通过审计测试约束该 wrapper 不再回归

## 调整边界

本批只处理该薄包装，不处理：

- 通知仓储的其它 schema 兼容逻辑
- metadata 写入逻辑
- 其他仓储模块的 JSON helper

## 风险与控制

- 风险: metadata invalid JSON 时 fallback 形态变化
  控制: 先补测试锁住 `null` fallback，再改实现
