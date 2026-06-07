# Operation Audit Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand unified operation audit coverage while introducing route-level audit declarations and automatic route-definition extraction so high-risk write endpoints cannot silently bypass audit requirements.

**Architecture:** Continue route-by-route coverage expansion on the existing audit backbone, but add a declaration layer that makes auditable route intent explicit. Build a route extractor over Hono route definitions, compare discovered write routes against declarations, and keep the system enforceable through tests and scripts.

**Tech Stack:** Cloudflare Pages Functions, Hono, D1, Vue 3, Vitest, OPA policy tooling, Node.js QA scripts

---

### Task 1: Introduce Route Audit Declaration Primitives

**Files:**

- Create: `functions/lib/hono/_shared/audit-route-contract.js`
- Modify: `functions/lib/hono/_shared/audit-helpers.js`
- Test: `test/audit.test.js`

**Step 1: Write the failing test**

Add a test asserting a route audit declaration can be registered and normalized.

```js
it('registers normalized audit route declarations', () => {
  const declaration = declareAuditRoute({
    method: 'PATCH',
    path: '/api/manage/orders/:id/status',
    domain: 'orders',
    action: 'order.status.change',
    severity: 'high',
  });

  expect(declaration.domain).toBe('orders');
  expect(declaration.action).toBe('order.status.change');
});
```

**Step 2: Run test to verify failure**

Run: `pnpm test:unit test/audit.test.js`

Expected: FAIL because declaration helpers do not exist yet

**Step 3: Implement the declaration contract**

Create `functions/lib/hono/_shared/audit-route-contract.js` with:

- `declareAuditRoute()`
- route declaration normalization
- declaration validation
- a minimal registry structure

Keep the first version small and explicit.

**Step 4: Run tests**

Run: `pnpm test:unit test/audit.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/_shared/audit-route-contract.js functions/lib/hono/_shared/audit-helpers.js test/audit.test.js
git commit -m "feat(audit): add route audit declaration contract"
```

### Task 2: Attach Declarations to Remaining Admin High-Risk Routes

**Files:**

- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/routes/manage/notifications.js`
- Modify: `functions/lib/hono/routes/manage/spaces/index.js`
- Modify: `functions/lib/hono/routes/manage/folders.js`
- Modify: `functions/lib/hono/routes/manage/backups.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Test: matching route tests under `functions/lib/hono/routes/manage/__tests__/`

**Step 1: Write failing route tests**

Add route tests asserting:

- each targeted high-risk write route has an audit declaration
- each targeted high-risk write route emits unified audit events on success

**Step 2: Run tests to verify failure**

Run targeted `pnpm test:unit ...` commands for the affected route suites

Expected: FAIL because declarations and/or unified events are not yet present

**Step 3: Implement declarations and minimal route integration**

For each targeted route:

- add explicit route audit declaration metadata
- wire to shared audit pipeline if not already covered

**Step 4: Run tests**

Run targeted route test commands

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/notifications.js functions/lib/hono/routes/manage/spaces/index.js functions/lib/hono/routes/manage/folders.js functions/lib/hono/routes/manage/backups.js functions/lib/hono/routes/manage/ai.js
git commit -m "feat(audit): declare and cover remaining admin high-risk routes"
```

### Task 3: Attach Declarations to Remaining Sales Critical Routes

**Files:**

- Modify: `functions/lib/hono/routes/sales/auth.js`
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/files.js`
- Test: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Test: sales auth tests if added during implementation

**Step 1: Write failing tests**

Add tests for:

- sales login failure/lockout audit coverage
- sales critical write route declarations
- sales critical write route audit event presence

**Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`

Expected: FAIL until declarations and missing coverage are added

**Step 3: Implement minimal sales-side completion**

- declare sales critical routes
- add missing failed/denied/security events
- keep low-value reads out of the primary audit scope

**Step 4: Run tests**

Run the targeted sales route tests

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/sales/auth.js functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/files.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
git commit -m "feat(audit): complete sales critical audit declarations"
```

### Task 4: Build Automatic Write-Route Extraction

**Files:**

- Create: `scripts/qa/extract-write-routes.mjs`
- Modify: `scripts/qa/check-audit-route-coverage.mjs`
- Create: `scripts/qa/__tests__/extract-write-routes.test.mjs` or equivalent Vitest file

