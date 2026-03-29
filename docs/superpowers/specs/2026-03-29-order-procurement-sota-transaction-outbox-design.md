# Order Procurement SOTA Transaction + Outbox Design

**Date:** 2026-03-29

## Goal

Upgrade the purchase receipt flow from a guarded multi-write service into a transaction-first domain command with immutable business facts, durable outbox delivery, and replay-safe side effects.

This design is intended to become the long-term correctness boundary for:

- partial receipt
- future receipt reversal
- replayable audit history
- event-driven cache invalidation and audit side effects
- concurrency-safe procurement and inventory projection updates

## Scope

This phase includes:

- transaction-wrapped purchase receipt command execution
- batch receipt commands with all-items-or-nothing atomic semantics
- immutable receipt facts in `purchase_receipts`
- durable domain outbox persisted in the same transaction
- event-driven side effects for audit and cache invalidation
- idempotent receipt command handling
- consumer idempotency and retry tracking

This phase does not include:

- notification consumers
- webhook/integration bus publishing
- full-system outbox adoption outside purchase receipt flows
- replay UI or operator console
- receipt reversal command implementation

## Design Principles

1. Business truth is committed in a single transaction or not committed at all.
2. Outbox stores domain facts, not technical implementation noise.
3. Consumers may repeat; domain facts may not.
4. Receipt history is immutable; future rollback must be modeled as reversal facts.
5. Core domain tables are written only by command handlers, never by outbox consumers.

## Architecture

The design has three layers.

### Command Layer

`OrderProcurementDomainService` remains the receipt command entrypoint. It validates business rules, resolves the affected procurement and order entities, constructs the deterministic write set, and executes the write set as one transaction unit.

One HTTP receipt request with `items[]` is treated as one command:

- one `command_id`
- one `correlation_id`
- one client-supplied `idempotency_key`
- many item-level facts and events

The command scope is exactly one purchase order. In this API shape, the route `poId` is the scope key, and every item in `items[]` must belong to that same purchase order. Any cross-purchase-order mixture is rejected before transaction execution.

The full batch is atomic. If any item in the request fails validation or write execution, the full batch is rolled back.

### Transaction Layer

One receipt command transaction writes all core business consequences:

- `command_idempotency`
- `purchase_order_items`
- `purchase_receipts`
- `order_lines`
- `orders.procurement_status`
- `inventory_balances`
- `inventory_ledger`
- `inventory_events`
- `domain_outbox`
- `outbox_consumer_jobs`
- `purchase_orders.updated_at`

If any write fails, the full command fails and no partial persistence is allowed.

### Outbox Layer

`domain_outbox` stores domain facts emitted by the transaction. Consumers read pending events after commit and drive non-critical side effects such as audit log creation and cache invalidation.

Consumers must never mutate core domain truth tables.

Consumer progress is tracked separately from the immutable outbox rows. A single outbox event may be pending for multiple consumers at the same time.

## Transaction Sequence

The purchase receipt command must execute in the following order.

### 1. Resolve and validate prerequisites

- load `purchase_orders`
- require status in `ordered` or `shipping`
- reserve or load the command idempotency record
- derive `command_id`, `correlation_id`, `causation_id`, and `request_fingerprint`
- for each requested item:
  - require `receivedQty` to be a positive integer
  - load target `purchase_order_item`
  - reject fully received or fully cancelled items
  - compute `remainingReceivable`
  - if `pre_order_id` is absent, skip order-line projection
  - if `pre_order_id` is present and no line matches, fail as domain integrity error
  - if `pre_order_id` is present and multiple lines match, fail as ambiguous linkage error

### 2. Atomically reserve receipt capacity

The first business write for each item is a compare-and-set update on `purchase_order_items`.

The guard must include:

- `id`
- `po_id`
- current `received_qty`
- current `cancelled_qty`
- `remaining >= receivedQty`

If this update does not affect exactly one row, the command fails as a business concurrency conflict and no further writes occur.

### 3. Persist business facts and projections

Within the same transaction:

- insert `purchase_receipts`
- append `inventory_ledger`
- append `inventory_events`
- atomically increment `inventory_balances`
- atomically increment the target `order_line` when one is linked
- re-read affected rows inside the same transaction to obtain authoritative `*_after` values
- aggregate update `orders.procurement_status` from current `order_lines`, not stale pre-transaction snapshots, only for linked orders
- update `purchase_orders.updated_at`

### 4. Persist outbox events

Within the same transaction, append domain facts to `domain_outbox` in business-causal order:

