# V1 File Folder Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local `requireFile` and `requireFolder` wrappers from the v1 file and folder routes so those sites use `requireEntity` directly.

**Architecture:** Extend the existing route thin-wrapper audit test to forbid the two v1 wrapper definitions, then inline `requireEntity` at each current call site while preserving the custom parent-folder error message in `v1/folders.js`. Use the current v1 file/folder route tests as regression coverage.

**Tech Stack:** Hono routes, Vitest, ESLint

---

### Task 1: Expand the Audit Coverage

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit assertions**

Extend the audit target list so it also forbids:
- `functions/lib/hono/routes/v1/files.js` `requireFile`
- `functions/lib/hono/routes/v1/folders.js` `requireFolder`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
```

Expected: FAIL because the two v1 wrapper definitions still exist.

### Task 2: Inline V1 Entity Guards

**Files:**
- Modify: `functions/lib/hono/routes/v1/files.js`
- Modify: `functions/lib/hono/routes/v1/folders.js`

- [ ] **Step 1: Remove the two local wrappers**

Inline `requireEntity(...)` for the current `findById` lookups, preserving `MSG.FOLDER.PARENT_NOT_FOUND` in the parent-folder validation branch.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/v1/files.js functions/lib/hono/routes/v1/folders.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js functions/lib/hono/routes/manage/__tests__/files-outbox-routes.test.js functions/lib/hono/routes/manage/__tests__/folders-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-v1-file-folder-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-v1-file-folder-wrapper-cleanup-plan.md functions/lib/hono/routes/v1/files.js functions/lib/hono/routes/v1/folders.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
git commit -m "refactor: remove v1 file-folder wrappers"
```
