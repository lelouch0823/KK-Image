# Order Procurement Outbox Expansion Phase 3 Audit Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give operators and developers a safe, auditable way to inspect domain outbox history, identify stuck side effects, and replay side-effect consumers without mutating core business truth.

**Architecture:** Build replay as a separate operator command path. Read models come from immutable outbox rows, consumer job state, and immutable webhook/notification traces. Replay persists operator intent, records dry-run/live outcomes, and invokes the same side-effect consumers under replay context so dedupe guarantees remain in force.

**Tech Stack:** Cloudflare D1/SQLite, Hono, Vitest, existing audit helpers, outbox tables, webhook logs, notification source fields

---

## Pre-Execution Refresh Rule

Before coding this phase, refresh this document against the shipped versions of:

- `functions/services/DomainEventCatalog.js`
- `functions/services/DomainOutboxConsumers.js`
- `functions/services/WebhookDeliveryService.js`
- `functions/repositories/NotificationRepository.js`
- `docs/DATABASE_SCHEMA.md`

This phase must reflect real consumer names and log columns from Phases 1 and 2.

### Task 1: Add replay persistence and read-model queries

**Files:**
- Modify: `scripts/init-database.sql`
- Modify: `docs/DATABASE_SCHEMA.md`
- Create: `functions/repositories/OutboxReplayRepository.js`
- Create: `functions/repositories/__tests__/OutboxReplayRepository.test.js`

- [ ] **Step 1: Write failing repository tests for event history and replay runs**

```js
it('queries events with consumer-job and webhook delivery state', async () => {});
it('creates replay runs for dry-run and live replay requests', async () => {});
it('finds all events emitted by a command_id or a specific event_id', async () => {});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test:unit functions/repositories/__tests__/OutboxReplayRepository.test.js`
Expected: FAIL because the repository and replay tables do not exist

- [ ] **Step 3: Add replay-run persistence**

```sql
CREATE TABLE IF NOT EXISTS outbox_replay_runs (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  consumer_name TEXT,
  dry_run INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  requested_by TEXT,
  summary_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
```

- [ ] **Step 4: Build repository read models**

```js
async getEventDetail(eventId) {}
async listEvents(filters = {}) {}
async createReplayRun(input) {}
async finalizeReplayRun(runId, summary) {}
```

- [ ] **Step 5: Re-run focused tests**

Run: `pnpm test:unit functions/repositories/__tests__/OutboxReplayRepository.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/init-database.sql docs/DATABASE_SCHEMA.md functions/repositories/OutboxReplayRepository.js functions/repositories/__tests__/OutboxReplayRepository.test.js
git commit -m "feat: add outbox replay read models and run persistence"
```

### Task 2: Add operator inspection routes for outbox and replay

**Files:**
- Create: `functions/lib/hono/routes/manage/outbox.js`
- Create: `functions/lib/hono/routes/manage/audit-replay.js`
- Modify: `functions/lib/hono/app.js`
- Create: `functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`
- Create: `functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js`
- Verify: `functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`

- [ ] **Step 1: Write failing route tests**

```js
it('lists outbox events with stuck-consumer filters for operators', async () => {});
it('returns event detail including consumer jobs and webhook attempts', async () => {});
it('accepts dry-run replay requests only for admin users', async () => {});
```

