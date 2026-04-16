# Operation Audit SOTA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified operation audit backbone that fully covers admin-side P0 write actions, captures denied and failed write attempts, and upgrades the audit center UI to consume structured audit events safely.

**Architecture:** Extend the current `audit_logs` storage into a normalized event ledger, add shared backend helpers that centralize actor/request/target/result handling, then migrate high-risk write routes onto that shared pipeline. Replace the current raw-payload audit UI with a structured investigation console and add explicit coverage tests so new write routes cannot bypass audit requirements.

**Tech Stack:** Cloudflare Pages Functions, Hono, D1, Vue 3, Vitest

---

### Task 1: Define the Unified Audit Schema

**Files:**
- Create: `migrations/0051_unified_operation_audit.sql`
- Modify: `docs/plans/2026-03-13-operation-audit-sota-design.md`
- Test: `test/audit.test.js`

**Step 1: Write the failing test**

Add a new Vitest case in `test/audit.test.js` that asserts the audit read path can return structured audit rows with normalized fields such as `actor_type`, `domain`, `result`, and `changes_json`.

```js
it('normalizes unified audit log fields', async () => {
  const row = {
    actor_type: 'admin',
    domain: 'orders',
    result: 'success',
    changes_json: '{"before":{"status":"pending"},"after":{"status":"done"}}',
  };

  expect(row.actor_type).toBe('admin');
  expect(row.domain).toBe('orders');
  expect(row.result).toBe('success');
  expect(JSON.parse(row.changes_json).after.status).toBe('done');
});
```

**Step 2: Run test to verify current coverage gap**

Run: `pnpm test:unit test/audit.test.js`

Expected: PASS for current tests, but no schema-level proof exists yet for normalized fields. This confirms the missing guardrail before schema work.

**Step 3: Write the migration**

Create `migrations/0051_unified_operation_audit.sql` to:
- add normalized actor/source/result/severity/summary fields to `audit_logs`
- add `changes_json` and `metadata_json`
- preserve backward compatibility for legacy rows
- add indexes for `created_at`, `(domain, created_at DESC)`, `(actor_id, created_at DESC)`, `(target_type, target_id, created_at DESC)`, `(result, severity, created_at DESC)`

**Step 4: Record migration notes**

Update `docs/plans/2026-03-13-operation-audit-sota-design.md` with a short implementation note referencing migration `0051_unified_operation_audit.sql` and the compatibility approach for legacy rows.

**Step 5: Run verification**

Run: `pnpm test:unit test/audit.test.js`

Expected: PASS

**Step 6: Commit**

```bash
git add migrations/0051_unified_operation_audit.sql docs/plans/2026-03-13-operation-audit-sota-design.md test/audit.test.js
git commit -m "feat(audit): add unified operation audit schema"
```

### Task 2: Build Shared Backend Audit Pipeline

**Files:**
- Modify: `functions/api/utils/audit.js`
- Create: `functions/lib/hono/_shared/audit-helpers.js`
- Test: `test/audit.test.js`

**Step 1: Write the failing tests**

Add tests for:
- building a normalized event from request context
- masking sensitive fields
- writing `success`, `denied`, and `failed` audit events

```js
it('builds a normalized audit event', () => {
  const event = buildAuditEvent({
    actor: { type: 'admin', id: 'u1', name: 'Admin', role: 'admin' },
    domain: 'orders',
    action: 'order.update',
    result: 'success',
    target: { type: 'order', id: 'o1', label: 'SO-001' },
  });

  expect(event.actor_type).toBe('admin');
  expect(event.domain).toBe('orders');
  expect(event.target_label).toBe('SO-001');
});

it('masks sensitive fields before persistence', () => {
  const payload = sanitizeAuditData({ password: 'secret', email: 'demo@example.com' });
  expect(payload.password).toBeUndefined();
  expect(payload.email).toMatch(/\*\*\*/);
});
```

**Step 2: Run test to verify failure**

Run: `pnpm test:unit test/audit.test.js`

Expected: FAIL with missing helpers such as `buildAuditEvent` or `sanitizeAuditData`

**Step 3: Implement the shared helpers**

In `functions/api/utils/audit.js` and `functions/lib/hono/_shared/audit-helpers.js`:
- keep low-level persistence in one place
- add `buildAuditEvent()`
- add `sanitizeAuditData()`
- add `recordAuditEvent()`
- add `recordAuditEvents()`
- normalize context from Hono request state
- keep audit writes non-blocking and correlation-friendly

**Step 4: Run tests**

Run: `pnpm test:unit test/audit.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/api/utils/audit.js functions/lib/hono/_shared/audit-helpers.js test/audit.test.js
git commit -m "feat(audit): add shared operation audit pipeline"
```

### Task 3: Capture Authz Denied and Failed Write Events

