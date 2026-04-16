# Backend Architecture Issues

## 2026-04-16 Backend SOTA Architecture Optimization

### Resolved

- Procurement receipt and reversal command success is now determined by source-fact writes, not by downstream projection or notification side effects.
- Procurement command concurrency is now guarded by explicit resource locks on top of `command_idempotency` for both purchase-order-item receipts and receipt reversals.
- Variant demand projection refresh is centralized behind `VariantDemandProjectionRefreshService` for ship, unship, receipt, reversal, and shortage-closure flows.
- Purchase-order arrival semantics remain quantity-closure based: `shipping -> arrived` requires outstanding quantity to reach zero through receipts and/or cancellations.
- Replenishment exposure is driven by outstanding inbound quantity, not by raw purchase quantity or header status alone.

### Guardrails

- Static architecture audits now assert shared resource-lock helper usage and shared demand-projection refresh usage.
- Thin-wrapper audits now prevent procurement services from growing private lock-wrapper helpers again.

### Remaining Risk

- Full real-API regression still depends on a local Workers runtime being started for the worktree before `pnpm test:real-api:full-chain` and `pnpm test:real-api` can be executed.