- [ ] **Step 2: Run focused route tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js`
Expected: FAIL because the routes are not mounted

- [ ] **Step 3: Create operator routes and mount them**

```js
app.route('/api/manage/outbox', manageOutboxRoutes);
app.route('/api/manage/audit-replay', manageAuditReplayRoutes);
```

```js
app.get('/', requirePermission('audit_logs:read'), async (c) => {});
app.get('/:eventId', requirePermission('audit_logs:read'), async (c) => {});
app.post('/dry-run', requirePermission('audit_logs:write'), async (c) => {});
app.post('/execute', requirePermission('audit_logs:write'), async (c) => {});
```

- [ ] **Step 4: Declare and verify audit contracts**

```js
declareAuditRoutes([
  { method: 'POST', path: '/dry-run', domain: 'audit-replay', action: 'outbox.replay.dry_run', severity: 'high', targetType: 'outbox_event' },
  { method: 'POST', path: '/execute', domain: 'audit-replay', action: 'outbox.replay.execute', severity: 'critical', targetType: 'outbox_event' },
]);
```

- [ ] **Step 5: Re-run the focused route tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/lib/hono/routes/manage/outbox.js functions/lib/hono/routes/manage/audit-replay.js functions/lib/hono/app.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js
git commit -m "feat: add operator outbox inspection and replay routes"
```

### Task 3: Implement replay execution as a side-effect-only operator command

**Files:**
- Create: `functions/services/OutboxReplayService.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/repositories/OutboxReplayRepository.js`
- Create: `functions/services/__tests__/OutboxReplayService.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.notifications.test.js`
- Test: `functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`

- [ ] **Step 1: Write failing replay service tests**

```js
it('dry-runs replay targets without mutating consumer state', async () => {});
it('replays only side-effect consumers and records a replay run summary', async () => {});
it('rejects attempts to replay unknown or core-truth consumers', async () => {});
```

- [ ] **Step 2: Run focused service tests to verify failure**

Run: `pnpm test:unit functions/services/__tests__/OutboxReplayService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`
Expected: FAIL because no replay service or replay-aware consumer context exists

- [ ] **Step 3: Create a replay service that invokes existing consumers under replay context**

```js
export class OutboxReplayService {
  async dryRun(target) {}
  async executeReplay(target, options = {}) {
    return consumer({
      db: this.db,
      env: this.env,
      event,
      replay: { runId, requestedBy, mode: 'operator_replay' },
    });
  }
}
```

- [ ] **Step 4: Make replay an audited operator action**

```js
await recordAuditEvent(db, {
  domain: 'audit-replay',
  action: 'outbox.replay.execute',
  targetType: 'outbox_event',
  targetId: event.id,
  metadata: { consumerName, replayRunId: runId },
});
```

- [ ] **Step 5: Re-run the focused service tests**

Run: `pnpm test:unit functions/services/__tests__/OutboxReplayService.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/services/OutboxReplayService.js functions/services/DomainOutboxConsumers.js functions/repositories/OutboxReplayRepository.js functions/services/__tests__/OutboxReplayService.test.js
git commit -m "feat: replay outbox side effects through operator service"
```

### Task 4: Close the phase with observability regressions

**Files:**
- Verify: `functions/repositories/__tests__/OutboxReplayRepository.test.js`
- Verify: `functions/services/__tests__/OutboxReplayService.test.js`
- Verify: `functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`
- Verify: `functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js`

- [ ] **Step 1: Run the full Phase 3 regression gate**

Run: `pnpm test:unit functions/repositories/__tests__/OutboxReplayRepository.test.js functions/services/__tests__/OutboxReplayService.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js functions/services/__tests__/DomainOutboxConsumers.notifications.test.js functions/services/__tests__/DomainOutboxConsumers.webhooks.test.js functions/lib/hono/_shared/__tests__/audit-runtime-alignment.test.js`
Expected: PASS

- [ ] **Step 2: Update docs to describe replay scope limits**

```md
Replay rules:
- allowed: audit, cache, notification, webhook
- forbidden: receipt command truth mutation
- all replay actions must create `outbox_replay_runs` rows and audit events
```

- [ ] **Step 3: Commit**

```bash
git add docs/DATABASE_SCHEMA.md functions/repositories/OutboxReplayRepository.js functions/services/OutboxReplayService.js functions/lib/hono/routes/manage/outbox.js functions/lib/hono/routes/manage/audit-replay.js
git commit -m "chore: close audit replay phase"
```
