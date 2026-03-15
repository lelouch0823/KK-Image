# 审计运维手册

本文档说明如何在 kk-life 中使用、导出和排查统一操作审计日志。

## 适用范围

- 管理端审计中心
- `audit:read` / `audit:export` 权限持有者
- 运维、合规、事故响应人员

## 入口与权限

- 审计列表接口：`GET /api/manage/audit-logs`
- 审计导出接口：`GET /api/manage/audit-logs/export`

权限要求：

- 查看日志：`audit:read`
- 导出日志：`audit:export`

## 常用筛选项

支持的主要筛选参数：

- `actorId`
- `actorType`
- `domain`
- `action`
- `result`
- `severity`
- `targetType`
- `targetId`
- `start`
- `end`

排查建议：

- 先按 `domain` 缩小业务域
- 再按 `result=denied|failed` 看高风险异常
- 最后结合 `actorId` / `targetId` 追溯具体操作者或目标实体

## 导出流程

JSON 导出：

```bash
GET /api/manage/audit-logs/export?format=json&domain=orders&start=...
```

CSV 导出：

```bash
GET /api/manage/audit-logs/export?format=csv&domain=orders&severity=high
```

说明：

- 导出始终是过滤后导出，不提供整表裸导出
- 单次导出上限由服务端限制
- 导出操作本身会写入审计事件 `audit.export`
- CSV 导出会对以 `=`, `+`, `-`, `@` 开头的危险单元格做安全转义，避免表格公式注入

## 事故排查建议

### 权限拒绝

关注：

- `result=denied`
- `severity=high`
- 高频重复的 `actorId`

排查顺序：

1. 确认操作者权限是否变更
2. 对照对应资源的授权策略
3. 检查是否存在脚本或自动化误调用

### 失败写操作

关注：

- `result=failed`
- 同一 `action` 在短时间内重复出现
- `metadata_json` / `changes_json` 中的上下文线索

排查顺序：

1. 结合应用错误日志与请求 ID
2. 核对目标实体当时状态
3. 判断是否为输入问题、状态机冲突或库存/约束错误

## 审计来源可信度

- `source_app` 仅从服务端可确认的认证上下文推断，不再信任客户端自报来源头
- `ip_address` 默认使用服务端提供的 `CF-Connecting-IP`
- `request_id` 默认使用服务端提供的 `CF-Ray`
- 如业务需要额外链路 ID，应由服务端内部代码显式写入审计事件或元数据

## 审计访问留痕

- 查看审计列表：`GET /api/manage/audit-logs` 会写入 `audit.read`
- 查看动作枚举：`GET /api/manage/audit-logs/actions` 会写入 `audit.actions.read`
- 导出审计：`GET /api/manage/audit-logs/export` 会写入 `audit.export`

这三类事件用于追踪谁在查看、枚举或导出审计数据。

### 高风险删除或归档

关注：

- `severity=critical`
- `action` 包含 `delete` / `archive` / `empty`

排查顺序：

1. 确认操作者身份
2. 确认目标范围是否超预期
3. 评估是否需要回滚、恢复或冻结账号

## 与排除路由的关系

部分非变更型 POST 接口不进入主操作审计台账，例如：

- AI chat / stream / report
- hash 预检查
- 影响预览类接口

这些排除项统一登记在：

- `functions/lib/hono/_shared/audit-route-exclusions.js`

审查排除项时，应优先确认它们是否仍然属于“非变更请求”。
