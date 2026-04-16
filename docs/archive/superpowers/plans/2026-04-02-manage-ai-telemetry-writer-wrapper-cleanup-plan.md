# Manage AI Telemetry Writer Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local `createTelemetryWriter` helper from the manage AI route so telemetry writer creation is inlined at each current call site.

**Architecture:** Add a small static audit test that forbids `manage/ai.js` from defining `createTelemetryWriter`, then inline `createAITelemetryWriter({ db: env?.DB })` into the `/chat` and `/stream` handlers. Use the current manage AI route tests for regression coverage.

**Tech Stack:** Hono routes, Vitest, ESLint

---

### Task 1: Lock the Cleanup Contract

**Files:**
- Create: `functions/lib/hono/routes/manage/__tests__/ai-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test that asserts `functions/lib/hono/routes/manage/ai.js` no longer defines `createTelemetryWriter`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-thin-wrappers.audit.test.js
```

Expected: FAIL because the wrapper still exists.

### Task 2: Inline Telemetry Writer Construction

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`

- [ ] **Step 1: Remove the local wrapper**

Delete `createTelemetryWriter` and inline `createAITelemetryWriter({ db: env?.DB })` at the two current call sites.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/__tests__/ai-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-manage-ai-telemetry-writer-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-manage-ai-telemetry-writer-wrapper-cleanup-plan.md functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/__tests__/ai-thin-wrappers.audit.test.js
git commit -m "refactor: remove ai telemetry writer wrapper"
```
