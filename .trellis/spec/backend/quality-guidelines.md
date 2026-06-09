# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

---

## Scenario: Cross-Layer Security And Partial Update Fixes

### 1. Scope / Trigger

- Trigger: Backend changes that alter storage format, public API verification, partial update behavior, or infrastructure streaming behavior.
- Applies to: public share passwords, webhook configuration updates, and backup export/upload paths.
- Reason: These bugs happen at layer boundaries: write path changes without read-path support, partial schemas wired to full-overwrite repositories, and "streaming" code that still buffers internally.

### 2. Signatures

- Share password storage helper: `encodeSharePasswordForStorage(password, pepper) -> Promise<string|null>`.
- Share password verification helper: `verifySharePassword(password, storedPassword, pepper) -> Promise<boolean>`.
- Pepper source: `env.PASSWORD_PEPPER || env.JWT_SECRET`.
- Webhook update repository: `WebhookRepository.update(id, partialOrFullUpdate) -> Promise<Webhook|null>`.
- Backup export: `performStreamingBackup(env) -> Promise<{ filename, key, tables, originalSize, compressedSize }>`.

### 3. Contracts

- Public share passwords stored through management routes must be PBKDF2 records when a pepper exists.
- Public share passwords must still verify historical plaintext records.
- Public share password verification must support PBKDF2 and legacy `sha256(password + pepper)` records.
- Webhook update bodies are partial. Omitted fields must preserve existing persisted values, including hidden `secret`.
- To clear a webhook secret, callers must send a present empty/falsey `secret`; omission means preserve.
- Backup export must upload a `ReadableStream` through `CompressionStream` to R2 instead of materializing the full compressed payload as `ArrayBuffer`.

### 4. Validation & Error Matrix

- Missing share password input -> existing public share routes return password-required validation errors.
- Wrong share password -> public share routes record a password failure and return password error.
- PBKDF2 stored password without configured pepper -> verification fails; do not compare hash-looking records as plaintext.
- Webhook partial update with omitted `url/events/secret/headers` -> preserve existing values.
- Webhook partial update with invalid events -> `BadRequestError`.
- Backup table name from sqlite schema -> quote as SQL identifier before row export.

### 5. Good/Base/Bad Cases

- Good: management route hashes a share password, public route unlocks with the original password, and plaintext legacy shares still unlock.
- Base: share password is null/empty and remains null.
- Bad: write path stores `pbkdf2$sha256$...` while public route uses direct string comparison.
- Good: `{ "enabled": false }` updates only webhook enabled state and preserves URL/events/secret/headers.
- Bad: partial webhook body is validated but route passes `url: undefined`, `events: []`, or `secret: null` to a full-overwrite repository.
- Good: backup serializes rows page-by-page and uploads a compressed stream.
- Bad: backup accumulates all rows, all serialized table strings, or the full compressed buffer before upload.

### 6. Tests Required

- Unit test share password helpers for PBKDF2, legacy sha256, plaintext compatibility, and hash-as-password rejection.
- Public gallery/space route tests must unlock PBKDF2-stored passwords and plaintext legacy passwords.
- Manage folder/space route tests must assert stored share passwords are PBKDF2 records when pepper is configured.
- Webhook route and repository tests must cover partial update preservation, including hidden `secret`.
- Backup utility tests must assert R2 receives a `ReadableStream` and `Blob.arrayBuffer()` is not used.

### 7. Wrong vs Correct

#### Wrong

```js
// Partial schema says fields are optional, but this clears omitted values.
await repo.update(id, {
  url: body.url,
  events: body.events || [],
  secret: body.secret || null,
});

// Write path hashed the password, read path still compares plaintext.
if (!timingSafeCompare(password, folder.password)) return unauthorized();
```

#### Correct

```js
const existing = await repo.getByIdWithSecret(id);
await repo.update(id, {
  url: body.url ?? existing.url,
  events: body.events ?? existing.events,
  secret: body.secret !== undefined ? body.secret || null : existing.secret,
});

const stored = await encodeSharePasswordForStorage(password, pepper);
const ok = await verifySharePassword(password, stored, pepper);
```

---

## Scenario: Product Delete Archives Active Variants

### 1. Scope / Trigger

