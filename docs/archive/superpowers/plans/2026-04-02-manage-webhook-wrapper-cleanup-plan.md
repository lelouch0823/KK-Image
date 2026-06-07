# Manage Webhook Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local `requireWebhook` wrapper from the manage webhook route so not-found guards use `requireEntity` directly.

**Architecture:** Extend the existing route thin-wrapper audit test to forbid `manage/webhooks.js` from defining `requireWebhook`, then inline `requireEntity(repo.getById(id), ...)` at each current call site. Use the existing manage webhook route tests as regression coverage.

**Tech Stack:** Hono routes, Vitest, ESLint

---

### Task 1: Expand the Audit Contract

**Files:**

- Modify: `functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit assertion**

Extend the audit target list so it also forbids:

- `functions/lib/hono/routes/manage/webhooks.js` `requireWebhook`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
```

Expected: FAIL because `requireWebhook` still exists.

### Task 2: Inline Manage Webhook Entity Guards

**Files:**

- Modify: `functions/lib/hono/routes/manage/webhooks.js`

- [ ] **Step 1: Remove the local wrapper**

Replace each `requireWebhook(repo, id)` call with a direct `requireEntity(repo.getById(id), ...)` call and delete the helper.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/manage/webhooks.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/webhooks-routes.test.js functions/lib/hono/routes/v1/__tests__/webhooks-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-manage-webhook-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-manage-webhook-wrapper-cleanup-plan.md functions/lib/hono/routes/manage/webhooks.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
git commit -m "refactor: remove manage webhook wrapper"
```
