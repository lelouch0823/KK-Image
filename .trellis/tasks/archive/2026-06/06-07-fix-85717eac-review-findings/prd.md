# brainstorm: 修复 85717eac 审查问题

## Goal

Fix the backend regressions and incomplete fixes identified during review of commit `85717eac`, with a focus on public share password hashing, webhook update semantics, and backup memory behavior.

## What I already know

* Commit `85717eac` attempted to address security, performance, and quality issues across backend code.
* Review found folder share passwords can be hashed on write but still verified as plaintext on public access.
* Review found space share passwords are still stored and verified as plaintext.
* Review found webhook update validation accepts partial bodies while the repository update path overwrites all persisted fields.
* Review found the backup utility still accumulates full serialized and compressed backup data in memory.

## Assumptions

* Public folder and space share password behavior should support PBKDF2 hashes and preserve existing plaintext shares where possible.
* `PASSWORD_PEPPER` should be preferred, with `JWT_SECRET` as the existing fallback, matching current code.
* Webhook update should preserve omitted fields for partial update bodies.
* Backup export should avoid accumulating whole-table rows and full JSON strings before compression.

## Requirements

* Folder public share password verification accepts PBKDF2-hashed stored passwords.
* Folder public share password verification remains compatible with existing plaintext shares.
* Space create, update, and subspace create paths hash non-empty share passwords when a pepper is available.
* Space public password verification accepts PBKDF2-hashed stored passwords and remains compatible with existing plaintext shares.
* Webhook update preserves omitted fields and does not bind `undefined`.
* Backup export uses stream-oriented serialization/compression and avoids retaining all rows/serialized parts in arrays.

## Acceptance Criteria

* [x] A public folder share saved through the management share endpoint can be unlocked with the original password.
* [x] A public space share saved through create/update/subspace paths stores a PBKDF2 hash when pepper is configured and unlocks with the original password.
* [x] Existing plaintext public folder/space passwords still unlock.
* [x] Webhook partial update such as `{ "enabled": false }` preserves URL, events, secret, and headers.
* [x] Backup utility does not build arrays of all rows, all serialized table parts, or a full compressed ArrayBuffer before upload.
* [x] Relevant unit tests cover the regression paths.
* [x] Focused lint/tests pass.

## Definition of Done

* Tests added or updated for modified backend behavior.
* Focused lint and test commands run successfully.
* No unrelated refactors or formatting churn.
* Behavior changes are documented in this PRD.

## Out of Scope

* Full migration of existing plaintext share passwords at rest.
* Reworking admin user password pepper rollout.
* Full backup restore redesign beyond maintaining the existing backup JSON shape.

## Technical Notes

* Primary affected areas: public gallery/space access, manage folder/space routes, password utilities, webhook repository/route, and backup utility tests.
* Backend runtime is Cloudflare Workers/D1/R2 style JavaScript.
* Verification: focused regression tests passed for password, webhook, backup, folder, and space paths.
* Verification: focused eslint passed for all changed production and test files.
* Full `pnpm test:unit:run` currently has 3 unrelated script import-contract failures in `scripts/__tests__/check-i18n.test.js`, `scripts/__tests__/seed.test.js`, and `scripts/__tests__/seed_products.test.js`.