- Trigger: Backend, frontend, or QA automation work that touches management product deletion.
- Applies to: `DELETE /api/manage/products/:id`, product list verification, purchase-order/product-picker active variant queries, and E2E smoke assertions.
- Reason: The management delete endpoint is a soft-delete/archive contract. Treating it as hard deletion creates false-negative tests and misleading cleanup assumptions.

### 2. Signatures

- Management API: `DELETE /api/manage/products/:id -> { success: true, message: "Product variants archived" }`.
- Active variant verification API: `GET /api/manage/products/variants?search=<spu-or-keyword>`.
- Product list API: `GET /api/manage/products?search=<spu-or-name>`.
- Storage effect: `UPDATE product_variants SET status = 'archived', updated_at = ? WHERE product_id = ?`.

### 3. Contracts

- `DELETE /api/manage/products/:id` must require `products:manage`.
- The product row in `products` remains queryable after delete; do not assert that product search returns no product.
- All variants for the product must become `archived`.
- The product projection must refresh after archiving so active stock/availability reflects zero active variants.
- Product cache invalidation must publish a `product_archived` event for the affected product id.
- Frontend resource deletion may optimistically remove the row, but a subsequent product search can still return the product entity.

### 4. Validation & Error Matrix

- Product id not found -> `NotFoundError("Product not found")`.
- Existing variants and archive update affects zero rows -> `BadRequestError("Delete failed")`.
- Successful archive with variants -> response success and variant audit events for each archived variant.
- Successful archive with no variants -> response success if the product exists.
- Idempotent replay/resume -> return the stored public archive response and replay required side effects.

### 5. Good/Base/Bad Cases

- Good: UI clicks delete, confirms, receives `success: true`, then `/api/manage/products/variants?search=<spu>` returns no active variants for that product.
- Base: product list search still returns the product with zero active stock/availability after projection refresh.
- Bad: E2E tests fail because `/api/manage/products?search=<spu>` still returns the product entity.
- Bad: cleanup assumes product DELETE removes rows from `products`; repeated cleanup only archives variants again.

### 6. Tests Required

- Route tests must assert the public response message and that variants are archived.
- Route tests must cover missing product and zero-row archive failure when variants exist.
- Idempotency tests must cover replay/resume without duplicate cache or audit side effects.
- Frontend/E2E smoke tests must validate active variant absence through `/api/manage/products/variants`, not product entity absence.
- Projection/cache tests must assert active stock/availability is refreshed after archive.

### 7. Wrong vs Correct

#### Wrong

```js
await deleteProduct(product.id);
const stillFound = await findProductBySearch(product.spu);
if (stillFound) throw new Error('Product delete failed');
```

#### Correct

```js
const response = await deleteProduct(product.id);
if (!response.success) throw new Error('Product archive failed');

const activeVariant = await findActiveVariantBySearch(product.spu);
if (activeVariant) throw new Error('Product still has active variants');
```

---

## Scenario: Batch Product Import Refreshes Product Projection

### 1. Scope / Trigger

- Trigger: Backend changes that touch `POST /api/manage/products/batch`, product import replace/safe-merge behavior, product list/detail projections, or frontend QA flows that verify imported price/stock.
- Applies to: `ProductCatalogService.batchImportProducts`, product import UI, product list/detail after CSV import, and purchase-order picker setup data.
- Reason: Batch import writes `products` and `product_variants`, while management list/detail surfaces may read from `product_projection`. Without a refresh, a successful replace import can return stale price/stock in the UI.

### 2. Signatures

- Service: `ProductCatalogService.batchImportProducts(c, body, { skipCacheInvalidation? }) -> Promise<BatchImportResult>`.
- Result field: `BatchImportResult.productIds: string[]` lists product ids touched by successful or planned import operations.
- Refresh service: `ProductProjectionRefreshService.refreshByProductIds(productIds, c.executionCtx)`.
- API: `POST /api/manage/products/batch` accepts `{ items, import_mode }`.

### 3. Contracts

- On successful batch import with one or more `productIds`, refresh `product_projection` for those product ids before returning control to the route.
- The refresh must run before cache invalidation is scheduled, so downstream list/detail cache keys do not preserve stale projection data.
- Empty or failed imports must not refresh projections.
- Import response shape must continue to include summary, errors, conflicts, and `productIds`.