**Step 1: Write the failing test**

Add a test proving the extractor can detect write route definitions from representative Hono files.

```js
it('extracts post/put/patch/delete route definitions from source', async () => {
  const routes = await extractWriteRoutesFromFile(
    'functions/lib/hono/routes/manage/orders/detail.js'
  );
  expect(routes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ method: 'PATCH' }),
      expect.objectContaining({ method: 'DELETE' }),
    ])
  );
});
```

**Step 2: Run test to verify failure**

Run the extractor test command

Expected: FAIL because extractor does not exist yet

**Step 3: Implement extractor**

Create `scripts/qa/extract-write-routes.mjs` to:

- parse source text conservatively
- detect `app.post`, `app.put`, `app.patch`, `app.delete`
- collect file-local route definitions
- optionally track route prefix context from known route composition patterns

Keep the first version deterministic and debuggable.

**Step 4: Upgrade the coverage checker**

Modify `scripts/qa/check-audit-route-coverage.mjs` to:

- use extractor output instead of only a hardcoded file list
- compare discovered high-risk write candidates against route declarations

**Step 5: Run tests**

Run extractor tests and the coverage script

Expected: PASS

**Step 6: Commit**

```bash
git add scripts/qa/extract-write-routes.mjs scripts/qa/check-audit-route-coverage.mjs scripts/qa/__tests__/extract-write-routes.test.mjs
git commit -m "test(audit): extract write routes from Hono source"
```

### Task 5: Add Declaration Consistency Checks

**Files:**

- Modify: `scripts/qa/check-audit-route-coverage.mjs`
- Modify: `docs/reviews/2026-03-13-operation-audit-coverage-baseline.md`
- Test: audit coverage script tests or integration tests

**Step 1: Write the failing test**

Add a test or fixture proving a discovered high-risk route without declaration causes a failure.

**Step 2: Run test to verify failure**

Run the checker test suite

Expected: FAIL until missing-declaration detection is implemented

**Step 3: Implement declaration consistency enforcement**

Make the checker fail when:

- a discovered high-risk write route has no declaration
- a declaration exists for a route that no longer exists

**Step 4: Refresh baseline documentation**

Update the baseline review document to reflect:

- declaration-backed coverage
- discovered write-route inventory
- deferred exceptions, if any

**Step 5: Run verification**

Run checker tests and script

Expected: PASS

**Step 6: Commit**

```bash
git add scripts/qa/check-audit-route-coverage.mjs docs/reviews/2026-03-13-operation-audit-coverage-baseline.md
git commit -m "test(audit): enforce route declaration consistency"
```

### Task 6: Update Developer Guidance

**Files:**

- Modify: `docs/developer-guide/authz-policy-system.md`
- Modify: `docs/developer-guide/architecture.md`
- Modify: `docs/reviews/2026-03-13-operation-audit-coverage-baseline.md`

**Step 1: Write a failing documentation check or grep-based reminder**

If the repo has no docs check harness, write a small note-to-self checklist in the plan and verify manually.

**Step 2: Document the route-audit contract**

Explain:

- when a route needs an audit declaration
- how to declare it
- how coverage scripts work
- what counts as high-risk

**Step 3: Verify**

Run: `node scripts/qa/check-audit-route-coverage.mjs`

Expected: PASS after docs are updated and examples align with actual implementation

**Step 4: Commit**

```bash
git add docs/developer-guide/authz-policy-system.md docs/developer-guide/architecture.md docs/reviews/2026-03-13-operation-audit-coverage-baseline.md
git commit -m "docs(audit): document route audit declaration workflow"
```

### Final Verification

Run:

- `pnpm test:unit test/audit.test.js`
- `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- `pnpm authz:policy:test`
- `node scripts/qa/check-audit-route-coverage.mjs`
- extractor test command added in Task 4

Expected:

- all targeted tests pass
- policy tests pass
- coverage script passes
- discovered write-route inventory matches declarations for scoped high-risk routes

### Notes

- Phase 2 should prioritize declaration presence before full semantic enforcement.
- Avoid overbuilding the extractor into a full AST framework unless the lightweight approach proves insufficient.
- Keep route declaration format explicit and boring. Stability is more important than abstraction.
