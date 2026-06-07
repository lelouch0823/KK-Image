# Backend JSON Parse Helper Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the existing backend JSON utility so repository, services, and route modules stop carrying their own JSON.parse fallback helpers.

**Architecture:** Keep `safeJsonParse` as the single implementation in `functions/api/utils/json.js`. Rewire the replay repository, outbox consumers, webhook delivery service, and audit-log route module to call that helper while preserving each module's current fallback value.

**Tech Stack:** Vitest, ESLint, Hono route modules, repository/service modules

---

### Task 1: Lock Fallback Semantics

**Files:**

- Modify: `functions/repositories/__tests__/OutboxReplayRepository.test.js`
- Modify: `functions/services/__tests__/WebhookDeliveryService.test.js`
- Modify: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

- replay repository keeps `null` fallback for invalid JSON summary fields
- webhook delivery still falls back to `{}` for invalid `payload_json`
- outbox consumers still fall back to `{}` for invalid `payload_json`
- audit-log rows still normalize invalid `changes_json` / `metadata_json` to `null`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js
```

Expected: FAIL because the current local helpers are still in place and the new fallback assertions are not implemented yet.

### Task 2: Reuse `safeJsonParse`

**Files:**

- Modify: `functions/repositories/OutboxReplayRepository.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/services/WebhookDeliveryService.js`
- Modify: `functions/lib/hono/routes/manage/audit-logs.js`

- [ ] **Step 1: Replace local parse helpers with the shared utility**

Reuse `safeJsonParse` while preserving each module's fallback value.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/repositories/OutboxReplayRepository.js functions/services/DomainOutboxConsumers.js functions/services/WebhookDeliveryService.js functions/lib/hono/routes/manage/audit-logs.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/services/__tests__/WebhookDeliveryService.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-backend-json-parse-dedup-design.md docs/superpowers/plans/2026-04-02-backend-json-parse-dedup-plan.md functions/repositories/OutboxReplayRepository.js functions/services/DomainOutboxConsumers.js functions/services/WebhookDeliveryService.js functions/lib/hono/routes/manage/audit-logs.js
git commit -m "refactor: dedupe backend json parsing"
```
