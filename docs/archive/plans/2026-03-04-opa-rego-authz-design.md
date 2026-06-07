# OPA/Rego Authz Refactor Design

## Status

- 状态: Completed
- 完成日期: 2026-03-04
- 落地提交:
  - `914375d` Merge branch 'feat/opa-rego-authz'
  - `79723ec` fix(test): stabilize vitest runner and migration prefix imports

## Background

Backend authorization currently has duplicated and diverging definitions:

1. Runtime RBAC check uses `functions/api/utils/permissions.js`.
2. Permissions API response uses `functions/lib/hono/routes/v1/permissions.js` + `MSG.PERMISSIONS`.
3. Permission display labels are maintained separately in `functions/api/utils/messages.js`.

This causes model drift between what backend enforces and what API reports.

## Goals

1. Introduce one authoritative policy source for authorization decisions.
2. Use OPA/Rego as policy engine and execute compiled WASM in Functions runtime.
3. Remove duplicated hand-written role/permission definitions.
4. Keep business authorization strict with fail-closed behavior.

## Non-Goals

1. No shadow mode rollout.
2. No policy engine sidecar/network PDP.
3. No UI redesign work.

## Decisions

1. Policy engine: OPA/Rego, compiled to WASM at build time.
2. Enforcement mode: fail-closed.
3. Rollout mode: direct cutover (no dual decision path).
4. Safety valve: environment switch `AUTHZ_ENGINE=opa|legacy` for emergency rollback.

## Target Architecture

1. `policy/` stores Rego policy, role mapping, and policy tests.
2. Build step compiles policy bundle to WASM artifact for runtime loading.
3. New backend authz adapter evaluates `(subject, action, resource, context)` against OPA.
4. `requirePermission()` in Hono middleware delegates to adapter.
5. Permissions route response is generated from the same policy metadata source.

## Data Contract

Input:

```json
{
  "subject": {
    "id": "u1",
    "type": "user",
    "role": "manager",
    "permissions": ["files:read"]
  },
  "action": "files:delete",
  "resource": {
    "type": "api_route",
    "path": "/api/manage/files/:id"
  },
  "context": {
    "method": "DELETE"
  }
}
```

Output:

```json
{
  "allow": true,
  "reason": "role_allows_action"
}
```

## Migration Plan

1. Add OPA policy infrastructure and tests.
2. Add runtime authz adapter and wire middleware to OPA path.
3. Keep legacy implementation behind `AUTHZ_ENGINE=legacy`.
4. Switch default to OPA.
5. Remove duplicated permission definitions after cutover validation.

## Verification

1. Unit tests: policy decisions for admin/manager/sales/viewer/user.
2. Contract tests: `permissions` API output keys must match policy action universe.
3. Integration tests: protected routes return expected status for representative roles.
4. CI gate: policy compile + policy tests + migration duplicate-prefix check.

## Risks And Mitigations

1. Risk: policy/runtime mismatch.
   Mitigation: generated metadata and contract tests.
2. Risk: OPA runtime failure.
   Mitigation: fail-closed + explicit operational error code + emergency legacy switch.
3. Risk: large refactor touches auth hot path.
   Mitigation: phased commits and route-focused regression tests.
