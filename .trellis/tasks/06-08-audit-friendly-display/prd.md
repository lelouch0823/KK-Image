# brainstorm: 优化操作审计字段展示

## Goal

操作审计列表不要直接暴露 `admin.auth.login`、`purchase_order.item.delete` 这类底层 action / target / JSON 字段给业务用户。前端应在列表、筛选项、目标对象和详情列统一显示更易理解的中文文本，同时保留原始字段值用于筛选和排查。

## What I already know

* 用户指出“操作审计”列、“目标对象”和“详情”列目前会显示底层值。
* 前端页面是 `src/views/AuditLogs.vue`。
* 审计行归一化和详情格式化集中在 `src/utils/audit-log.ts`。
* 现有测试在 `src/views/__tests__/AuditLogs.behavior.test.js`。
* 后端 action 示例包括 `admin.auth.login`、`purchase_order.item.delete`。

## Assumptions

* 本任务只优化管理端操作审计列表的前端展示，不改审计入库 schema。
* action 筛选仍使用原始 action 值提交给后端，但下拉 label 显示为友好文本。
* 未覆盖的 action / target 类型应降级为可读文本，而不是继续直接显示点号/下划线代码。

## Requirements

* 操作审计 action 列显示中文友好名，例如登录、删除采购单明细。
* action 筛选下拉显示友好名，但 value 仍保持后端 action 原值。
* 目标对象列显示中文目标类型，并拼接目标 label/id。
* 详情列将常见 JSON 字段转换成可读摘要，避免裸 JSON 成为默认体验。
* summary 缺失时，自动摘要也应使用友好 action 和目标对象。
* 未知 action / target / detail key 有稳定兜底显示。

## Acceptance Criteria

* [x] `admin.auth.login` 在 action 列或筛选项中显示为“管理员登录”。
* [x] `purchase_order.item.delete` 显示为“删除采购单明细”。
* [x] `target_type: purchase_order_item` 显示为“采购单明细”。
* [x] 详情列对 `orderNumber`、`itemId`、`reason` 等常见字段显示中文标签。
* [x] 单元测试覆盖 action、target、details 和 summary 的友好展示。
* [x] 现有审计列表加载、筛选、分页行为不回退。

## Definition of Done

* Tests added/updated.
* Relevant frontend test command passes.
* Lint/typecheck command run if practical.
* No backend API contract changes unless implementation proves necessary.

## Out of Scope

* 不改变审计日志数据库结构。
* 不改变后端 action 命名和过滤协议。
* 不新增详情弹窗或导出格式重做。

## Technical Notes

* `src/views/AuditLogs.vue` 当前直接渲染 `action` 和 `target_type`，详情调用 `formatAuditDetails(row)`。
* `src/utils/audit-log.ts` 当前只做 JSON parse 和简单 fallback。
* `src/views/__tests__/AuditLogs.behavior.test.js` 可扩展为 formatter 行为测试。
