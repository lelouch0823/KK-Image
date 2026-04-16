# Product Module Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the product module logic gaps found in audit review, with inventory-safe edit flows, consistent import semantics, and visible failure boundaries.

**Architecture:** Keep the current product service and repository layering, but tighten the contracts between product form submission, catalog service validation, repository persistence, and import workflow aggregation. Fixes should be incremental and regression-driven so that each business rule is enforced by tests at the exact layer that owns it.

**Tech Stack:** Vue 3, Hono, Vitest, Cloudflare D1, repository/service pattern

---

### Task 1: Preserve Existing Inventory During Product Edit

**Files:**
- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/lib/hono/routes/manage/products/__tests__/product-validation-rules.test.js`
- Add or Modify: `functions/repositories/__tests__/product-variant-upsert-stock.test.js`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the focused tests and confirm the current implementation fails**
- [ ] **Step 3: Update variant sync so existing variants keep stock/on-hand when `stock_quantity` is omitted**
- [ ] **Step 4: Re-run the focused tests and confirm they pass**

### Task 2: Make Import Payload Carry Complete Product Metadata

**Files:**
- Modify: `src/components/product/ProductImportModal.vue`
- Modify: `src/components/product/__tests__/ProductImportModal.variant-first.test.js`

- [ ] **Step 1: Write failing tests for grouped import payload carrying `currency`, `dimensions`, and row-level images**
- [ ] **Step 2: Run the focused tests and confirm the current implementation fails**
- [ ] **Step 3: Update import aggregation to emit complete product payloads**
- [ ] **Step 4: Re-run the focused tests and confirm they pass**

### Task 3: Make Replace Import Truly Replace Dimension Master Data

**Files:**
- Modify: `functions/services/ProductCatalogService.js`
- Modify: `functions/lib/hono/routes/manage/products/__tests__/product-spu-routes.test.js`

- [ ] **Step 1: Write failing tests for `replace` import archiving missing dimensions/values**
- [ ] **Step 2: Run the focused tests and confirm the current implementation fails**
- [ ] **Step 3: Update batch import dimension sync to honor replace semantics**
- [ ] **Step 4: Re-run the focused tests and confirm they pass**

### Task 4: Align Import Status Validation With Backend Contract

**Files:**
- Modify: `src/components/product/ProductImportModal.vue`
- Modify: `src/components/product/__tests__/ProductImportModal.variant-first.test.js`

- [ ] **Step 1: Write failing tests for `inactive/下架/停用` preprocessing behavior**
- [ ] **Step 2: Run the focused tests and confirm the current implementation fails**
- [ ] **Step 3: Normalize import statuses to the backend-supported domain and fail early on invalid statuses**
- [ ] **Step 4: Re-run the focused tests and confirm they pass**

### Task 5: Surface Partial Import Failures to the UI

**Files:**
- Modify: `src/components/product/ProductImportModal.vue`
- Modify: `src/components/product/__tests__/ProductImportModal.variant-first.test.js`

- [ ] **Step 1: Write failing tests for partial-success import responses carrying backend `errors`**
- [ ] **Step 2: Run the focused tests and confirm the current implementation fails**
- [ ] **Step 3: Update UI stats/result aggregation so partial failures are visible and counted**
- [ ] **Step 4: Re-run the focused tests and confirm they pass**

### Task 6: Run End-to-End Verification For Product Hardening

**Files:**
- No code changes required unless regressions are found

- [ ] **Step 1: Run all focused unit tests for the touched product module files**
- [ ] **Step 2: Run the broader product route and UI regression suites**
- [ ] **Step 3: Review failures, fix regressions if any, and re-run**
