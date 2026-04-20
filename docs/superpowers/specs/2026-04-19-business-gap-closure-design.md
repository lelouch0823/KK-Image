# Business Gap Closure Design

## Goal

Close the highest-impact product gaps in the main KK-Image application by delivering:

1. true multi-line order creation/editing
2. business-facing operating reports
3. a reminder center for actionable follow-up
4. proactive audit alerts
5. controlled backup validation and restore workflows

The implementation must preserve the current Cloudflare-native architecture, respect the existing design system, and remain backward-compatible with legacy single-line orders.

## Scope

### In scope

- `src/` admin and sales Web flows
- `functions/lib/hono/routes/*`
- `functions/repositories/*`
- `functions/services/*`
- `migrations/*`
- focused docs updates for new operator flows

### Out of scope

- `minisales/`
- approval engines, billing, quotation systems, or generalized BI builders
- dynamic alert-rule builders
- unrestricted production restore tools

## Product Strategy

Delivery follows the business-first order:

1. Multi-line orders
2. Business stats
3. Reminder center
4. Audit alerts
5. Backup restore

This sequence ensures later phases consume stable order and reporting semantics instead of layering new capabilities over the current single-line compatibility UI.

## Architecture

### Phase 1: Multi-line orders

The order domain already uses `orders + order_lines` as the real fulfillment and procurement model. The missing piece is the write path. The design upgrades order creation/editing UIs to submit a normalized `lines[]` array while preserving compatibility for existing single-line payloads.

Frontend will move from a flat order form to an order-header plus order-line editor structure. Backend order routes will accept either:

- legacy single-line payloads
- new `lines[]` payloads

Repository writes will create/update multiple `order_lines` records when `lines[]` is present, while preserving current compatibility fields on `orders`.

### Phase 2: Business stats

The current stats view is storage and traffic oriented. This phase extends the existing stats projection pipeline to include business KPIs derived from orders, salespersons, procurement, and shortage data. We will reuse `SystemStatsProjectionRefreshService` instead of creating a second reporting stack.

### Phase 3: Reminder center

Reminder generation already exists through cron and outbox-driven notifications. This phase adds a read model and management surface that turns reminders into actionable items. Notifications remain the lightweight bell channel; the reminder center becomes the operator workspace.

### Phase 4: Audit alerts

Audit logs currently support retrospective review. This phase adds rule-based alert generation on top of audit events for a small fixed set of high-risk scenarios. Alert delivery will reuse the existing outbox/event discipline where possible and persist alert records for operator visibility.

### Phase 5: Backup restore

Current backup support stops at create/list/download. This phase adds validate, dry-run, and execute restore steps behind explicit permissions, audit logging, and operator confirmations. The first supported path is controlled local/test restore; production remains intentionally conservative.

## Data Model

### Multi-line orders

- Reuse `order_lines`
- Add no destructive schema changes to existing order tables by default
- If needed, add small compatibility columns only through forward migrations

### Business stats

- Extend existing system stats projection payload
- Avoid heavy live joins in page requests

### Reminder center

- Add reminder read model table to persist reminder lifecycle:
  - `id`
  - `type`
  - `source_type`
  - `source_id`
  - `receiver_type`
  - `receiver_id`
  - `status`
  - `title`
  - `message`
  - `metadata_json`
  - `created_at`
  - `resolved_at`
  - `ignored_at`

### Audit alerts

- Add audit alert table for dedupe and operator visibility:
  - `id`
  - `alert_type`
  - `severity`
  - `dedupe_key`
  - `source_audit_log_id`
  - `status`
  - `payload_json`
  - `created_at`
  - `acknowledged_at`

### Backup restore

- Add restore run tracking table:
  - `id`
  - `backup_key`
  - `mode`
  - `status`
  - `actor_id`
  - `summary_json`
  - `created_at`
  - `completed_at`

## UI Structure

### Multi-line order editor

- `OrderForm.vue` becomes the orchestration container
- `OrderLinesEditor.vue` manages a collection of lines
- `OrderLineEditor.vue` owns a single line's product binding, specs snapshot, quantity, and remark

### Business stats

- Keep `/admin/stats`
- Add new business KPI sections instead of replacing the whole page

### Reminder center

- Add `/admin/reminders`
- Use existing list-shell patterns and semantic status components

### Audit alerts

- Start with surfacing alerts in operator-facing admin UI
- Avoid introducing a separate complex console in the first version

### Backup restore

- Extend the existing Backups settings tab
- Introduce validate/dry-run/execute dialogs

## Error Handling

- Multi-line order requests reject invalid lines atomically
- Reminder actions update reminder state only, never rewrite source business facts
- Alert generation must never recurse into self-alert storms
- Restore execute is blocked when validation fails or the environment is unsupported

## Compatibility

- Legacy single-line order payloads remain supported
- Existing order details continue to return `lines`
- Existing notifications remain functional alongside the new reminder center
- Existing backup create/download flows remain unchanged

## Testing Strategy

- TDD for every new behavior
- Focused unit tests while iterating
- `pnpm test` before handoff when feasible
- `pnpm test:real-api` for cross-route order/reminder/backup flows
- escalate to blackbox profiles only when transport/runtime realism is required

## Rollout

- Ship each phase independently
- Keep migrations forward-only
- Prefer additive contracts
- Do not switch defaults until compatibility layers exist
