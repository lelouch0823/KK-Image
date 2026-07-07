# State Management

> How state is managed in this project.

---

## Overview

<!--
Document your project's state management conventions here.

Questions to answer:
- What state management solution do you use?
- How is local vs global state decided?
- How do you handle server state?
- What are the patterns for derived state?
-->

(To be filled by the team)

---

## State Categories

<!-- Local state, global state, server state, URL state -->

(To be filled by the team)

---

## When to Use Global State

<!-- Criteria for promoting state to global -->

(To be filled by the team)

---

## Server State

<!-- How server data is cached and synchronized -->

(To be filled by the team)

---

## Common Mistakes

<!-- State management mistakes your team has made -->

(To be filled by the team)

---

## Convention: Global Polling Has One Owner

**What**: Shared frontend polling state must track which composable instance started the interval. Passive consumers may read shared state, but they must not stop a poller they did not start.

**Why**: Composables such as `useNotifications()` are used by long-lived owners and transient readers. If every caller registers `onScopeDispose(stopPolling)`, unmounting a passive reader can clear the shared interval while the owning header or sales portal is still mounted.

**Required behavior**:

```ts
const ownerId = Symbol('poll-owner');

const startPolling = () => {
  if (pollInterval) return;
  pollingOwner = ownerId;
  pollInterval = setInterval(fetchLatest, interval);
};

const stopPolling = () => {
  if (pollingOwner !== ownerId) return;
  stopActivePolling();
};
```

**Checklist**:

- Store owner identity when a global interval is created.
- Scope-dispose only the interval owned by that composable instance.
- Keep internal forced stops for authorization failures or mode resets when the global poller must stop regardless of owner.
- Add a regression test where a transient consumer unmounts while the owner-started interval continues polling.
