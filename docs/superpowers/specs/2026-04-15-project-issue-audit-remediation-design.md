# Project Issue Audit Remediation Design

**Date:** 2026-04-15

**Scope:** Resolve the 2026-04-15 project issue audit in execution waves, separating low-risk correctness fixes from high-risk structural refactors.

## Problem Framing

The 30 audit items are not one coherent defect. They fall into five groups with very different risk profiles:

1. Tooling and quality-gate gaps
2. Storage default and configuration drift
3. Duplicated helpers and misplaced shared constants
4. Missing document-space presentation path
5. Large-file architectural debt

Treating all 30 items as one batch would mix safe operational fixes with broad refactors, making regression risk and review cost unnecessarily high.

## Decision

Implement the audit in two stages.

### Stage 1: Safe correctness remediation

Fix the issues that are directly verifiable, low-risk, and likely to improve daily engineering signal:

- `01-10`: quality-gate, CI, lint-scope, and lint-noise issues
- `11-13`: storage default/documentation drift
- `15`: duplicate `variant-meta`
- `17-25`: barrel indirection, JSON parse duplication, misplaced constants, and missing document template
- `30`: deterministic dead code / invalid lint suppressions

### Stage 2: Structural refactor backlog

Plan and execute separately:

- `14`: provider cache keyed too loosely across env bindings
- `16`: purchase-order projection logic duplicated across frontend/backend runtimes
- `26-29`: oversized modules and repository/service decomposition

These items are real design debt, but they require boundary decisions and broader regression coverage. They should not block Stage 1.

## Architecture

Stage 1 is grouped by boundary instead of by file type:

1. Toolchain wave
   - expand lint/format/test coverage
   - remove false-positive lint noise
   - clean deterministic warnings
2. Storage/default wave
   - make runtime defaults match README and deployment expectations
3. Shared-helper wave
   - collapse obvious duplication into existing local utility layers
4. Space-template wave
   - add a dedicated `document` template component and route both public/sales views through it

## Constraints

- Do not reopen unrelated in-flight changes in the dirty worktree.
- Prefer reusing existing utility modules over introducing new shared-package infrastructure.
- Keep Stage 1 additive and behavior-preserving where possible.
- Do not fold Stage 2 file splits into Stage 1 unless required to unblock a direct bug.

## Testing Strategy

- Use focused RED/GREEN tests for behavior changes.
- For tooling/script fixes, add or update targeted script/config tests where possible and verify with focused commands.
- Run touched lint scopes plus focused unit tests after each wave.

## Expected Outcome

After Stage 1:

- repository quality gates cover the code that is actually being changed
- lint output is actionable instead of noisy
- storage defaults align with docs and deployment assumptions
- obvious duplication and misplaced shared code are reduced
- document spaces render through a dedicated component instead of masonry fallback

Stage 2 will remain as an explicit follow-up plan for architectural decomposition.
