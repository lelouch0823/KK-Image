# Notification Metadata Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the thin `NotificationRepository.parseMetadata` wrapper so notification mapping uses `parseJsonObject` directly.

**Architecture:** Keep `parseJsonObject` as the single JSON-object parsing utility. Add one fallback behavior test plus one audit test, then delete the local wrapper and update `_mapNotification`.

**Tech Stack:** Vitest, repository-layer JSON mapping

---

### Task 1: Lock Thin-Wrapper Removal Contract

**Files:**

- Modify: `functions/repositories/__tests__/notification-repository-legacy-schema.test.js`
- Create: `functions/repositories/__tests__/notification-metadata-wrapper.audit.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests that assert:

- invalid notification metadata still maps to `null`
- `NotificationRepository.js` no longer defines `parseMetadata`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/notification-repository-legacy-schema.test.js functions/repositories/__tests__/notification-metadata-wrapper.audit.test.js
```

Expected: FAIL because the thin wrapper still exists.

### Task 2: Remove the Thin Wrapper

**Files:**

- Modify: `functions/repositories/NotificationRepository.js`

- [ ] **Step 1: Delete parseMetadata and update \_mapNotification**

Use `parseJsonObject(n.metadata, null)` directly in `_mapNotification`.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/notification-repository-legacy-schema.test.js functions/repositories/__tests__/notification-metadata-wrapper.audit.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/repositories/NotificationRepository.js functions/repositories/__tests__/notification-repository-legacy-schema.test.js functions/repositories/__tests__/notification-metadata-wrapper.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/repositories/__tests__/notification-repository-legacy-schema.test.js functions/repositories/__tests__/notification-metadata-wrapper.audit.test.js functions/repositories/__tests__/NotificationRepository.domain-outbox.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-notification-metadata-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-notification-metadata-wrapper-cleanup-plan.md functions/repositories/NotificationRepository.js functions/repositories/__tests__/notification-repository-legacy-schema.test.js functions/repositories/__tests__/notification-metadata-wrapper.audit.test.js
git commit -m "refactor: remove notification metadata wrapper"
```