### 4. Validation & Error Matrix

- `items` missing or empty -> `BadRequestError("Invalid items array")`.
- `items.length > 500` -> `BadRequestError("Batch size limit exceeded (max 500)")`.
- Import validates but all rows fail -> `success: false`, no projection refresh.
- Import creates or updates products -> `success: true`, projection refresh for each touched product id.

### 5. Good/Base/Bad Cases

- Good: Replace-import SKU price from `88` to `99`; product detail/list show `99` after the import modal closes.
- Base: Safe-merge import that preserves conflicted fields refreshes projection for successfully processed products.
- Bad: Import response succeeds but UI still shows stale price/stock because only product/variant tables were updated.
- Bad: Cache invalidation is published before projection refresh and clients receive stale cached list/detail responses.

### 6. Tests Required

- Service boundary test must assert `refreshByProductIds(result.productIds, c.executionCtx)` after a successful batch import.
- Route/product import tests should keep asserting response summary and product ids.
- QA flow should import through the UI, search the imported SPU, open product detail, and assert updated brand, price, and stock.

### 7. Wrong vs Correct

#### Wrong

```js
const result = await executeProductCatalogBatchImport(...);
await scheduleProductCacheInvalidation(c, { productIds: result.productIds });
return result;
```

#### Correct

```js
const result = await executeProductCatalogBatchImport(...);
if (result.success && result.productIds?.length) {
  await new ProductProjectionRefreshService(db).refreshByProductIds(result.productIds, c.executionCtx);
}
await scheduleProductCacheInvalidation(c, { productIds: result.productIds });
return result;
```

---

## Scenario: Product Projection Drives Product Status And Cache

### 1. Scope / Trigger

- Trigger: Backend changes that touch product status, variant status, inventory/demand writes, purchase receipt/reversal flows, product cache events, or sales product availability.
- Applies to: `ProductRepository`, `ProductProjectionRepository`, `ProductProjectionRefreshService`, product manage routes, batch variant status routes, `InventoryService`, `DemandService`, and procurement receipt/reversal services.
- Reason: Product list/detail/sales surfaces read projection-backed values. Updating only `products.status` or publishing variant ids as product cache ids leaves stale product status, stock, and sales visibility.

### 2. Signatures

- Read contract: product status in product list/detail is derived from `product_projection.active_variant_count`.
- Refresh by product: `ProductProjectionRefreshService.refreshByProductIds(productIds, executionCtx?)`.
- Refresh by variant: `ProductProjectionRefreshService.refreshByVariantIds(variantIds, executionCtx?)`.
- Single refresh: `ProductProjectionRepository.refreshByProductId(productId)`.
- Product cache event helper: `publishProductCacheEvent(c, eventType, productIds)`.
- Batch variant status API: `POST /api/manage/products/batch/status` with `{ variantIds: string[], status: "active" | "archived" }`.

### 3. Contracts

- Product list/detail status must be computed from active variants:
  `COALESCE(product_projection.active_variant_count, 0) > 0 -> "active"`, otherwise `"archived"`.
- Do not use `products.status` as the source of truth for product list filters, sales visibility, price, stock, or availability.
- Product status changes must update `product_variants.status`, touch `products.updated_at`, refresh product projection, and publish a product cache event.
- Batch variant status changes must resolve affected `variantIds` to product ids before publishing cache events.
- Product cache payloads use product ids: `product_id` for one product and `product_ids` for many products. Do not publish variant ids in these fields.
- Inventory, demand, purchase receipt, and receipt reversal flows that change variant stock/availability/demand must refresh product projection for affected variants.
- Metadata/media-only product writes may not change projection values, but must still publish product cache events.

### 4. Validation & Error Matrix

- Unknown product id on status update -> existing product route error contract.
- Invalid status outside `"active" | "archived"` -> validation error before writes.
- Batch variant status with unknown variant ids -> no product cache ids for missing variants; refresh only resolvable ids.
- Projection refresh receives empty ids -> no-op.
- Product cache event receives only variant ids -> test failure; cache consumer cannot invalidate product/space/sales read models consistently.

### 5. Good/Base/Bad Cases

