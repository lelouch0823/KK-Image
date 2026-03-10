# Full Architecture Cutover Deletion Checklist

This checklist is intentionally expected to fail at the start of the cutover.

Deletion targets locked for removal:

- direct stock SQL writes
- legacy shortage aggregations
- batch product route orchestration
- `stock_quantity` truth ownership
