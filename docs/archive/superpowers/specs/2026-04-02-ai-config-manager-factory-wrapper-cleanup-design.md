# AI Config Manager Factory Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `functions/ai/config-manager.js` 中导出的便捷工厂 `createAIConfigManager`，直接在调用/测试处构造 `new AIConfigManager(env.DB, env)`。

## 本批范围

仅处理：

- `functions/ai/config-manager.js` 的 `createAIConfigManager`

## 现状

当前工厂仅做一件事：

- `return new AIConfigManager(env.DB, env)`

仓内实际使用点只有配置管理器测试，没有生产调用。

## 方案比较

### 方案 A: 保留工厂

优点:
- 调用更短

缺点:
- 保留一层无业务语义的导出薄壳
- 与类构造真实依赖不够直接

### 方案 B: 删除工厂，直接构造实例

优点:
- 去掉无价值 wrapper
- 测试显式表达 `db` 与 `env` 依赖
- 改动面极小

缺点:
- 测试里会多写一点构造参数

## 采用方案

采用方案 B。

## 设计

执行顺序：

1. 新增静态 audit test，锁定 `createAIConfigManager` 不再导出
2. 先跑红灯确认工厂仍在
3. 删除导出工厂
4. 更新测试，直接用 `new AIConfigManager(env.DB, env)`
5. 跑 `config-manager.test.js`

## 不处理内容

本批不处理：

- `AIConfigManager` 类实现
- 配置 schema / 默认值
- 任何生产调用逻辑

## 风险与控制

- 风险: 测试构造参数顺序写错
  控制: 保持和原工厂完全一致的 `env.DB, env` 顺序

- 风险: 仓外接口兼容性
  控制: 当前仓内唯一使用点已确认，仅做内部收敛
