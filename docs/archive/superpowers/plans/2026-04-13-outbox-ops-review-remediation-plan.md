# Outbox Ops Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining Outbox Ops review findings: stale detail races, silent list truncation, and hidden stale global health snapshots.

**Architecture:** Keep the current Outbox Ops page structure, but harden the data path and operator feedback. Add request sequencing for event detail loads, make the backend list contract explicit about truncation, and surface stale/limited-state messaging in the UI so operators can trust what they are seeing.

**Tech Stack:** Hono routes, repository layer over D1, Vue 3 composables and SFCs, Vitest, Vue Test Utils, locale modules

---

### Task 1: Guard event detail requests against stale selection races

**Files:**

- Modify: `src/composables/useOutboxOps.js`
- Modify: `src/composables/__tests__/useOutboxOps.test.js`
- Modify: `src/views/OutboxOps.vue`
- Modify: `src/views/__tests__/OutboxOps.behavior.test.js`

- [ ] **Step 1: Write the failing composable test for detail request ordering**

```js
it('keeps the newest event detail when earlier detail requests resolve later', async () => {
  // fire loadEventDetail('evt-old') and loadEventDetail('evt-new')
  // resolve evt-new first, then evt-old
  // assert eventDetail.value.id === 'evt-new'
});
```

- [ ] **Step 2: Run the composable test to verify it fails**

Run: `npx vitest run src/composables/__tests__/useOutboxOps.test.js`
Expected: FAIL because older detail responses currently overwrite newer selection state

- [ ] **Step 3: Add a detail request sequence guard**

```js
let latestDetailRequestId = 0;
const loadEventDetail = async (eventId) => {
  const requestId = ++latestDetailRequestId;
  ...
  if (requestId !== latestDetailRequestId) return null;
  eventDetail.value = json.data || null;
};
```

- [ ] **Step 4: Make `OutboxOps.vue` ignore stale detail completions**

```js
async function handleSelectEvent(event) {
  selectedEventId.value = event?.id || '';
  await loadEventDetail(event?.id);
}
```

Keep the existing page flow, but ensure the detail panel cannot drift away from `selectedEventId`.

- [ ] **Step 5: Add / update the page behavior test**

```js
it('does not render a stale event detail after rapid selection changes', async () => {
  // simulate selecting evt-1 then evt-2
  // assert replay panel stays bound to evt-2
});
```

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/composables/useOutboxOps.js src/composables/__tests__/useOutboxOps.test.js src/views/OutboxOps.vue src/views/__tests__/OutboxOps.behavior.test.js
git commit -m "fix: guard outbox ops detail selection state"
```

### Task 2: Surface list truncation explicitly in backend contract and UI

**Files:**

- Modify: `functions/repositories/OutboxReplayRepository.js`
- Modify: `functions/repositories/__tests__/OutboxReplayRepository.test.js`
- Modify: `functions/lib/hono/routes/manage/outbox.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`
- Modify: `src/composables/useOutboxOps.js`
- Modify: `src/composables/__tests__/useOutboxOps.test.js`
- Modify: `src/views/OutboxOps.vue`
- Modify: `src/views/__tests__/OutboxOps.behavior.test.js`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`

- [ ] **Step 1: Write the failing repository test for truncation metadata**

```js
it('returns list rows with bounded metadata when result count reaches the limit', async () => {
  const result = await repo.listEvents(filters, { limit: 2 });
  expect(result).toEqual(
    expect.objectContaining({
      items: expect.any(Array),
      limit: 2,
      isTruncated: true,
    })
  );
});
```

- [ ] **Step 2: Run repository / route tests to verify they fail**

Run: `npx vitest run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js`
Expected: FAIL because the current contract only returns a bare array

- [ ] **Step 3: Refactor the repository return shape**

```js
return {
  items: rows.map(...),
  limit,
  isTruncated: rows.length === limit,
};
```

Keep the implementation minimal; do not add full pagination in this task.

- [ ] **Step 4: Update the route response**

