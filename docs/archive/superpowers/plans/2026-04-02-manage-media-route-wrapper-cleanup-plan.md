# Manage Media Route Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the thin `requireAlbum`, `requireFolder`, and `requireFile` route wrappers so their call sites use `requireEntity` directly.

**Architecture:** Extend the existing route thin-wrapper audit test to statically forbid these three wrapper definitions, then inline `requireEntity(repo.findById(...), onNotFound)` across the affected manage media routes. Use the current albums, folders, and manage files tests as regression coverage.

**Tech Stack:** Hono routes, Vitest, ESLint

---

### Task 1: Expand the Audit Contract

**Files:**

- Modify: `functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit assertions**

Extend the target list so the audit test also forbids:

- `requireAlbum`
- `requireFolder`
- `requireFile`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
```

Expected: FAIL because the three wrapper definitions still exist.

### Task 2: Inline Manage Media Entity Guards

**Files:**

- Modify: `functions/lib/hono/routes/manage/albums.js`
- Modify: `functions/lib/hono/routes/manage/folders.js`
- Modify: `functions/lib/hono/routes/manage/files.js`

- [ ] **Step 1: Remove the three local wrappers**

Replace each `requireAlbum` / `requireFolder` / `requireFile` call with a direct `requireEntity(...)` lookup and delete the helper definitions.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/albums-routes.test.js functions/lib/hono/routes/manage/__tests__/folders-routes.test.js functions/lib/hono/routes/manage/__tests__/files-outbox-routes.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/manage/albums.js functions/lib/hono/routes/manage/folders.js functions/lib/hono/routes/manage/files.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js functions/lib/hono/routes/manage/__tests__/albums-routes.test.js functions/lib/hono/routes/manage/__tests__/folders-routes.test.js functions/lib/hono/routes/manage/__tests__/files-outbox-routes.test.js functions/lib/hono/routes/v1/__tests__/file-folder-audit-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-manage-media-route-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-manage-media-route-wrapper-cleanup-plan.md functions/lib/hono/routes/manage/albums.js functions/lib/hono/routes/manage/folders.js functions/lib/hono/routes/manage/files.js functions/lib/hono/routes/manage/__tests__/route-entity-thin-wrappers.audit.test.js
git commit -m "refactor: remove manage media route wrappers"
```
