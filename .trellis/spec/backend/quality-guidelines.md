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
- Salesperson route tests must assert list/detail omit `accessToken` and reset-token still returns the newly generated token.

### 7. Wrong vs Correct

#### Wrong

```js
// Caller controls the storage identity.
const hash = metadata.contentHash;
await env.R2.put(hash, file.stream());

// Untrusted URL follows redirects and has no timeout.
await fetch(webhook.url, { method: 'POST', body });

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

const salesperson = await salespersonRepo.getById(id);
delete salesperson.accessToken;
return c.json(salesperson);
```
