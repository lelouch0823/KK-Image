# Procurement Command Boundaries

## Source Facts vs Derived Work

Procurement receipt and reversal commands now treat the following writes as source facts:

- `purchase_order_items.received_qty` / rollback of that quantity
- `purchase_receipts` / `purchase_receipt_reversals`
- inventory mutation records that represent the receipt or reversal fact itself

The following work is treated as derived and must not decide command success after source facts commit:

- linked `order_lines` procurement projection refresh
- linked order procurement-status projection refresh
- outbox fan-out to notification, webhook, or cache consumers
- variant demand projection refresh

This keeps command success aligned with the durable facts that define procurement state.

## Resource-Level Concurrency

Procurement commands now acquire explicit resource locks through `order-procurement-resource-locks.js`, backed by `command_idempotency`.

- Receipt recording locks each affected `purchase_order_item`
- Receipt reversal locks the `original_receipt_id`
- Locks are released on both success-path finalize batches and error cleanup paths

The services no longer hardcode lock-record creation details internally.

## Purchase-Order Lifecycle Semantics

- `ordered -> shipping` remains a header transition
- `shipping -> arrived` is allowed only when outstanding quantity is zero
- outstanding quantity is defined as `ordered - received - cancelled`
- reversals can move a purchase order from `arrived` back to `shipping` when they reopen outstanding quantity

This makes purchase-order lifecycle semantics quantity-driven instead of purely header-driven.
