# brainstorm: 追加大文件拆分建议

## Goal

Review `CODEBASE-AUDIT-REPORT.md` and append actionable recommendations for splitting oversized source files so future refactors have clear targets and boundaries.

## What I already know

* The user wants the existing audit report reviewed and extended.
* The requested addition is specifically about large-file splitting suggestions.

## Assumptions (temporary)

* The report should be updated in place instead of creating a separate follow-up document.
* Suggestions should be based on the current repository file sizes and existing architecture boundaries.

## Open Questions

* None currently blocking; inspect the report and repository first.

## Requirements (evolving)

* Identify large files that are reasonable refactor candidates.
* Append recommendations to `CODEBASE-AUDIT-REPORT.md`.
* Keep the additions actionable and scoped to decomposition boundaries rather than rewriting implementation details.

## Acceptance Criteria (evolving)

* [ ] `CODEBASE-AUDIT-REPORT.md` contains a new large-file splitting section.
* [ ] Recommendations cite concrete files and proposed extraction boundaries.
* [ ] The update does not alter unrelated report content.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green when code changes are made.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Implementing the file splits in this task.
* Changing runtime behavior.

## Technical Notes

* Files to inspect: `CODEBASE-AUDIT-REPORT.md`, large source files from repository line counts.