**Files:**
- Modify: `functions/lib/hono/middleware/auth.js`
- Modify: `functions/lib/hono/middleware/errorHandler.js`
- Test: `functions/lib/hono/middleware/__tests__/auth-opa.test.js`
- Test: `test/audit.test.js`

**Step 1: Write the failing tests**

Add tests that verify:
- denied permission checks emit a `denied` audit event for protected write endpoints
- write-route failures emit a `failed` audit event with safe metadata

```js
it('records denied audit events for protected writes', async () => {
  const res = await app.request('/api/manage/audit-logs', {
    method: 'GET',
    headers: { Authorization: `Bearer ${nonAdminToken}` },
  }, mockEnv);

  expect(res.status).toBe(403);
  expect(mockAuditRecorder).toHaveBeenCalledWith(expect.objectContaining({ result: 'denied' }));
});
```

**Step 2: Run test to verify failure**

Run: `pnpm test:unit functions/lib/hono/middleware/__tests__/auth-opa.test.js test/audit.test.js`

Expected: FAIL because denied and failed audit events are not recorded centrally

**Step 3: Implement the middleware integration**

Update the auth and error middleware to:
- record denied audit events at permission boundaries for write routes
- record failed audit events for protected write operations
- avoid duplicating failure events for the same request
- keep sensitive error details out of frontend responses

**Step 4: Run tests**

Run: `pnpm test:unit functions/lib/hono/middleware/__tests__/auth-opa.test.js test/audit.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/middleware/auth.js functions/lib/hono/middleware/errorHandler.js functions/lib/hono/middleware/__tests__/auth-opa.test.js test/audit.test.js
git commit -m "feat(audit): capture denied and failed write events"
```

### Task 4: Migrate Admin P0 Write Routes to Unified Audit Events