- `purchase_receipt_recorded`
- `inventory_received`
- `order_procurement_progressed` only when a linked `order_line` exists

For a batch command, this sequence repeats per item. Each emitted event stores a deterministic `sequence_in_command` so replay can preserve command-local order.

Within the same transaction, fan out one `outbox_consumer_jobs` row per `(consumer_name, event_id)` pair for the enabled consumers in this phase.

### 5. Finalize command idempotency record

Within the same transaction, update `command_idempotency` with:

- terminal `status`
- `response_json`
- final timestamps

The idempotency row must move from an in-flight state to a committed state atomically with the business facts and outbox rows.

### 6. Commit

Only after a successful commit may the application trigger asynchronous work such as:

- outbox consumer wake-up
- cache invalidation scheduling
- audit scheduling

## Domain Events

The outbox stores only business facts.

### `purchase_receipt_recorded`

- `aggregate_type`: `purchase_receipt`
- `aggregate_id`: `receipt_id`
- payload:
  - `purchase_order_id`
  - `purchase_order_item_id`
  - `product_id`
  - `variant_id`
  - `order_id` nullable
  - `order_line_id` nullable
  - `receipt_id`
  - `received_qty`
  - `purchase_item_received_qty_after`
  - `purchase_item_display_status_after`

### `inventory_received`

- `aggregate_type`: `inventory_event`
- `aggregate_id`: `inventory_event_id`
- payload:
  - `variant_id`
  - `quantity_delta`
  - `purchase_receipt_id`
  - `on_hand_after`
  - `available_after`

### `order_procurement_progressed`

This event is emitted only when the receipt item is linked to an order line.

- `aggregate_type`: `order`
- `aggregate_id`: `order_id`
- payload:
  - `order_line_id`
  - `received_qty_delta`
  - `order_line_received_qty_after`
  - `order_line_display_status_after`
  - `order_procurement_status_after`

## Event Envelope

Every outbox row must include:

- `id`
- `command_id`
- `sequence_in_command`
- `event_type`
- `event_version`
- `aggregate_type`
- `aggregate_id`
- `correlation_id`
- `causation_id`
- `idempotency_key`
- `payload_json`
- `occurred_at`
- `created_at`

## Idempotency Model

### Command Idempotency

Each receipt command must carry an `idempotency_key`.

The system persists command idempotency in a dedicated table keyed by:

- `command_type`
- `scope_key`
- `idempotency_key`

For receipt commands:

- `command_type = purchase_receipt_record`
- `scope_key = purchase_order_id`

The command idempotency row must store:

- `command_id`
- `request_fingerprint`
- `response_json`
- `status`
- timestamps

`command_id` is the stable server-side identifier for one accepted command. In this phase, `correlation_id` is equal to `command_id`. `causation_id` is the upstream trigger id when present, otherwise `command_id`.

Rules:

- the same `purchase_order_id + idempotency_key` identifies the same batch command
- retries with the same semantic request must return the original outcome
- retries with the same key but different payload must be rejected

### Outbox Idempotency

`domain_outbox.idempotency_key` must be unique.

Per-command event keys should be deterministic:

- `<command_id>:<purchase_order_item_id>:purchase_receipt_recorded`
- `<command_id>:<inventory_event_id>:inventory_received`
- `<command_id>:<order_line_id>:order_procurement_progressed`

### Consumer Idempotency

Each consumer must persist a receipt of processed event ids so re-delivery cannot duplicate side effects.

## Data Model

### `command_idempotency`

Purpose: durable command deduplication and replay-safe response recovery.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `command_type TEXT NOT NULL`
- `scope_key TEXT NOT NULL`
- `idempotency_key TEXT NOT NULL`
- `command_id TEXT NOT NULL`
- `request_fingerprint TEXT NOT NULL`
- `response_json TEXT`
- `status TEXT NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

Indexes:

- unique on `(command_type, scope_key, idempotency_key)`

### `domain_outbox`

Purpose: durable event handoff from transaction boundary to asynchronous side-effect handlers.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `command_id TEXT NOT NULL`
- `sequence_in_command INTEGER NOT NULL`
- `event_type TEXT NOT NULL`
- `event_version INTEGER NOT NULL DEFAULT 1`
- `aggregate_type TEXT NOT NULL`
- `aggregate_id TEXT NOT NULL`
- `correlation_id TEXT NOT NULL`
- `causation_id TEXT`
- `idempotency_key TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `occurred_at INTEGER NOT NULL`
- `created_at INTEGER NOT NULL`

Indexes:

