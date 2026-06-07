# V1 Cache URL Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the v1 cache URL combination wrappers so `DomainOutboxConsumers` composes the underlying cache URL helpers directly.

**Architecture:** Add a static audit test that forbids `cache-urls.js` from exporting `getV1FolderAndShareCacheUrls` and `getV1FileAndFolderCacheUrls`, then inline the combinations inside `DomainOutboxConsumers`. Update tests to validate behavior through the real consumer paths and retain direct tests only for the lower-level helpers that remain exported.

**Tech Stack:** Vitest, ESLint, v1 cache URL helpers, domain outbox consumers

---

### Task 1: Lock the Wrapper Removal Contract

**Files:**

- Create: `functions/lib/hono/routes/v1/__tests__/cache-urls-thin-wrappers.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/lib/hono/routes/v1/cache-urls.js` no longer defines `getV1FolderAndShareCacheUrls` or `getV1FileAndFolderCacheUrls`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/v1/__tests__/cache-urls-thin-wrappers.audit.test.js
```

Expected: FAIL because both wrappers still exist.

### Task 2: Inline the Cache URL Combinations

**Files:**

- Modify: `functions/lib/hono/routes/v1/cache-urls.js`
- Modify: `functions/services/DomainOutboxConsumers.js`
- Modify: `functions/lib/hono/routes/v1/__tests__/cache-urls.test.js`
- Modify: `functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js`

- [ ] **Step 1: Remove wrappers and update tests**

Delete the two wrapper exports, compose the remaining helpers directly in `DomainOutboxConsumers`, drop direct tests for the removed exports, and add a v1 folder cache invalidation assertion that covers share URLs.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/v1/__tests__/cache-urls-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/cache-urls.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/lib/hono/routes/v1/cache-urls.js functions/services/DomainOutboxConsumers.js functions/lib/hono/routes/v1/__tests__/cache-urls-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/cache-urls.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/lib/hono/routes/v1/__tests__/cache-urls-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/cache-urls.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-v1-cache-url-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-v1-cache-url-wrapper-cleanup-plan.md functions/lib/hono/routes/v1/cache-urls.js functions/services/DomainOutboxConsumers.js functions/lib/hono/routes/v1/__tests__/cache-urls-thin-wrappers.audit.test.js functions/lib/hono/routes/v1/__tests__/cache-urls.test.js functions/services/__tests__/DomainOutboxConsumers.audit-cache.test.js
git commit -m "refactor: remove v1 cache url wrappers"
```
