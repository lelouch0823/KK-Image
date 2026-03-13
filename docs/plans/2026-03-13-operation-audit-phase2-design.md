# Operation Audit Phase 2 Design

**Date:** 2026-03-13

**Goal**

Advance the unified operation audit system from a working backbone into an enforceable engineering system by combining broader route coverage, route-level audit declarations, and automatic route-definition extraction with consistency checks.

## 1. Why Phase 2 Exists

Phase 1 established:
- a unified audit event backbone
- admin P0 route coverage on key modules
- sales critical event coverage on selected flows
- structured audit center consumption
- independent audit permissions

Phase 2 exists because a unified backend is not enough. Without route-level constraints and automated verification, the system will drift again as new write routes are added.

## 2. Phase 2 SOTA Objective

The more SOTA target for Phase 2 is:

Build a durable audit engineering system where high-risk write routes are explicitly declared as auditable units, are automatically discovered from route definitions, and are checked against audit declarations so new route additions cannot silently bypass the unified operation audit model.

This is more SOTA than only adding more audit writes because it turns auditing into a product-wide engineering contract.

## 3. Scope

### In Scope

- Remaining admin high-risk route coverage
- Remaining sales critical route coverage
- Route-level audit declaration model
- Automatic extraction of write route definitions
- Route-definition vs audit-declaration consistency checks
- Updated baseline documents and developer rules

### Out of Scope

- External alerting systems
- Long-term archive/cold storage
- Data lake or warehouse analytics
- Full anomaly detection
- Full semantic verification of all emitted event payload contents

## 4. Product Direction

Phase 2 runs on two tracks in parallel.

### Track A: Coverage Expansion

Continue closing remaining high-risk gaps:
- Admin routes: purchase orders, notifications, spaces, folders, backups, AI mutation routes, any remaining settings write paths
- Sales routes: login failures/lockouts, remaining write mutations, security-relevant file operations

### Track B: Engineering Guardrails

Introduce durable enforcement:
- route-level audit declaration metadata
- route-definition extraction from real Hono route source
- consistency checks between discovered write routes and audit declarations

This dual-track approach is more SOTA than finishing all route coverage first because it reduces future drift while coverage is still expanding.

## 5. Route Audit Declaration Model

Phase 2 should add a declaration layer for high-risk write routes.

Each auditable route should declare:
- `domain`
- `action`
- `severity`
- `targetType`
- `resultModes`
- `summaryBuilder` or summary strategy
- optional `deferredCoverage` or `phase`

The declaration must be close to the route definition, not buried in documentation.

Example conceptual shape:

```js
declareAuditRoute({
  method: 'PATCH',
  path: '/api/manage/orders/:id/status',
  domain: 'orders',
  action: 'order.status.change',
  severity: 'high',
  targetType: 'order',
  resultModes: ['success', 'denied', 'failed'],
});
```

This is more SOTA than a free-form script scan because it gives automated tooling a stable contract.

## 6. Automatic Route Extraction

Phase 2 should upgrade the current route coverage script from a curated file/pattern list into a route-definition extractor.

The extractor should:
- scan relevant Hono route files
- identify `app.post`, `app.put`, `app.patch`, `app.delete`
- resolve route prefixes from `app.route(...)` composition where feasible
- produce a normalized inventory of write endpoints

The first strong version does not need full semantic path flattening for every nested composition. It only needs to be accurate enough to identify candidate high-risk write routes and compare them to declarations.

This staged extractor is more SOTA than a static manual checklist because it is grounded in real route definitions.

## 7. Consistency Rules

Phase 2 should introduce two consistency levels.

### Level 1: Declaration Presence

Every high-risk write route discovered by the extractor must have an audit declaration.

### Level 2: Declaration-to-Implementation Alignment

Every declared route must actually use the unified audit pipeline or an approved wrapper.

Phase 2 should guarantee Level 1 and establish the structure needed for Level 2. It is acceptable if Level 2 begins as a partial enforcement mode.

## 8. Remaining Coverage Targets

### Admin Priority Set

Priority order:
1. `manage/purchase-orders`
2. `manage/notifications`
3. `manage/spaces`
4. `manage/folders`
5. `manage/backups`
6. `manage/ai` mutation routes
7. any remaining settings or user-admin mutations not yet normalized

### Sales Priority Set

Priority order:
1. login failure and lockout audit events
2. remaining order mutation edge paths
3. security-relevant file actions
4. any destructive or privileged sales-side mutations

## 9. API and UI Expectations

Phase 2 should keep the audit center stable while improving audit usefulness:
- add more route-produced summaries
- keep filter model aligned with expanded domains/actions
- avoid schema regressions while new declarations are introduced

Phase 2 is not primarily a UI redesign phase.

## 10. Developer Workflow Impact

After Phase 2, adding a high-risk write route should require:
1. route implementation
2. route audit declaration
3. test proving unified audit integration
4. route extractor / declaration consistency passing

This is the core engineering payoff of the phase.

## 11. Acceptance Criteria

Phase 2 is complete only when:
- remaining targeted admin high-risk routes are covered
- remaining targeted sales critical routes are covered
- high-risk write routes use an explicit audit declaration pattern
- automatic extraction identifies write-route inventory from source code
- extracted routes are checked against declarations
- developer documentation explains the new route-audit contract

## 12. Why This Is More SOTA

This phase is more SOTA because it moves the audit system from:

"a set of implemented audit writes"

to:

"an enforceable engineering standard with route-level declarations and automated consistency checks"

That change is what makes the system durable instead of merely improved.