- Good: archiving the last active variant refreshes `product_projection`, product list returns `status: "archived"`, and sales catalog hides it.
- Base: archiving one of several active variants keeps product list `status: "active"` and recalculates min price/stock from remaining active variants.
- Good: receipt reversal lowers available stock, refreshes product projection by variant id, and product detail reflects the rollback.
- Bad: `UPDATE products SET status = "archived"` runs while variants remain active; product list and sales catalog disagree.
- Bad: batch status publishes `product_ids: variantIds`; cache invalidation misses product detail and space/sales product payloads.

### 6. Tests Required

- Repository tests must assert product status filters and list rows derive status from `product_projection.active_variant_count`.
- Product status route tests must assert projection refresh and product cache event publication after status changes.
- Batch status route tests must assert variant ids are resolved to product ids before cache publication.
- Inventory, demand, receipt, and reversal service tests must assert affected product projections are refreshed by variant id.
- Real API or integration tests should cover sales product visibility after stock/status/receipt transitions when the change touches a user-facing path.

### 7. Wrong vs Correct

#### Wrong

```js
await db.prepare('UPDATE products SET status = ? WHERE id = ?').bind(status, productId).run();
await publishProductCacheEvent(c, 'product_batch_archived', variantIds);
```

#### Correct

```js
await db
  .prepare('UPDATE product_variants SET status = ?, updated_at = ? WHERE product_id = ?')
  .bind(nextVariantStatus, now, productId)
  .run();
await new ProductProjectionRefreshService(db).refreshByProductIds([productId], c.executionCtx);
await publishProductCacheEvent(c, 'product_updated', [productId]);
```

---

## Scenario: Backend External Boundary And Archived Data Hardening

### 1. Scope / Trigger

- Trigger: Backend changes that touch uploads, external callback URLs, public verification endpoints, read DTOs containing secrets, or archived order read/write paths.
- Applies to: `functions/api/utils/file-utils.js`, Hono manage upload/webhook/settings/ERP routes, Turnstile verification, salesperson responses, order repositories, sales routes, and reporting/stat repositories.
- Reason: These surfaces cross trust boundaries. Client-provided identifiers, remote URLs, missing external-call timeouts, sensitive token fields, and soft-deleted business records must be handled consistently across routes, services, and repositories.

### 2. Signatures

- Upload helper: `uploadFile(env, file, metadata, options?) -> Promise<FileRecordLike>`.
- Caller metadata field: `contentHash?: string`.
- URL validation helper: `validateExternalUrl(url, env, options?) -> { valid: boolean, reason?: string }`.
- Safe fetch options helper: `buildSafeExternalFetchOptions(init?, timeoutMs?) -> RequestInit`.
- Turnstile endpoint: `POST /api/turnstile/verify` with JSON `{ token: string }`.
- ERP webhook endpoint: `POST /api/manage/erp-sync/connections/:id/webhook`.
- Salesperson read APIs: list/detail responses must omit `accessToken`; token reset responses may return the new token.

### 3. Contracts

- `contentHash` from the client is advisory only. When present, validate it as SHA-256 hex, compute the server-side SHA-256 for supported uploads, reject mismatches, and use the computed hash as the storage/CAS key.
- External service calls must validate URLs with environment-aware private-address rules, use `redirect: "manual"`, and attach an abort timeout signal.
- Production Turnstile verification fails closed when `TURNSTILE_SECRET_KEY` is absent; malformed JSON returns a stable `400`.
- ERP webhook HMAC accepts the legacy bare hex form and the canonical `sha256=<base64>` form. Missing or invalid signatures return `401`, disabled/missing connections return `404`, and missing connection secrets return `500`.
- Ordinary order reads, sales views, exports, reporting, receivables, payment stats, and profit stats exclude archived orders by default.
- Ordinary admin writes to archived orders are blocked. Recovery/admin-only archive workflows must use explicit archive-aware paths.
- Order mutations that guard `orders.archived_at IS NULL` and then write sidecars must place a `changes() = 1` assertion immediately after the guarded `UPDATE orders` in the same D1 batch.
- Procurement receipt commands must include resource-lock release statements in the final D1 batch-size guard before executing the atomic write batch.
- Read DTOs for salesperson list/detail must strip `accessToken`; only explicit token reset/creation flows may return a token value.

