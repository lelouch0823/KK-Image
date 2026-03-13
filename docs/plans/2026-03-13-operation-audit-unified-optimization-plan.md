# Operation Audit Unified Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the operation audit module into a durable, product-wide engineering system with complete write-route coverage, stronger static and behavioral guardrails, and clear staged follow-through for runtime semantics and operational capabilities.

**Architecture:** Keep the existing unified audit backbone and route declaration model, but organize all remaining work into a single prioritized roadmap. Phase `P0` finishes route coverage and behavior-level confidence, `P1` upgrades static consistency into runtime semantics and stronger automation, and `P2` adds operational maturity such as export, alerting, and retention workflows.

**Tech Stack:** Cloudflare Pages Functions, Hono, D1, Vue 3, Vitest, Node.js QA scripts, OPA policy tooling

---

## 1. Current State

Already completed:
- Unified audit schema and shared audit pipeline
- `success` / `denied` / `failed` event support
- Structured audit center UI and API
- Independent audit permissions (`audit:read`, `audit:export`)
- Route audit declarations on major admin, sales, and `v1` write surfaces
- Write-route extraction from the route tree
- Coverage script with declaration presence and visible implementation consistency checks

Current validated guardrails:
- Route discovery from `manage/`, `sales/`, and `v1/`
- Declaration existence checks
- Stale declaration checks
- Visible `action` / `domain` / `targetType` / `severity` consistency against `scheduleAuditEvent(...)`

Current verified status:
- `node scripts/qa/check-audit-route-coverage.mjs` passes
- targeted audit, route, authz, and QA tests pass

## 2. Remaining Problem Statement

The module is now structurally strong, but not fully finished as a long-term audit platform. Remaining risk clusters are:

1. Static consistency is stronger, but runtime semantic consistency is not yet enforced.
2. Several newly covered route groups still rely more on declaration/coverage checks than behavior-specific audit assertions.
3. The audit system still mixes “main operation ledger” concerns with some legacy or migration-era assumptions.
4. Operational capabilities such as export workflows, retention strategy, and escalation hooks are still light.

That means the audit system is already credible, but not yet maximally robust.

## 3. Phase Structure

This roadmap is intentionally split into `P0`, `P1`, and `P2`.

### `P0`
Short-term hardening and completion.
Focus: finish coverage, add behavior-level confidence, remove obvious migration debt.

### `P1`
Mid-term engineering rigor.
Focus: move from static visible consistency to runtime semantic consistency and stronger generated verification.

### `P2`
Operational maturity.
Focus: export, alerting, retention, observability, and governance.

## 4. `P0` Plan

`P0` is the highest-value next phase. It is what turns the current system from “strongly improved” into “confidently maintainable”.

### Task Group P0.1: Finish behavior-level audit assertions on newly covered modules

**Target modules:**
- `functions/lib/hono/routes/manage/albums.js`
- `functions/lib/hono/routes/manage/upload.js`
- `functions/lib/hono/routes/manage/trash.js`
- `functions/lib/hono/routes/manage/notifications.js`
- `functions/lib/hono/routes/manage/folders.js`
- `functions/lib/hono/routes/manage/backups.js`
- `functions/lib/hono/routes/manage/spaces/subspaces.js`
- `functions/lib/hono/routes/manage/tags.js`
- `functions/lib/hono/routes/manage/orders/create.js`
- `functions/lib/hono/routes/manage/products/batch.js`
- `functions/lib/hono/routes/sales/notifications.js`
- `functions/lib/hono/routes/sales/profile.js`
- selected `v1/*` write routes

**Work:**
1. Add focused route tests asserting the expected audit `action` is scheduled or recorded.
2. Add at least one positive assertion per newly covered write surface.
3. Add at least one high-risk destructive assertion for delete/empty/archive style routes.

**Why:**
The current guardrail proves declaration and visible implementation alignment, but these route groups still need more direct regression tests.

### Task Group P0.2: Remove remaining migration-era duplication where unified audit already exists

**Focus:**
- Search for remaining dual-write or legacy audit patterns
- Remove legacy paths when the unified route-level event already fully supersedes them

**Work:**
1. Audit all `logAudit(...)` call sites still present in active routes.
2. For each call site, decide:
   - keep temporarily with documented reason, or
   - remove in favor of unified `scheduleAuditEvent(...)`
3. Update tests to ensure no behavior loss.

### Task Group P0.3: Normalize excluded-route policy

**Current issue:**
Excluded POST routes are currently handled through a script-level ignore set.

**Work:**
1. Introduce a documented classification for non-mutating POST routes.
2. Tag or register those exclusions explicitly so they are not “magic strings in one script”.
3. Document why each exclusion is outside the main operation audit ledger.

**Goal:**
Make exclusions explainable and reviewable, not just convenient.

### Task Group P0.4: Expand coverage baseline and route inventory docs

