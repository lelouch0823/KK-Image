# Outbox Ops UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/outbox-ops` into a mixed summary + dual-pane operations console that matches the approved design and preserves the existing replay workflow.

**Architecture:** Keep the existing `ManagementListShell` page scaffold, add a small pure helper for Outbox metrics, then rebuild the page into three layers: operations banner, summary metrics, and the dual-pane workspace. Enhance the event table and replay panel in place so behavior stays anchored to existing data and routes.

**Tech Stack:** Vue 3 SFCs, Vitest, Vue Test Utils, project design-system components, modular i18n locale files

---

### Task 1: Lock the new summary behavior with tests

**Files:**

- Create: `src/components/outbox/__tests__/outboxOpsSummary.test.js`
- Modify: `src/views/__tests__/OutboxOps.behavior.test.js`
- Test: `src/components/outbox/__tests__/outboxOpsSummary.test.js`
- Test: `src/views/__tests__/OutboxOps.behavior.test.js`

- [ ] **Step 1: Write the failing metrics helper test**

```js
it('computes global and filtered metrics from outbox jobs', () => {
  const events = [
    {
      id: 'evt-1',
      created_at: '2026-04-13T08:00:00.000Z',
      consumerJobs: [
        { consumer_name: 'notification', status: 'failed' },
        { consumer_name: 'webhook', status: 'published' },
      ],
    },
  ];

  expect(buildOutboxOpsMetrics(events)).toMatchObject({
    totalEvents: 1,
    failedJobs: 1,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/outbox/__tests__/outboxOpsSummary.test.js`
Expected: FAIL because the helper does not exist yet

- [ ] **Step 3: Write the failing page structure test**

```js
expect(wrapper.find('[data-testid="outbox-ops-banner"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="outbox-ops-summary"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="outbox-workspace"]').exists()).toBe(true);
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js`
Expected: FAIL because the new regions are not rendered

- [ ] **Step 5: Commit**

```bash
git add src/components/outbox/__tests__/outboxOpsSummary.test.js src/views/__tests__/OutboxOps.behavior.test.js
git commit -m "test: lock outbox ops redesign structure"
```

### Task 2: Implement metrics helper and page shell redesign

**Files:**

- Create: `src/components/outbox/outboxOpsSummary.js`
- Modify: `src/views/OutboxOps.vue`
- Modify: `src/components/outbox/OutboxEventTable.vue`
- Test: `src/components/outbox/__tests__/outboxOpsSummary.test.js`
- Test: `src/views/__tests__/OutboxOps.behavior.test.js`

- [ ] **Step 1: Write the minimal metrics helper**

```js
export function buildOutboxOpsMetrics(events = []) {
  return {
    totalEvents: events.length,
    failedJobs: 0,
    activeJobs: 0,
    latestCreatedAt: null,
  };
}
```

- [ ] **Step 2: Rebuild `OutboxOps.vue` around banner + summaries + workspace**

```vue
<template #summary>
  <div data-testid="outbox-ops-summary">...</div>
</template>
<template #content>
  <div data-testid="outbox-workspace">...</div>
</template>
```

- [ ] **Step 3: Add selected row support to `OutboxEventTable.vue`**

```vue
<div :data-selected="selectedEventId === row.id">...</div>
```

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/components/outbox/__tests__/outboxOpsSummary.test.js src/views/__tests__/OutboxOps.behavior.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/outbox/outboxOpsSummary.js src/views/OutboxOps.vue src/components/outbox/OutboxEventTable.vue src/components/outbox/__tests__/outboxOpsSummary.test.js src/views/__tests__/OutboxOps.behavior.test.js
git commit -m "feat: redesign outbox ops page shell"
```

### Task 3: Upgrade replay workspace and localized copy

**Files:**

- Modify: `src/components/outbox/OutboxReplayPanel.vue`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`
- Test: `src/views/__tests__/OutboxOps.behavior.test.js`

- [ ] **Step 1: Write a failing assertion for the richer replay workspace copy**

```js
expect(wrapper.text()).toContain('最近一次操作结果');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js`
Expected: FAIL because the replay panel still uses the older minimal copy

- [ ] **Step 3: Expand `OutboxReplayPanel.vue`**

```vue
<section data-testid="outbox-selection-summary">...</section>
<section data-testid="outbox-replay-actions">...</section>
<section data-testid="outbox-replay-result">...</section>
```

- [ ] **Step 4: Add formal `outboxOps` locale strings in both locale modules**

```js
outboxOps: {
  title: 'Outbox 运维',
  ...
}
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js src/composables/__tests__/useOutboxOps.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/outbox/OutboxReplayPanel.vue src/locales/zh-CN/misc.js src/locales/en/misc.js src/views/__tests__/OutboxOps.behavior.test.js
git commit -m "feat: enrich outbox replay workspace copy"
```

### Task 4: Final verification

**Files:**

- Modify: `src/views/OutboxOps.vue`
- Modify: `src/components/outbox/OutboxEventTable.vue`
- Modify: `src/components/outbox/OutboxReplayPanel.vue`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`

- [ ] **Step 1: Run the full focused verification set**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/__tests__/outboxOpsSummary.test.js src/composables/__tests__/useOutboxOps.test.js`
Expected: PASS with 0 failures

- [ ] **Step 2: Inspect the diff for scope drift**

Run: `git diff --stat`
Expected: only Outbox UI files, locale files, tests, and the plan/spec artifacts touched

- [ ] **Step 3: Commit**

```bash
git add src/views/OutboxOps.vue src/components/outbox/OutboxEventTable.vue src/components/outbox/OutboxReplayPanel.vue src/components/outbox/outboxOpsSummary.js src/components/outbox/__tests__/outboxOpsSummary.test.js src/views/__tests__/OutboxOps.behavior.test.js src/locales/zh-CN/misc.js src/locales/en/misc.js docs/superpowers/plans/2026-04-13-outbox-ops-ui-implementation-plan.md
git commit -m "feat: upgrade outbox ops console ui"
```
