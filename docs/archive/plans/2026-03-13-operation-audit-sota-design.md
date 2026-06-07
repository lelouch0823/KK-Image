# Operation Audit SOTA Design

**Date:** 2026-03-13

**Goal**

Build a unified, service-side-first operation audit system that fully covers high-risk admin write operations, gradually absorbs critical sales-side write and security events, and provides structured, searchable, accountable audit evidence across the product.

## 1. Scope

This design covers the product-wide operation audit backbone.

In scope:

- Admin-side high-risk write operations
- Sales-side critical write operations and security events
- Permission denial audit events
- Failed business write attempts
- Unified audit event storage, query API, and admin audit center UI

Out of scope for phase 1:

- Full low-risk read/browse telemetry
- Advanced anomaly detection
- Long-term cold storage pipeline
- External SIEM integration

## 2. Design Principles

1. Service-side source of truth
   Audit events must be produced by backend code, not frontend behavior.

2. Unified event model
   Admin, sales, and system actors must land in one shared event schema.

3. Structured first, JSON second
   Frequently queried dimensions must be explicit columns. JSON is only for detailed context.

4. Non-blocking writes
   Audit persistence must not block the primary business flow. Failures should be logged for repairability.

5. Default-safe data handling
   Sensitive fields must be masked or excluded by default.

6. Searchability over raw log dumping
   The UI must optimize for investigation and accountability, not raw payload browsing.

## 3. SOTA Target

The module is considered SOTA only when it can answer these questions reliably:

- Who performed the action?
- From which client or execution source?
- Against which entity?
- What exactly changed?
- Was the action successful, denied, or failed?
- Why did a force operation or privileged action occur?
- Can the event be found quickly through structured filters?

## 4. Unified Audit Model

The long-term direction is a single unified `audit_logs` table, extended to carry normalized event fields.

Recommended first-class columns:

- `id`
- `actor_type`
- `actor_id`
- `actor_name`
- `actor_role`
- `source_app`
- `request_id`
- `trace_id`
- `domain`
- `action`
- `result`
- `severity`
- `target_type`
- `target_id`
- `target_label`
- `summary`
- `changes_json`
- `metadata_json`
- `ip_address`
- `user_agent`
- `created_at`

Notes:

- Existing `user_id` should be replaced or deprecated in favor of the normalized actor fields.
- `payload` should be replaced by `changes_json` and `metadata_json` to avoid ambiguous semantics.

## 5. Variant Audit Relationship

The more SOTA long-term architecture is a unified operation audit ledger with optional domain-deep detail stores.

Recommended path:

1. Keep `variant_audit_logs` temporarily as product-domain fine-grained detail.
2. Add unified operation audit events for product actions into `audit_logs`.
3. Expose product-domain detail from the unified audit event when needed.
4. Decide later whether `variant_audit_logs` should be fully merged or remain a supporting detail table.

This is more SOTA than keeping separate, unrelated audit systems because it preserves one product-wide accountability plane while avoiding a risky immediate migration.

## 6. Coverage Model

### P0 Mandatory Audit Coverage

Must be present before the module is considered complete for admin-side operations:

- Auth success/failure/logout
- Permission denied events
- User and permission changes
- Order create/update/delete
- Order status changes, especially force transitions
- Product create/update/archive
- Customer create/update/delete
- File delete/batch delete/move
- Settings changes
- Batch import/export execution

### P1 Required Follow-up Coverage

Should be added once the backbone is stable:

- Order comments and note mutations
- Bind/unbind actions
- Purchase-order critical mutations
- Backup creation/deletion
- AI action execution submissions
- Inventory-adjustment operations

### P2 Not in Primary Operation Audit

Should stay outside the primary audit system unless requirements change:

- Page visits
- Pagination
- Simple filter changes
- Passive reads

This risk-tiered scope is more SOTA than logging every request because it keeps the audit dataset actionable.

## 7. Event Result and Severity

Every audit event must include:

- `result`: `success` | `denied` | `failed`
- `severity`: `normal` | `high` | `critical`

Examples:

- Order force status change: `success` + `high`
- Permission change: `success` + `critical`
- Forbidden request to admin route: `denied` + `high`
- Batch delete: `success` + `high`

## 8. Backend Architecture

The more SOTA backend design is a shared audit pipeline, not scattered route-local logging.

### 8.1 Core Components

1. Audit event builder
   Normalizes actor, request, target, result, and source context.

2. Audit sanitizer
   Removes or masks sensitive values before persistence.

3. Audit recorder
   Persists one or many events asynchronously and consistently.

