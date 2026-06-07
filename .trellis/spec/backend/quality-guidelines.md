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