```js
return c.json({
  success: true,
  data: result.items,
  meta: {
    limit: result.limit,
    isTruncated: result.isTruncated,
  },
});
```

- [ ] **Step 5: Extend the composable to store list metadata**

```js
const listMeta = ref({ limit: 100, isTruncated: false });
listMeta.value = json.meta || { limit: 100, isTruncated: false };
```

- [ ] **Step 6: Surface truncation warning in the page**

Render an explicit warning near the queue summary:

```vue
<StatusBadge v-if="listMeta.isTruncated" variant="warning" outline>
  {{ t('outboxOps.workspace.truncated', { limit: listMeta.limit }) }}
</StatusBadge>
```

Also add a short helper line explaining that older events are not shown in the current view.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js src/composables/__tests__/useOutboxOps.test.js src/views/__tests__/OutboxOps.behavior.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add functions/repositories/OutboxReplayRepository.js functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/outbox.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js src/composables/useOutboxOps.js src/composables/__tests__/useOutboxOps.test.js src/views/OutboxOps.vue src/views/__tests__/OutboxOps.behavior.test.js src/locales/zh-CN/misc.js src/locales/en/misc.js
git commit -m "fix: expose outbox ops list truncation state"
```

### Task 3: Keep failed global-health refreshes visibly stale

**Files:**

- Modify: `src/views/OutboxOps.vue`
- Modify: `src/views/__tests__/OutboxOps.behavior.test.js`
- Modify: `src/components/outbox/outboxOpsSummary.js`
- Modify: `src/components/outbox/__tests__/outboxOpsSummary.test.js`
- Modify: `src/locales/zh-CN/misc.js`
- Modify: `src/locales/en/misc.js`

- [ ] **Step 1: Write the failing page test for stale-after-failure behavior**

```js
it('keeps a stale health indicator when the background health refresh fails', async () => {
  // prime one successful health snapshot
  // trigger a filtered refresh whose health request returns false
  // assert wrapper.text() contains the stale/failure copy
});
```

- [ ] **Step 2: Run the page test to verify it fails**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js`
Expected: FAIL because stale state currently disappears as soon as loading ends

- [ ] **Step 3: Extend summary state**

```js
return {
  ...metrics,
  isLoading,
  isStale,
  refreshFailed,
};
```

- [ ] **Step 4: Track health refresh failure explicitly in `OutboxOps.vue`**

```js
const healthRefreshFailed = ref(false);
// set true when background refresh returns false
// keep stale indicator visible until the next successful refresh
```

- [ ] **Step 5: Render explicit stale/failure copy**

Example:

```vue
<StatusBadge v-if="healthMetrics.refreshFailed" variant="warning" outline>
  {{ t('outboxOps.summary.globalStale', '全局健康概览为上一次成功快照') }}
</StatusBadge>
```

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/__tests__/outboxOpsSummary.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/views/OutboxOps.vue src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/outboxOpsSummary.js src/components/outbox/__tests__/outboxOpsSummary.test.js src/locales/zh-CN/misc.js src/locales/en/misc.js
git commit -m "fix: preserve stale health state in outbox ops"
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

- [ ] **Step 2: Inspect the final diff**

Run: `git diff --stat`
Expected: only Outbox backend/frontend, locales, tests, and this plan file are included

- [ ] **Step 3: Commit**

```bash
git add functions/repositories/OutboxReplayRepository.js functions/repositories/__tests__/OutboxReplayRepository.test.js functions/lib/hono/routes/manage/outbox.js functions/lib/hono/routes/manage/__tests__/outbox-routes.test.js src/composables/useOutboxOps.js src/composables/__tests__/useOutboxOps.test.js src/views/OutboxOps.vue src/views/__tests__/OutboxOps.behavior.test.js src/components/outbox/outboxOpsSummary.js src/components/outbox/__tests__/outboxOpsSummary.test.js src/locales/zh-CN/misc.js src/locales/en/misc.js docs/superpowers/plans/2026-04-13-outbox-ops-review-remediation-plan.md
git commit -m "fix: close remaining outbox ops review gaps"
```