**Work:**
1. Update the baseline review document with all currently discovered write-route groups.
2. Distinguish:
   - covered mutating routes
   - intentionally excluded non-mutating POST routes
   - deferred runtime-semantic checks

## 5. `P1` Plan

`P1` is where the system becomes genuinely SOTA in engineering quality, not just broad in coverage.

### Task Group P1.1: Runtime semantic consistency verification

**Problem:**
Current checks verify visible literals in source, not actual emitted runtime event shape.

**Work:**
1. Introduce a shared test harness that captures scheduled audit events at route execution time.
2. Assert for selected route groups that emitted events match declaration fields:
   - `action`
   - `domain`
   - `targetType`
   - `severity`
   - expected `result`
3. Add representative tests for:
   - admin create/update/delete
   - batch mutation
   - denied write
   - failed write
   - sales critical write

**Goal:**
Move from “visible source alignment” to “runtime emitted event alignment”.

### Task Group P1.2: Declaration schema enrichment

**Possible additions:**
- `resultModes`
- `phase`
- `excludedReason`
- `runtimeAssertionLevel`
- `highRisk` boolean

**Why:**
The richer the declaration contract, the less special-casing the scripts need.

### Task Group P1.3: Route extraction enrichment

**Current extractor handles:**
- `.post/.put/.patch/.delete`
- `.on([PUT,PATCH], ...)`

**Next improvements:**
1. Capture nested route composition metadata where practical.
2. Attach origin file and local path grouping for better reporting.
3. Emit machine-readable JSON reports for CI artifacts.

### Task Group P1.4: CI integration hardening

**Work:**
1. Make coverage and consistency scripts first-class CI checks.
2. Produce more actionable violation output:
   - route
   - file
   - missing declaration
   - missing runtime match
3. Ensure new route additions fail fast in CI.

## 6. `P2` Plan

`P2` is about operating the audit system as a platform.

### Task Group P2.1: Export workflows

**Work:**
1. Add audited export API paths guarded by `audit:export`
2. Support filtered export rather than raw table dump
3. Ensure export output respects redaction rules

### Task Group P2.2: Alerting and escalation hooks

**Focus events:**
- repeated denied access
- force state transitions
- destructive batch deletes
- repeated login failures / lockouts

**Goal:**
Surface high-risk audit patterns proactively, not just retrospectively.

### Task Group P2.3: Retention and archival strategy

**Work:**
1. Define retention classes by severity/domain
2. Add retention documentation and maintenance commands
3. Optionally prepare archive/export to external storage

### Task Group P2.4: Audit operations playbook

**Documentation should cover:**
- how to investigate incidents
- how to use audit filters
- how to interpret denied vs failed vs success events
- how to review exclusions

## 7. Recommended Execution Order

Recommended order:

1. `P0.1` behavior-level route assertions
2. `P0.2` remove remaining migration duplication
3. `P0.3` normalize exclusions
4. `P0.4` baseline/documentation refresh
5. `P1.1` runtime semantic consistency
6. `P1.2` declaration schema enrichment
7. `P1.3` extractor enrichment
8. `P1.4` CI hardening
9. `P2.*` operational maturity work

This order is preferred because it first converts current structural coverage into trusted route behavior, then upgrades the static system into a runtime-enforced system, then adds operational extras.

## 8. Acceptance Criteria by Phase

### `P0` Done When
- all currently covered route groups have meaningful route-level audit behavior assertions
- migration-era duplicate write paths are either removed or explicitly justified
- excluded non-mutating POST routes are documented and normalized
- coverage baseline reflects current route inventory accurately

### `P1` Done When
- selected route groups prove runtime emitted event alignment with declarations
- declarations carry enough metadata to support richer automation
- route extraction and consistency checks are CI-grade and stable

### `P2` Done When
- audited export flow exists
- high-risk alerting hooks are defined or implemented
- retention and operational guidance exist and are usable

## 9. Risks and Tradeoffs

1. Runtime semantic checks will cost more test setup complexity than static grep-based checks.
2. Over-enriching declarations too early could make route authoring noisy.
3. Export/retention work can sprawl if attempted before `P0` and `P1` are stable.

Recommendation:
- keep `P0` pragmatic
- make `P1` the core engineering milestone
- treat `P2` as platform maturity, not immediate blocker

## 10. Suggested Deliverables

To close this roadmap cleanly, create these follow-up artifacts when implementation starts:

- `docs/plans/YYYY-MM-DD-operation-audit-p0-hardening-plan.md`
- `docs/plans/YYYY-MM-DD-operation-audit-runtime-consistency-plan.md`
- updated audit coverage baseline review
- CI script/report documentation

## 11. Bottom Line

The operation audit module is no longer at the “basic feature” stage.  
The correct next move is not broad rewriting. It is staged hardening:

- `P0`: trust the route behavior
- `P1`: trust the runtime semantics
- `P2`: trust the system operationally

That is the highest-signal, most defensible optimization path from the current state.
