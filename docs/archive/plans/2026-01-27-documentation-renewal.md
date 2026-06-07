# Documentation Renewal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the `docs` directory by archiving obsolete materials and updating core reference documents (`DATABASE_SCHEMA.md`, `API_REFERENCE.md`) to align with the current v2.1.0 codebase (including recent Order and Space features).

**Architecture:**

1. **Archive Strategy**: Move completed/stale plans to `docs/archive/plans` to declutter the main workspace.
2. **Schema Synchronization**: Manually verify `migrations/*.sql` and update `DATABASE_SCHEMA.md` to be the Single Source of Truth for the DB structure.
3. **API Alignment**: Update `API_REFERENCE.md` to reflect new Order fields and endpoints.

**Tech Stack:** Markdown, Git

---

### Task 1: Archive Completed Plans

**Files:**

- Create: `docs/archive/plans/` (Directory)
- Move: `docs/plans/*.md` (Completed ones)

**Step 1: Create Archive Directory**
Run: `mkdir -p docs/archive/plans`

**Step 2: Identify and Move Completed Plans**
Move the following files to `docs/archive/plans/`:

- `2026-01-25-composable-unification.md`
- `2026-01-25-product-sota-optimization.md`
- `2026-01-26-admin-order-binding.md`
- `2026-01-26-product-import-column-mapping.md`
- `2026-01-27-product-binding-fix.md`

**Step 3: Update README (Optional)**
If `docs/README.md` lists these plans, update it to point to the archive or remove them.

### Task 2: Update Database Schema Documentation

**Files:**

- Modify: `docs/DATABASE_SCHEMA.md`
- Reference: `migrations/0026_add_product_id_to_orders.sql`
- Reference: `migrations/0027_add_quantity_to_orders.sql`
- Reference: `migrations/0028_add_space_sharing.sql`

**Step 1: Analyze Migrations**
Confirm the new columns and tables:

- `orders`: `product_id`, `quantity`
- `spaces`: `share_mode`
- `space_salesperson_shares`: New table

**Step 2: Update Documentation**
Update `docs/DATABASE_SCHEMA.md` sections:

- Add `orders` table new columns.
- Update `spaces` table definition.
- Add `space_salesperson_shares` table definition to "2. 共享空间" section.
- Update "Last Updated" date.

### Task 3: Update API Reference (Light Touch)

**Files:**

- Modify: `docs/API_REFERENCE.md`

**Step 1: Check Content**
Review if the Order creation/update examples need to include `productId` or `quantity`.

**Step 2: Update Documentation**

- Add brief note about `product_id` binding in Order endpoints.
- Ensure authentication examples are still valid.

### Task 4: Verify Project Summary

**Files:**

- Modify: `docs/project-summary.md`

**Step 1: Bump Version**
Ensure version is accurate (e.g., v2.1.1 if needed to match database init script).

---
