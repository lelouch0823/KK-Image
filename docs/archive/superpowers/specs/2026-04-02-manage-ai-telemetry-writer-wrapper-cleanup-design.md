# Manage AI Telemetry Writer Wrapper Cleanup 设计

**日期**: 2026-04-02

## 目标

删除 `manage/ai.js` 中的局部 `createTelemetryWriter` 工厂壳，直接在调用点使用 `createAITelemetryWriter({ db: env?.DB })`。

## 本批范围

仅处理：

- `functions/lib/hono/routes/manage/ai.js` 的 `createTelemetryWriter`

## 现状

这个 helper 当前只做一件事：

- `return createAITelemetryWriter({ db: env?.DB })`

它没有额外默认值策略或容错逻辑，只增加一次跳转。

## 方案比较

### 方案 A: 保留 helper

优点:
- 调用稍短

缺点:
- 保留无业务语义的局部薄壳
- 阅读时需要额外跳转

### 方案 B: 在调用点内联工厂调用

优点:
- 直接显式依赖 `createAITelemetryWriter`
- 删除一个无价值 wrapper
- 改动面极小

缺点:
- 两个调用点表达式更长

## 采用方案

采用方案 B。

## 设计

调整顺序：

1. 新增一个静态 audit test，锁定 `manage/ai.js` 不再定义 `createTelemetryWriter`
2. 先跑红灯确认 wrapper 仍存在
3. 删除 helper
4. `/chat` 和 `/stream` 两个调用点直接内联工厂调用
5. 跑现有 `ai-routes.test.js`

## 不处理内容

本批不处理：

- `resolveAIRuntimeEnv`
- `createRequestId`
- AI telemetry writer 本身实现

## 风险与控制

- 风险: 内联时把 `env?.DB` 写成 `env.DB`，影响空值容错
  控制: 保持原 `env?.DB` 参数形态

- 风险: 只改到一个调用点
  控制: 先用 `rg` 锁定两个 `createTelemetryWriter(...)` 调用，再替换