**Files:**
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/customers.js`
- Modify: `functions/lib/hono/routes/manage/files.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/lib/hono/routes/v1/users.js`
- Test: `functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js`
- Test: `functions/lib/hono/routes/manage/__tests__/core-authz-gates.test.js`
- Test: `functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js`
- Test: `test/audit.test.js`

**Step 1: Write the failing route tests**

Add route-level tests for:
- order patch/status/delete/comment audit events
- customer create/update/delete audit events
- file move/delete/batch delete audit events
- product create/update/archive unified audit events
- user update audit events

```js
it('PATCH /api/manage/orders/:id records an order.update audit event', async () => {
  await app.request('/api/manage/orders/o1', {
    method: 'PATCH',
    body: JSON.stringify({ updates: { remark: 'changed' } }),
  }, mockEnv);

  expect(mockAuditRecorder).toHaveBeenCalledWith(expect.objectContaining({
    domain: 'orders',
    action: 'order.update',
    result: 'success',
  }));
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js test/audit.test.js`

Expected: FAIL because routes either do not record unified audit events or still use legacy sparse logging

**Step 3: Implement minimal route migrations**

For each P0 route:
- replace ad hoc `logAudit` calls with shared event helpers
- emit structured `domain`, `action`, `result`, `severity`, `summary`, `target`, `changes_json`, and `metadata_json`
- keep route-local semantics explicit, but push normalization into shared helpers
- do not remove `variant_audit_logs` detail writes yet; add unified product audit alongside them where needed

**Step 4: Run focused tests**

Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js test/audit.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/customers.js functions/lib/hono/routes/manage/files.js functions/lib/hono/routes/manage/products/index.js functions/lib/hono/routes/manage/products/[id].js functions/lib/hono/routes/v1/users.js functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js test/audit.test.js
git commit -m "feat(audit): cover admin p0 write routes with unified events"
```

### Task 5: Upgrade the Audit Logs API and Audit Center UI

**Files:**
- Modify: `functions/lib/hono/routes/manage/audit-logs.js`
- Modify: `src/views/AuditLogs.vue`
- Create: `src/views/__tests__/AuditLogs.behavior.test.js`
- Test: `test/audit.test.js`

**Step 1: Write the failing frontend and API tests**

Add tests that verify:
- API supports structured filters for time, actor, domain, result, severity, and target
- API returns normalized structured fields
- UI renders readable summaries and detail panels safely
- malformed legacy payloads do not crash the view

```js
it('renders legacy malformed payload rows safely', async () => {
  const row = { summary: 'legacy', changes_json: null, metadata_json: '{bad' };
  expect(() => renderAuditDetails(row)).not.toThrow();
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm test:unit src/views/__tests__/AuditLogs.behavior.test.js test/audit.test.js`

Expected: FAIL because the current UI directly parses raw payload in the template and the API only supports limited filtering

**Step 3: Implement API and UI changes**

In `functions/lib/hono/routes/manage/audit-logs.js`:
- validate and bound query params
- add structured filters
- return normalized structured fields

In `src/views/AuditLogs.vue`:
- replace raw payload rendering with safe parsed helpers
- add filters for actor, domain, result, severity, target, and time range
- show summary-first list rows
- add expandable detail view or inline detail section
- fix permission copy to match real permission model or new audit permission model

**Step 4: Run tests**

Run: `pnpm test:unit src/views/__tests__/AuditLogs.behavior.test.js src/views/__tests__/AuditLogs.design-system-migration.test.js test/audit.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/audit-logs.js src/views/AuditLogs.vue src/views/__tests__/AuditLogs.behavior.test.js src/views/__tests__/AuditLogs.design-system-migration.test.js test/audit.test.js
git commit -m "feat(audit): ship structured audit center ui and api"
```

### Task 6: Add Audit Coverage Guardrails

**Files:**
- Create: `scripts/qa/check-audit-route-coverage.mjs`
- Create: `docs/reviews/2026-03-13-operation-audit-coverage-baseline.md`
- Test: `functions/lib/authz/__tests__/route-actions-consistency.test.js`
- Test: `test/audit.test.js`

**Step 1: Write the failing coverage test**

Add a coverage assertion that enumerates P0 write routes and fails if any are missing a unified audit declaration.

```js
it('covers all admin p0 write routes with unified audit declarations', async () => {
  const uncovered = await getUncoveredAuditRoutes();
  expect(uncovered).toEqual([]);
});
```

**Step 2: Run test to verify failure**

Run: `pnpm test:unit test/audit.test.js functions/lib/authz/__tests__/route-actions-consistency.test.js`

Expected: FAIL until the route inventory and audit declarations are aligned

**Step 3: Implement the guardrail**

Create `scripts/qa/check-audit-route-coverage.mjs` to:
- enumerate target admin P0 write routes
- compare them against a maintained audit declaration map
- print uncovered routes and fail non-zero if any are missing

Create `docs/reviews/2026-03-13-operation-audit-coverage-baseline.md` documenting:
- included P0 routes
- deferred P1 routes
- temporary exceptions if any

**Step 4: Run verification**

Run: `pnpm test:unit test/audit.test.js functions/lib/authz/__tests__/route-actions-consistency.test.js`

Run: `node scripts/qa/check-audit-route-coverage.mjs`

Expected: PASS and no uncovered admin P0 routes

**Step 5: Commit**

```bash
git add scripts/qa/check-audit-route-coverage.mjs docs/reviews/2026-03-13-operation-audit-coverage-baseline.md test/audit.test.js functions/lib/authz/__tests__/route-actions-consistency.test.js
git commit -m "test(audit): add unified audit coverage guardrails"
```

### Task 7: Extend to Sales Critical Coverage and Independent Permissions

**Files:**
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/files.js`
- Modify: `functions/lib/hono/routes/sales/auth.js`
- Modify: `policy/metadata.json`
- Modify: `policy/authz.rego`
- Test: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Test: `policy/tests/authz_test.rego`
- Test: `test/audit.test.js`

**Step 1: Write the failing tests**

Add tests that verify:
- sales critical writes emit unified audit events
- auth success/failure for sales flows emit audit events where applicable
- `audit:read` and `audit:export` permissions are recognized by policy

```js
it('allows audit readers without full admin power', async () => {
  const decision = await evaluatePolicy({
    subject: { permissions: ['audit:read'] },
    action: 'audit:read',
  });
  expect(decision.allow).toBe(true);
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js test/audit.test.js`

Run: `pnpm authz:policy:test`

Expected: FAIL because sales audit coverage and independent audit permissions do not exist yet

**Step 3: Implement the minimal extension**

- add sales critical audit events using the shared pipeline
- add `audit:read` and `audit:export` policy metadata and rules
- keep `admin:full` temporarily compatible where needed

**Step 4: Run tests**

Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js test/audit.test.js`

Run: `pnpm authz:policy:test`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/files.js functions/lib/hono/routes/sales/auth.js policy/metadata.json policy/authz.rego functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js test/audit.test.js
git commit -m "feat(audit): extend unified audit to sales critical flows"
```

### Final Verification

Run:
- `pnpm test:unit test/audit.test.js`
- `pnpm test:unit functions/lib/hono/routes/manage/__tests__/order-detail-routes.test.js functions/lib/hono/routes/manage/products/__tests__/variant-audit-routes.test.js functions/lib/hono/middleware/__tests__/auth-opa.test.js src/views/__tests__/AuditLogs.behavior.test.js src/views/__tests__/AuditLogs.design-system-migration.test.js`
- `node scripts/qa/check-audit-route-coverage.mjs`
- `pnpm authz:policy:test`

Expected:
- all targeted tests pass
- no uncovered admin P0 write routes
- audit policy checks pass

### Notes

- Do not remove `variant_audit_logs` in the first implementation batch.
- Do not rely on frontend-generated audit semantics.
- Keep route changes small and test-first.
- Prefer introducing shared audit declarations to prevent future audit drift.