- unique on `idempotency_key`
- index on `(created_at, sequence_in_command, id)`
- index on `(aggregate_type, aggregate_id, created_at)`

### `outbox_consumer_jobs`

Purpose: per-consumer delivery state, retry bookkeeping, and crash recovery leases.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `consumer_name TEXT NOT NULL`
- `event_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`
- `available_at INTEGER NOT NULL`
- `leased_by TEXT`
- `leased_until INTEGER`
- `last_error TEXT`
- `processed_at INTEGER`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

Indexes:

- unique on `(consumer_name, event_id)`
- index on `(consumer_name, status, available_at)`
- index on `(consumer_name, leased_until)`

## Consumers

This phase introduces only two consumers.

### Audit Consumer

Transforms domain events into audit log records. It replaces route-local audit triggering for this receipt flow over time.

### Cache Invalidation Consumer

Invalidates purchase-order, order, and goods-overview caches based on event aggregate context.

## Error Handling

Two failure classes are allowed.

### Business rejection

Examples:

- invalid PO status
- receipt quantity exceeds remaining quantity
- zero or negative receipt quantity
- fully received or fully cancelled purchase item
- multi-line order cannot be uniquely resolved
- linked order id exists but no matching order line exists
- conflicting repeated `idempotency_key`
- same idempotency key with mismatched request fingerprint

These return 4xx responses and do not commit a transaction.

### System failure

Examples:

- transaction execution error
- outbox insert failure
- inventory projection write failure

These return 5xx responses and must roll back the full transaction.

## Consumer Retry Policy

Consumers operate on `outbox_consumer_jobs`, not on `domain_outbox` rows directly.

Jobs move through:

- `pending`
- `processing`
- `published`
- `failed`

Claiming work must be atomic:

- select a claimable job where `status in ('pending','failed')` and `available_at <= now`
- or reclaim a stale `processing` job where `leased_until < now`
- set `status = 'processing'`, `leased_by`, and `leased_until`

On failure:

- increment `attempt_count`
- store `last_error`
- set a future `available_at`
- clear or advance the lease

Permanent failures remain queryable in `failed` state for repair or replay.

## Ordering Semantics

`domain_outbox.sequence_in_command` preserves the causal order of facts within one command for replay and debugging.

Live consumers in this phase are intentionally order-insensitive:

- cache invalidation is idempotent and may run in any order
- audit insertion records facts independently and may run in any order

Strict cross-worker ordering is therefore not required for this phase. If a future consumer depends on event order, it must process by `command_id + sequence_in_command`.

## Observability

The design must support traceability by:

- `receipt_id`
- `purchase_order_id`
- `purchase_order_item_id`
- `order_id`
- `order_line_id`
- `correlation_id`
- `event_id`

At minimum, operators and tests must be able to answer:

- which outbox events were emitted by a receipt command
- whether all expected consumer jobs processed them
- which events are stuck in `failed`

## Delivery Liveness

Post-commit event delivery must not rely only on request-thread wake-up.

This phase requires both:

- opportunistic wake-up after successful commit
- a periodic poller / recovery loop that scans `outbox_consumer_jobs`

If the application crashes after commit and before wake-up, the periodic poller is responsible for eventual delivery.

## Reversal Readiness

This phase does not implement receipt reversal, but it must not block it.

Future reversal must:

- create new reversal facts rather than mutating away receipt history
- emit reversal outbox events
- preserve causal linkage to the original receipt event

## Testing Strategy

Implementation must verify four layers.

### Command tests

- concurrent receipt attempts cannot over-apply quantity
- any transactional write failure leaves no partial persistence
- repeated idempotent retries do not duplicate business facts

### Outbox tests

- successful transactions write expected outbox rows
- failed transactions write no outbox rows
- duplicate outbox idempotency keys are rejected

### Consumer tests

- duplicate consumption does not duplicate side effects
- retry transitions work as expected
- failed events remain inspectable and recoverable

### Regression tests

- procurement display models remain consistent
- inventory balances remain correct
- goods overview and purchase-order read models stay aligned

## Recommended Delivery Order

1. add `command_idempotency`, `domain_outbox`, and `outbox_consumer_jobs`
2. refactor receipt flow into transactional write set
3. persist outbox rows and consumer jobs inside the same transaction
4. add audit consumer
5. add cache invalidation consumer
6. add periodic poller / lease recovery
7. extend regression coverage

## Recommendation

Adopt the transaction + immutable fact + durable outbox design now, but keep the consumer set deliberately narrow. This preserves a SOTA core domain boundary without forcing a full-system event bus migration in the same phase.