### 4. Validation & Error Matrix

- Upload `contentHash` missing -> compute server hash when supported and continue.
- Upload `contentHash` malformed -> `BadRequestError` before storage write.
- Upload `contentHash` valid but mismatched -> `BadRequestError("contentHash does not match file content")`.
- External URL resolves to loopback/private/link-local or IPv4-mapped private IPv6 in production -> validation failure.
- External URL redirects -> do not auto-follow; surface the manual redirect response or configured route error.
- Turnstile JSON parse failure -> `400`.
- Turnstile secret missing in production -> verification failure, not bypass.
- Archived order update through ordinary route/service -> `BadRequestError` or `NotFoundError` according to the route contract.
- Guarded order `UPDATE orders ... archived_at IS NULL` changes zero rows -> abort before order payload, line, file, timeline, or other sidecar writes.
- Receipt final write plan plus lock-release statements exceeds D1 batch size -> `BadRequestError("本次收货包含的写入过多，请拆分后重试")` and cleanup the reserved command before receipt side effects.
- Salesperson list/detail response includes `accessToken` -> test failure.

### 5. Good/Base/Bad Cases

- Good: upload receives a correct SHA-256 from the client, recomputes the same hash, stores by the computed value, and deduplicates by content.
- Base: small upload omits `contentHash`; backend computes a hash and stores by content.
- Bad: upload trusts caller `contentHash` and lets a caller choose another object's storage key.
- Good: webhook retry/test uses validated URL plus `buildSafeExternalFetchOptions({ method, headers, body })`.
- Bad: webhook/ERP/settings code calls `fetch(userUrl)` directly or follows redirects automatically.
- Good: order statistics repositories add `archived_at IS NULL` to ordinary reporting queries.
- Bad: a route hides archived orders but a lower-level repository mutation can still update archived rows.
- Good: salesperson list/detail can be used by `users:read` without exposing login tokens.
- Bad: a hidden secret is stripped in one route but leaked by a shared transformer or detail route.

### 6. Tests Required

- Upload tests must cover malformed hash, mismatched hash, computed hash storage, and dedupe behavior.
- URL security tests must cover loopback/private hosts, IPv4-mapped IPv6, manual redirect behavior, and allowed local development cases.
- Route/service tests that call external URLs must assert `redirect: "manual"` and an abort signal are passed to fetch.
- Turnstile tests must cover malformed JSON, production missing-secret fail-closed behavior, and timeout handling.
- ERP webhook route and service tests must cover public auth bypass only for the exact webhook path plus both signature formats.
- Archived-order tests must cover ordinary list/report/stat exclusions and blocked write paths at both route and repository/service levels.
- Order mutation tests must simulate a zero-row guarded order update and assert no sidecar statements execute after the failed guard.
- Receipt command tests must cover the boundary where receipt writes fit under D1's batch limit until resource-lock release deletes are counted.
- Salesperson route tests must assert list/detail omit `accessToken` and reset-token still returns the newly generated token.

### 7. Wrong vs Correct

#### Wrong

```js
// Caller controls the storage identity.
const hash = metadata.contentHash;
await env.R2.put(hash, file.stream());

// Untrusted URL follows redirects and has no timeout.
await fetch(webhook.url, { method: 'POST', body });

// Sidecars can still run when the active-order guard changes zero rows.
await db.batch([updateOrderStmt, payloadUpsertStmt, lineUpdateStmt]);

// Lock release deletes are omitted from the atomic batch-size guard.
if (countReceiptWriteStatements(preparedReceipts) > 100) throw tooManyWrites;

// Secret-bearing repository row is returned as the public DTO.
return c.json(await salespersonRepo.getById(id));
```

#### Correct

