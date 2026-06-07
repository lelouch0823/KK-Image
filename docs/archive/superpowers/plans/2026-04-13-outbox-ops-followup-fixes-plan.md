# Outbox Ops Follow-Up Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining Outbox Ops correctness and performance issues by limiting backend list scope, preventing stale frontend list overwrites, and making global health metrics render with explicit stale/loading behavior.

**Architecture:** Keep the current page layout, but harden the data path underneath it. Add bounded list semantics in the Outbox route/repository, extend the frontend composable with request sequencing and health-loading state, then update the page so health metrics never silently show stale or empty values while background refreshes are still in flight.

**Tech Stack:** Hono routes, repository layer over D1, Vue 3 composables and SFCs, Vitest, Vue Test Utils

---

### Task 1: Bound the Outbox list query on the backend

**Files:**

- Modify: `functions/repositories/OutboxReplayRepository.js`
- Modify: `functions/repositories/__tests__/OutboxReplayRepository.test.js`
- Modify: `functions/lib/hono/routes/manage/outbox.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`

- [ ] **Step 1: Write the failing repository test for bounded list results**

```js
it('limits outbox list queries to the newest bounded result set', async () => {
  const repo = new OutboxReplayRepository(db);
  await repo.listEvents({ limit: 50 });
  expect(db.getPrepareCalls().some((sql) => sql.includes('LIMIT ?'))).toBe(true);
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `npx vitest run functions/repositories/__tests__/OutboxReplayRepository.test.js`
Expected: FAIL because `listEvents()` currently has no limit support

- [ ] **Step 3: Implement minimal bounded-query support**

```js
async listEvents(filters = {}, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 100), 1), 200);
  // append LIMIT ? to the domain_outbox query and bind limit
}
```

- [ ] **Step 4: Update the route to pass a safe default limit**

```js
const limit = Number(c.req.query('limit') || 100);
const events = await repo.listEvents(filters, { limit });
```

- [ ] **Step 5: Run route + repository tests**

Run: `npx vitest run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/repositories/OutboxReplayRepository.js functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/outbox.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js
git commit -m "fix: bound outbox ops list queries"
```

### Task 2: Guard the frontend list against stale request overwrites

**Files:**

- Modify: `src/composables/useOutboxOps.js`
- Modify: `src/composables/__tests__/useOutboxOps.test.js`

- [ ] **Step 1: Write the failing composable test for request ordering**

```js
it('keeps the newest outbox list result when earlier requests resolve later', async () => {
  // start two loadEvents calls, resolve the second first, then resolve the first
  // assert events.value still matches the newer response
});
```

- [ ] **Step 2: Run the composable test to verify it fails**

Run: `npx vitest run src/composables/__tests__/useOutboxOps.test.js`
Expected: FAIL because older responses currently overwrite newer state

- [ ] **Step 3: Add a request-sequencing guard**

```js
let listRequestId = 0;
const loadEvents = async (filters = {}) => {
  const requestId = ++listRequestId;
  ...
  if (requestId !== listRequestId) return false;
  events.value = json.data || [];
}
```

- [ ] **Step 4: Run the composable tests**

Run: `npx vitest run src/composables/__tests__/useOutboxOps.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useOutboxOps.js src/composables/__tests__/useOutboxOps.test.js
git commit -m "fix: guard outbox ops list against stale responses"
```

### Task 3: Make global health metrics explicit instead of silently stale

**Files:**

- Modify: `src/views/OutboxOps.vue`
- Modify: `src/views/__tests__/OutboxOps.behavior.test.js`
- Modify: `src/components/outbox/outboxOpsSummary.js`
- Modify: `src/components/outbox/__tests__/outboxOpsSummary.test.js`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`

- [ ] **Step 1: Write the failing page test for health-state behavior**

```js
it('shows global health as stale/loading while filtered health refresh is in flight', async () => {
  expect(wrapper.text()).toContain('全局健康概览更新中');
});
```

- [ ] **Step 2: Run the page test to verify it fails**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js`
Expected: FAIL because the page currently swaps health data sources without any explicit state

- [ ] **Step 3: Extend the summary helper to carry source state**

```js
export function buildOutboxOpsMetrics(events = [], filters = {}, options = {}) {
  return { ..., isStale: Boolean(options.isStale), isLoading: Boolean(options.isLoading) };
}
```

- [ ] **Step 4: Track health loading separately in `OutboxOps.vue`**

```js
const healthLoading = ref(false);
const healthLoaded = ref(false);
// render badge/copy for loading, stale, and fresh states
```

- [ ] **Step 5: Run page + summary tests**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/__tests__/outboxOpsSummary.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/views/OutboxOps.vue src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/outboxOpsSummary.js src/components/outbox/__tests__/outboxOpsSummary.test.js src/locales/zh-CN/misc.js src/locales/en/misc.js
git commit -m "fix: clarify outbox ops global health state"
```

### Task 4: Final verification

**Files:**

- Modify: `functions/repositories/OutboxReplayRepository.js`
- Modify: `functions/lib/hono/routes/manage/outbox.js`
- Modify: `src/composables/useOutboxOps.js`
- Modify: `src/views/OutboxOps.vue`

- [ ] **Step 1: Run the focused full verification set**

Run: `npx vitest run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/__tests__/OutboxReplayPanel.test.js src/components/outbox/__tests__/outboxOpsSummary.test.js`
Expected: PASS with 0 failures

- [ ] **Step 2: Review the final diff for scope drift**

Run: `git diff --stat`
Expected: only Outbox backend, Outbox frontend, locale, tests, and this plan file changed

- [ ] **Step 3: Commit**

```bash
git add functions/repositories/OutboxReplayRepository.js functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/outbox.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js src/composables/useOutboxOps.js src/composables/__tests__/useOutboxOps.test.js src/views/OutboxOps.vue src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/outboxOpsSummary.js src/components/outbox/__tests__/outboxOpsSummary.test.js src/locales/zh-CN/misc.js src/locales/en/misc.js docs/superpowers/plans/2026-04-13-outbox-ops-followup-fixes-plan.md
git commit -m "fix: harden outbox ops data flow"
```
