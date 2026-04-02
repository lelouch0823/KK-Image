# DemandService Thin Wrapper 清理设计

**日期**: 2026-04-02

## 目标

移除 `DemandService` 中没有独立业务语义、且未被实例调用的薄包装方法 `projectOrderLineStatus`。

## 现状

`functions/services/DemandService.js` 当前包含：

- `projectOrderLineStatus(payload = {}) { return projectOrderLineStatus(payload); }`

这个实例方法只是直接透传到 `OrderStatusProjectionService` 的同名函数。

已确认：

- 代码库里没有 `demandService.projectOrderLineStatus(...)` 调用点
- 该方法不参与 `DemandService` 其余状态同步主流程

## 方案比较

### 方案 A: 保留实例薄包装

优点:
- 表面上 API 更完整

缺点:
- 无独立语义
- 与已有 thin wrapper 清理方向相反

### 方案 B: 删除实例薄包装

优点:
- 去掉一层无价值转发
- 与现有 `service-thin-wrappers.audit.test.js` 约束一致

缺点:
- 如果后续有人想通过实例访问，需要直接导入共享函数

## 采用方案

采用方案 B。

## 设计

调整方式：

1. 在 `service-thin-wrappers.audit.test.js` 中加入 `DemandService.prototype` 审计约束
2. 删除 `DemandService.projectOrderLineStatus`
3. 清理 `DemandService.js` 中不再需要的 `projectOrderLineStatus` 导入

## 调整边界

本批只清理该薄包装，不处理：

- `DemandService` 其他状态同步逻辑
- `OrderStatusProjectionService` 实现
- 其他 service 的 helper 复用

## 风险与控制

- 风险: 存在隐藏的实例调用点
  控制: 已做全仓搜索；同时通过审计测试长期约束该方法不回归
