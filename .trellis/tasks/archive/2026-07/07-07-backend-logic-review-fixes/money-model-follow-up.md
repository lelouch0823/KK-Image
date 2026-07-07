# Money Model Follow-Up

## Status

Deferred from the backend logic review fixes. Do not partially migrate money fields in this task.

## Confirmed Risk

Order and profit flows still depend on `order_lines.unit_price` without a complete currency/base-amount model. A safe fix requires schema, repository, projection, export, and historical-data migration work together.

## Required Migration Scope

- Add explicit order-line money fields for display currency amount, base currency amount, exchange rate, and currency code.
- Backfill historical `order_lines.unit_price` rows with a documented default currency and exchange rate.
- Define rounding rules for line totals, order totals, payments, profit, and exports.
- Keep historical order prices stable when product prices or currency settings change later.

## Affected Backend Areas

- `functions/repositories/PaymentRepository.js`
- `functions/repositories/ProfitRepository.js`
- `functions/repositories/OrderStatsRepository.js`
- order creation and order line mutation services
- order export/reporting paths
- dashboard and sales/order summary projections that aggregate revenue or profit

## Verification Required

- Characterization tests for current single-currency totals before migration.
- Migration tests for old rows with only `unit_price`.
- Cross-currency order creation tests covering display amount, base amount, exchange rate, and rounding.
- Export/report tests proving historical totals remain unchanged.