4. Audit helpers for write routes
   Allow business routes to describe the semantic action without hand-assembling raw audit SQL.

5. Authz denial recorder
   Captures denied access at the permission boundary.

6. Failure recorder
   Captures failed write attempts through explicit wrapping or shared error handling.

### 8.2 Production Rules

- Success events are written after business mutation succeeds.
- Denied events are written at the authz boundary.
- Failed events are written when a protected write operation throws or returns a business failure.
- Audit write failure never breaks the main request, but must emit a backend error log with request correlation.

## 9. Frontend Architecture

The more SOTA frontend is an investigation console, not a raw payload table.

### 9.1 Audit Center Requirements

List view must support filters for:

- Time range
- Actor type
- Actor identity
- Source app
- Domain
- Action
- Target type
- Target id
- Result
- Severity

### 9.2 Presentation

Each row should present:

- Timestamp
- Actor
- Source
- Domain/action
- Human-readable summary
- Result
- Severity

Detail panel should show:

- Target entity
- Structured before/after diff
- Metadata
- Failure or denial reason
- Request context

### 9.3 Rendering Rules

- Frontend must never `JSON.parse` arbitrary raw text inside templates.
- API responses should return already structured JSON fields.
- Rendering must be resilient to null, malformed legacy data, and partially migrated records.

## 10. Data Access and Performance

Audit query patterns should drive schema and indexes.

Primary query patterns:

- Latest events by time
- Events by domain over time
- Events by actor over time
- Events by target over time
- Events by result/severity over time

Recommended index direction:

- Time index on `created_at DESC`
- Composite indexes for `(domain, created_at DESC)`, `(actor_id, created_at DESC)`, `(target_type, target_id, created_at DESC)`, `(result, severity, created_at DESC)`

Page size must be bounded server-side.

## 11. Security and Privacy

The more SOTA design is default-redaction.

Sensitive fields that must never be stored raw:

- Passwords
- Tokens
- Cookies
- Secrets
- Full internal auth headers
- Full personal identifiers when not needed for accountability

Recommended policy:

- Explicit allowlist for readable fields
- Masking helper for partial visibility fields such as phone or email
- Internal error code instead of raw stack in user-facing audit detail

## 12. Permissions

Long-term SOTA target:

- `audit:read`
- `audit:export`
- `audit:admin`

Phase 1 may temporarily keep `admin:full` as the gate, but the design should prepare for independent audit permissions. This is more SOTA than permanently coupling audit access to full admin power.

## 13. Testing Strategy

This module is not complete without explicit audit verification.

Required test layers:

- Unit tests for event building, sanitization, and summary generation
- Route tests for success/denied/failed event recording
- UI tests for filters, details, and malformed legacy payload tolerance
- Coverage audit to ensure every P0 write route is mapped to a unified audit event

The coverage audit is a key SOTA requirement. It prevents future write routes from being added without audit support.

## 14. Migration Strategy

### Phase A: Backbone

- Extend schema
- Introduce unified audit event APIs
- Add denial/failure recording hooks

### Phase B: Admin P0 coverage

- Migrate all admin high-risk write routes
- Replace route-local ad hoc logging with shared helpers

### Phase C: Sales critical coverage

- Add sales-side write and auth/security events

### Phase D: UI completion

- Replace legacy audit view with structured investigation UI
- Add advanced filters and detail panel

### Phase E: Hardening

- Independent audit permissions
- Export
- Retention and archival policy

## 15. Acceptance Criteria

The module is complete only when:

- All admin P0 write routes emit unified audit events
- Sales critical write and security events emit unified audit events
- Denied and failed writes are visible in audit queries
- Frontend supports structured filtering and readable detail inspection
- Sensitive data is masked or excluded
- Automated tests prove both event coverage and rendering resilience

## 16. Explicit Current-State Gaps

The current implementation falls short because:

- Unified operation audit is only partially written by a few routes
- Product variant auditing is stored separately and not visible in the main audit center
- The current UI only supports limited filtering
- Raw payload parsing in the template is unsafe
- Audit permissions are not independently modeled
- Test coverage does not prove route-level audit completeness

## 17. Recommended Implementation Order

The more SOTA order is:

1. Define and migrate the unified schema
2. Build the shared backend audit pipeline
3. Add P0 admin route coverage
4. Add authz denial and failure capture
5. Upgrade the audit center UI
6. Add sales critical coverage
7. Add independent audit permissions and export

This order is more SOTA than starting from the UI because it builds trusted audit production before audit consumption.
