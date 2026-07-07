# Backend Logic Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix confirmed backend logic/security defects from the multi-agent backend review.

**Architecture:** Patch trust-boundary and consistency defects at their owning layers: route auth/cache/validation at Hono routes, business invariants in services, projection status in repositories, and numeric primitives in shared utilities. Schema-heavy money correctness is planned separately to avoid an unsafe partial migration.

**Tech Stack:** Cloudflare Pages Functions/Hono, D1 repositories, Vitest, existing Trellis backend specs.

---

### Task 1: AI Tool Authorization

**Files:**
- Modify: `functions/services/AIService.js`
- Modify: `functions/services/ai-tool-orchestrator.js`
- Modify: `functions/utils/ai-tool-executor.js`
- Test: `functions/ai/__tests__/ai-tool-permissions.test.js`

- [x] Write failing tests proving a `stats:read`-only user cannot execute `searchOrders` / `getOrderDetail` / `searchPurchaseOrders`.
- [x] Add a per-tool permission map and enforce it before repository access.
- [x] Filter advertised `AI_TOOLS` so unavailable tools are not offered to the model.
- [x] Run targeted AI tests.

### Task 2: Secret Cache And Typed Boundary Errors

**Files:**
- Modify: `functions/lib/hono/routes/manage/settings.js`
- Modify: `functions/api/utils/file-utils.js`
- Modify: `functions/lib/hono/routes/manage/orders/lines.js`
- Test: existing manage settings/upload/order line route tests or new focused tests.

- [x] Write failing tests for settings `Cache-Control`, invalid upload hash 400, and malformed order-line JSON 400.
- [x] Remove public caching from settings and set no-store/private headers.
- [x] Throw `BadRequestError` for invalid/mismatched upload hash.
- [x] Wrap order line JSON parsing in typed validation.

### Task 3: Share Password Storage And AI Order Files

**Files:**
- Modify: `functions/lib/hono/routes/manage/folders.js`
- Modify: `functions/services/AIService.js`
- Test: folder route tests and AI service/action bridge test.

- [x] Write failing tests proving folder create/update hash passwords with configured pepper.
- [x] Write failing test proving AI order create with `fileIds` calls order file archiving.
- [x] Route folder password writes through `encodeSharePasswordForStorage`.
- [x] Archive AI order files using existing `OrderCreationService.archiveFiles`.

### Task 4: Order Creation And Fulfillment Consistency

**Files:**
- Modify: `functions/services/OrderCreationService.js`
- Modify: `functions/services/order-line-shared.js`
- Modify: `functions/services/OrderLineFulfillmentService/index.js`
- Modify: `functions/services/OrderLineFulfillmentService/statement-builders.js`
- Test: order creation service tests and fulfillment service tests.

- [x] Write failing test for managed order create where demand sync rejects after persistence.
- [x] Write failing test for archived-order race guard in line fulfillment batch construction.
- [x] Write failing test for shipping unreserved quantity while inventory is fully reserved elsewhere.
- [x] Propagate demand-sync failure with partial result or add recoverable side effect behavior.
- [x] Add parent-order active guard to the line update batch before side effects.
- [x] Release only reservations actually consumed by the line.

### Task 5: Product Projection And Space Status

**Files:**
- Modify: `functions/services/ProductProjectionRefreshService.js`
- Modify: `functions/services/ProductCatalogService.js`
- Modify: `functions/lib/hono/routes/manage/products/[id]/index.js`
- Modify: `functions/repositories/SpaceRepository.js`
- Modify: `functions/api/space/[token].js`
- Test: product projection/cache tests and space projection tests.

- [x] Write failing test showing projection refresh failure prevents cache publication in strict mutation paths.
- [x] Write failing test showing archived products do not appear active in space projection.
- [x] Add strict refresh option or strict methods for mutation flows.
- [x] Join/derive `p_status` from `product_projection.active_variant_count` in space SQL.

### Task 6: Small Backend Contracts

**Files:**
- Modify: `functions/api/utils/number.js`
- Modify: product cache URL helpers.
- Modify: product status schema/route validation.
- Test: utility/product cache/product status tests.

- [x] Write failing test for `toNonNegativeInt('1e309')`.
- [x] Include `/api/manage/products/filters` in product invalidation URLs.
- [x] Remove unsupported `draft` status from product status API or implement true round-trip status.
- [x] Run targeted tests.

### Task 7: Money Model Follow-Up Plan

**Files:**
- Create/Modify: `.trellis/tasks/07-07-backend-logic-review-fixes/money-model-follow-up.md`
- Optional Test: characterization tests for current historical price/multi-currency failure.

- [x] Document migration plan for `order_lines.unit_price`, currency, base amount, and exchange rate.
- [x] Document affected repositories: payment, profit, order stats, exports.
- [x] Add characterization tests if low-risk; otherwise leave as explicit follow-up.

### Final Verification

- [x] Run backend module-load smoke:
  `node --no-experimental-strip-types --input-type=module -e "await import('./functions/lib/hono/app.js'); await import('./functions/api/cron/outbox.js')"`
- [x] Run targeted Vitest suites for modified files.
- [ ] Run `pnpm lint` if changes are broad enough. Not run; targeted Vitest, module-load smoke, and `git diff --check` passed.