```js
const computedHash = await computeSha256(file);
if (metadata.contentHash && metadata.contentHash !== computedHash) {
  throw new BadRequestError('contentHash does not match file content');
}
await env.R2.put(computedHash, file.stream());

const safeUrl = validateExternalUrl(webhook.url, env);
if (!safeUrl.valid) throw new BadRequestError(safeUrl.reason);
await fetch(webhook.url, buildSafeExternalFetchOptions({ method: 'POST', body }));

await db.batch([
  updateOrderStmt,
  db.prepare("SELECT json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END, '$')"),
  payloadUpsertStmt,
  lineUpdateStmt,
]);

const lockReleaseCount = new Set(preparedReceipts.map((receipt) => receipt.purchaseOrderItemId))
  .size;
if (countReceiptWriteStatements(preparedReceipts, { lockReleaseCount }) > 100) {
  throw new BadRequestError('本次收货包含的写入过多，请拆分后重试');
}

const salesperson = await salespersonRepo.getById(id);
delete salesperson.accessToken;
return c.json(salesperson);
```

---

## Scenario: Runtime JS Module Loading And Public Share JSON Validation

### 1. Scope / Trigger

- Trigger: Backend changes that add `.js` runtime entrypoints, repository wrappers, public share password POST routes, or imports shared with TypeScript/frontend code.
- Applies to: `functions/lib/hono/app.js`, cron entrypoints, runtime route/service modules, public gallery/space password verification routes, and repository modules imported by runtime `.js`.
- Reason: Cloudflare/Node runtime module loading must not depend on Node 24 TypeScript stripping, and public share validation must return stable body validation errors before lockout state changes response ordering.

### 2. Signatures

- Module smoke: `node --no-experimental-strip-types --input-type=module -e "import('./functions/lib/hono/app.js')"`.
- Module smoke: `node --no-experimental-strip-types --input-type=module -e "import('./functions/api/cron/outbox.js')"`.
- Public gallery password API: `POST /api/gallery/:token` with JSON `{ "password": string }`.
- Public space password API: `POST /api/space/:token` with JSON `{ "password": string }`.

### 3. Contracts

- Runtime `.js` modules must import other runtime modules with `.js` specifiers.
- Repository modules imported by runtime `.js` must be real JavaScript modules; `.js` wrappers must not re-export `.ts` files.
- Backend runtime modules must not import frontend `.ts` utilities through a `.js` wrapper that re-exports TypeScript.
- Public share POST routes must parse JSON and validate required `password` before calling `authorizePublicPasswordAttempt`.
- Malformed JSON returns `400` even when the share/IP lockout key is already locked.
- Lockout checks and failure recording run only after a syntactically valid JSON body with a non-empty password.

### 4. Validation & Error Matrix

- Runtime import resolves a `.ts` file with TypeScript stripping disabled -> smoke test failure.
- Runtime repository wrapper re-exports `./Repository.ts` -> smoke test failure.
- Malformed public share JSON -> `400`.
- Empty/missing public share password -> `400`.
- Valid JSON plus locked public share key -> `429`.
- Valid JSON plus wrong public share password -> record failure and return `401`.

### 5. Good/Base/Bad Cases

- Good: `functions/repositories/ProductRepository.js` contains executable JS and runtime routes import `ProductRepository.js`.
- Base: repository unit tests may still import `.ts` sources when they intentionally test source behavior.
- Bad: `functions/repositories/ProductRepository.js` contains `export * from './ProductRepository.ts'`.
- Good: gallery password POST parses malformed JSON and returns `400` without reading lockout KV.
- Bad: gallery password POST checks lockout first and returns `429` for malformed JSON when locked.

### 6. Tests Required

- Backend module-load smoke must run Node with `--no-experimental-strip-types` for the Hono app and cron entrypoints.
- Public gallery/space tests must cover malformed password JSON returning `400`.
- Public gallery lockout regression must assert malformed JSON returns `400` and does not call lockout KV.
- Route tests that mock repositories must mock the same `.js` module path imported by the runtime route.

### 7. Wrong vs Correct

#### Wrong

```js
// Runtime wrapper still requires TypeScript stripping.
export * from './NotificationRepository.ts';

const throttleError = await authorizePublicPasswordAttempt(env, request, key);
if (throttleError) return throttleError;
const body = await request.json();
```

#### Correct

```js
import { NotificationRepository } from '../../../../repositories/NotificationRepository.js';

let body;
try {
  body = await request.json();
} catch {
  return error(MSG.COMMON.INVALID_PARAMS, 400);
}

const throttleError = await authorizePublicPasswordAttempt(env, request, key);
if (throttleError) return throttleError;
```
