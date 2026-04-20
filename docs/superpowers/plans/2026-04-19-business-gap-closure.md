# Business Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the main-project business gap closure roadmap across multi-line orders, business stats, reminder center, audit alerts, and backup restore without breaking current admin or sales flows.

**Architecture:** Extend the existing Vue admin/sales surfaces and Hono/D1 backend incrementally. Keep all changes additive, preserve single-line order compatibility, reuse existing stats projection and outbox patterns, and gate high-risk restore/alert features behind strict permissions and auditable flows.

**Tech Stack:** Vue 3, Vue Router, Cloudflare Pages Functions, Hono, D1, R2, Vitest, existing design-system components

---

## File Map

- Modify: `src/components/order/OrderForm.vue`
- Create: `src/components/order/OrderLineEditor.vue`
- Create: `src/components/order/OrderLinesEditor.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/views/sales/SalesFormView.vue`
- Modify: `src/composables/useOrderForm.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/repositories/order/mutations.js`
- Modify: `src/views/Stats.vue`
- Modify or create: `functions/repositories/StatsRepository.js`
- Modify: `functions/services/SystemStatsProjectionRefreshService.js`
- Create: `functions/repositories/ReminderRepository.js`
- Create: `functions/lib/hono/routes/manage/reminders.js`
- Create: `src/views/ReminderCenter.vue`
- Create: `migrations/00xx_reminders_and_audit_alerts.sql`
- Create: `functions/repositories/AuditAlertRepository.js`
- Create: `functions/services/AuditAlertService.js`
- Modify: `functions/lib/hono/routes/manage/audit-logs.js`
- Modify: `functions/lib/hono/routes/manage/backups.js`
- Create: `functions/services/BackupRestoreService.js`
- Modify: `src/components/settings/tabs/BackupSettings.vue`
- Create: `src/components/settings/backup/BackupRestoreDialog.vue`

## Task 1: Multi-line order contract

**Files:**
- Test: `src/components/order/__tests__/OrderLinesEditor.test.js`
- Test: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-create-route.test.js`
- Modify: `src/composables/useOrderForm.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`

- [ ] Write failing frontend and route tests for `lines[]` payload support.
- [ ] Run targeted tests and verify RED.
- [ ] Implement payload normalization that accepts legacy single-line input and new multi-line input.
- [ ] Run targeted tests and verify GREEN.

## Task 2: Multi-line order UI

**Files:**
- Create: `src/components/order/OrderLineEditor.vue`
- Create: `src/components/order/OrderLinesEditor.vue`
- Modify: `src/components/order/OrderForm.vue`
- Modify: `src/components/OrderCreateModal.vue`
- Modify: `src/components/OrderEditModal.vue`
- Modify: `src/views/sales/SalesFormView.vue`

- [ ] Write failing UI behavior tests for add/remove/edit line flows.
- [ ] Verify RED.
- [ ] Implement minimal multi-line editor with design-system controls only.
- [ ] Verify GREEN.

## Task 3: Repository support for multi-line writes

**Files:**
- Test: `functions/repositories/__tests__/order-mutations.test.js`
- Modify: `functions/repositories/order/mutations.js`

- [ ] Write failing repository tests for create/update with multiple lines.
- [ ] Verify RED.
- [ ] Implement minimal batch create/update behavior for multiple `order_lines`.
- [ ] Verify GREEN.

## Task 4: Business stats projection

**Files:**
- Test: `functions/repositories/__tests__/StatsRepository.test.js`
- Test: `functions/services/__tests__/SystemStatsProjectionRefreshService.test.js`
- Modify: `functions/repositories/StatsRepository.js`
- Modify: `functions/services/SystemStatsProjectionRefreshService.js`
- Modify: `functions/lib/hono/routes/manage/stats.js`

- [ ] Write failing tests for business KPI payload fields.
- [ ] Verify RED.
- [ ] Implement additive business metrics in the existing stats projection.
- [ ] Verify GREEN.

## Task 5: Business stats UI

**Files:**
- Test: `src/views/__tests__/Stats.behavior.test.js`
- Modify: `src/views/Stats.vue`

- [ ] Write failing view tests for business KPI rendering.
- [ ] Verify RED.
- [ ] Implement additive business KPI sections and charts.
- [ ] Verify GREEN.

## Task 6: Reminder persistence and routes

**Files:**
- Create: `migrations/00xx_reminders_and_audit_alerts.sql`
- Create: `functions/repositories/ReminderRepository.js`
- Create: `functions/lib/hono/routes/manage/reminders.js`
- Test: `functions/lib/hono/routes/manage/__tests__/reminders-routes.test.js`

- [ ] Write failing route/repository tests for reminder listing and status actions.
- [ ] Verify RED.
- [ ] Implement reminder storage and management routes.
- [ ] Verify GREEN.

## Task 7: Reminder center UI

**Files:**
- Create: `src/views/ReminderCenter.vue`
- Modify: `src/router/index.js`
- Test: `src/views/__tests__/ReminderCenter.behavior.test.js`

- [ ] Write failing page tests for reminder center filters and actions.
- [ ] Verify RED.
- [ ] Implement reminder center page and route wiring.
- [ ] Verify GREEN.

## Task 8: Audit alerts

**Files:**
- Create: `functions/repositories/AuditAlertRepository.js`
- Create: `functions/services/AuditAlertService.js`
- Modify: `functions/lib/hono/routes/manage/audit-logs.js`
- Test: `functions/lib/hono/routes/manage/__tests__/audit-alerts.test.js`

- [ ] Write failing tests for `audit.export` and high-risk delete alert generation.
- [ ] Verify RED.
- [ ] Implement fixed-rule alert generation with dedupe.
- [ ] Verify GREEN.

## Task 9: Backup validate and restore

**Files:**
- Create: `functions/services/BackupRestoreService.js`
- Modify: `functions/lib/hono/routes/manage/backups.js`
- Test: `functions/lib/hono/routes/manage/__tests__/backups-restore-routes.test.js`

- [ ] Write failing tests for validate/dry-run/execute restore endpoints.
- [ ] Verify RED.
- [ ] Implement controlled restore service with audit-ready run summaries.
- [ ] Verify GREEN.

## Task 10: Backup restore UI

**Files:**
- Create: `src/components/settings/backup/BackupRestoreDialog.vue`
- Modify: `src/components/settings/tabs/BackupSettings.vue`
- Test: `src/components/settings/tabs/__tests__/BackupSettings.behavior.test.js`

- [ ] Write failing UI tests for validate/dry-run/restore flows.
- [ ] Verify RED.
- [ ] Implement restore controls in the Backups settings tab.
- [ ] Verify GREEN.

## Task 11: Documentation and verification

**Files:**
- Modify: `docs/admin-manual/pages/orders.md`
- Modify: `docs/admin-manual/pages/stats.md`
- Modify: `docs/admin-manual/pages/settings.md`
- Modify: `docs/admin-manual/pages/audit-logs.md`

- [ ] Update operator docs for new flows.
- [ ] Run focused unit tests for touched areas.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm test:real-api` for cross-route evidence when route changes are complete.
