# Purchase Order Visual Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the purchase-order overview and detail modal read as one lightweight operations console without changing behavior, data flow, or available actions.

**Architecture:** Keep the work localized to [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) so the visual cleanup happens inside the existing page shell, table contract, and modal structure. Use source-level design-contract tests to lock the key decisions: remove page-local `font-[Outfit]`, reduce hero-style gradients, and preserve the existing overview, table, and detail anchors that protect behavior.

**Tech Stack:** Vue 3 SFCs, Tailwind v4 utility classes and semantic tokens, shared design-system primitives, Vitest, Vue Test Utils

---

## File Structure

- Modify: [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue)
  Purpose: refine the overview banner, status cards, table toolbar and cells, detail modal panels, and residual page-local typography inside the purchase-order workspace
- Modify: [src/views/**tests**/PurchaseOrders.design-system-migration.test.js](/home/bjw/Code/KK-Image/src/views/__tests__/PurchaseOrders.design-system-migration.test.js)
  Purpose: lock source-level visual contracts for the shared shell, overview strip, quieter surface language, and removal of `font-[Outfit]`
- Modify: [src/views/**tests**/PurchaseOrders.detail-shell.test.js](/home/bjw/Code/KK-Image/src/views/__tests__/PurchaseOrders.detail-shell.test.js)
  Purpose: keep the detail shell, summary, progress, cost, items, and receipts regions reachable while the modal visuals are reworked

## Preflight Notes

- The current repository is dirty in unrelated purchase-order backend files. Do not stage or revert them.
- If a dedicated worktree is available, execute there. Otherwise, keep every `git add` path-limited to the three files above.
- Do not broaden scope into shared primitives unless [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) cannot achieve the approved design cleanly on its own.

### Task 1: Tighten Overview And Table Contracts

**Files:**

- Modify: [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue)
- Modify: [src/views/**tests**/PurchaseOrders.design-system-migration.test.js](/home/bjw/Code/KK-Image/src/views/__tests__/PurchaseOrders.design-system-migration.test.js)

- [ ] **Step 1: Write the failing design-contract test for calmer top-level surfaces**

Add source assertions that ban the current hero-style overview treatment and the current table cost-pill styling:

```js
it('replaces the heavy overview hero gradient with quieter panel framing', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

  expect(source).not.toContain('bg-linear-to-br from-sky-50/75 via-(--bg-card) to-amber-50/45');
  expect(source).toContain('data-testid="purchase-order-console-banner"');
  expect(source).toContain('data-testid="purchase-order-overview-strip"');
});

it('drops the table-row cost pill so money reads as calmer ledger data', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

  expect(source).not.toContain(
    'inline-flex min-w-[7.5rem] justify-end rounded-lg bg-(--bg-muted)/65'
  );
  expect(source).toContain('data-testid="purchase-order-total-cost"');
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/views/__tests__/PurchaseOrders.design-system-migration.test.js
```

Expected: FAIL because [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) still contains the current overview gradient string and the row-level cost-pill class.

- [ ] **Step 3: Refactor the overview and table surface in the page**

Update [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) so the top-level workspace uses quieter, shared panel language:

- reduce the banner from hero-like gradient treatment to a lighter neutral surface with only a subtle accent wash
- keep `purchase-order-console-banner` and `purchase-order-overview-strip`
- keep the six `MetricTile` filters clickable and flat, but reduce surrounding competition from extra badges and decorative framing
- simplify the `AppTable` toolbar so it reads as ledger context, not a second headline
- turn the total-cost cell from a mini card into a calmer right-aligned emphasis
- replace overview and table numeric `font-[Outfit]` usage with shared sans or mono/tabular treatment

Use an implementation shape like:

```vue
<section
  data-testid="purchase-order-console-banner"
  class="relative overflow-hidden rounded-[1.75rem] border border-(--border-color)/60 bg-(--bg-card) px-4 py-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)] sm:px-5 sm:py-5"
>
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.06),transparent_24%)]"></div>
</section>
```

And shift money or count emphasis toward:

```vue
<span
  data-testid="purchase-order-total-cost"
  class="inline-flex min-w-[7.5rem] justify-end font-mono text-sm font-semibold tabular-nums text-(--text-main)"
>
  {{ formatPurchaseCurrency(po.total_goods_cost, po.currency) }}
</span>
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/views/__tests__/PurchaseOrders.design-system-migration.test.js
```

Expected: PASS with the lighter-overview and calmer-cost-cell assertions.

- [ ] **Step 5: Commit the overview and table cleanup**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js
git commit -m "refactor: unify purchase order overview surfaces"
```

### Task 2: Refine The Detail Modal Into The Same Workspace

**Files:**

- Modify: [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue)
- Modify: [src/views/**tests**/PurchaseOrders.design-system-migration.test.js](/home/bjw/Code/KK-Image/src/views/__tests__/PurchaseOrders.design-system-migration.test.js)
- Modify: [src/views/**tests**/PurchaseOrders.detail-shell.test.js](/home/bjw/Code/KK-Image/src/views/__tests__/PurchaseOrders.detail-shell.test.js)

- [ ] **Step 1: Write the failing tests for the quieter detail shell contract**

Extend the source-contract test to ban the current feature-card gradients in the detail modal:

```js
it('avoids feature-card gradients inside the detail workspace', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

  expect(source).not.toContain('bg-linear-to-r from-sky-50/75 via-(--bg-card) to-amber-50/40');
  expect(source).not.toContain('bg-linear-to-br from-(--bg-card) via-(--bg-card) to-sky-50/35');
  expect(source).not.toContain('bg-linear-to-br from-(--bg-card) via-(--bg-card) to-amber-50/45');
});
```

Keep the runtime shell test focused on structure still being reachable after the refactor:

```js
expect(wrapper.find('[data-testid="purchase-order-detail-summary"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="purchase-order-detail-progress"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="purchase-order-detail-cost"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="purchase-order-detail-items"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="purchase-order-detail-receipts"]').exists()).toBe(true);
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: FAIL on the new gradient-ban assertions in the source-contract suite.

- [ ] **Step 3: Rewrite the detail modal surfaces in the page**

Update [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) so the modal inherits the same calm surface language as the list view:

- tone down the modal header background and keep status recognition with chips instead of a hero banner
- keep `purchase-order-detail-summary`, `purchase-order-detail-progress`, `purchase-order-detail-cost`, `purchase-order-detail-items`, and `purchase-order-detail-receipts`
- make summary cards quieter and subordinate to progress and cost
- normalize progress and cost panels to matching panel framing
- reduce item-card decorative color while keeping progress badges and cost data legible
- remove remaining `font-[Outfit]` usages in the detail shell and use mono/tabular numeric emphasis instead

Use structures like:

```vue
<div
  data-testid="purchase-order-detail-summary"
  class="relative flex shrink-0 items-center justify-between border-b border-(--border-color)/70 bg-(--bg-card) px-6 py-5"
>
```

```vue
<article
  v-for="card in detailSummaryCards"
  :key="card.key"
  class="rounded-[1.25rem] border border-(--border-color)/60 bg-(--bg-card) p-4 shadow-none"
>
```

```vue
<div
  data-testid="purchase-order-detail-progress"
  class="rounded-[1.5rem] border border-(--border-color)/65 bg-(--bg-card) p-5 shadow-none"
>
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: PASS with the detail shell still mounting and the source contract free of the old heavy gradients.

- [ ] **Step 5: Commit the detail modal cleanup**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "refactor: unify purchase order detail surfaces"
```

### Task 3: Sweep Residual Typography And Run Final Verification

**Files:**

- Modify: [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue)
- Modify: [src/views/**tests**/PurchaseOrders.design-system-migration.test.js](/home/bjw/Code/KK-Image/src/views/__tests__/PurchaseOrders.design-system-migration.test.js)

- [ ] **Step 1: Write the failing regression test that the whole purchase-order workspace is free of page-local display typography**

If Task 1 only removed the obvious overview occurrences, strengthen the assertion so the entire file stays clean:

```js
it('keeps all purchase-order sub-surfaces on shared typography tokens', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

  expect(source).not.toContain('font-[Outfit]');
});
```

This test should protect the create modal, suggestion modal, shortage dialog summaries, receipt summaries, and any remaining in-file purchase-order sub-surfaces.

- [ ] **Step 2: Run the targeted test to verify it fails if residual `Outfit` usage remains**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/views/__tests__/PurchaseOrders.design-system-migration.test.js
```

Expected: FAIL if any `font-[Outfit]` instance still remains in [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue). If it already PASSes because Task 2 removed every instance, keep the stronger assertion and move to Step 4 after confirming Step 3 is no longer needed.

- [ ] **Step 3: Remove the remaining page-local typography shortcuts and normalize numeric emphasis**

Sweep [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) for the remaining purchase-order-local numeric styling:

- replace `font-[Outfit]` in modal counters, shortage and receipt summaries, and suggestion chips
- use `font-mono`, `tabular-nums`, or plain shared sans depending on whether the value is an ID, quantity, or general count
- keep semantic emphasis by weight and contrast, not display-font novelty

Typical replacements should look like:

```vue
<strong class="font-mono tabular-nums text-(--text-main)">{{ totalCreateQty }}</strong>
```

```vue
<span class="font-mono text-sm font-semibold tabular-nums text-(--text-main)">
  {{ formatInteger(receipt.reversal_count) }}
</span>
```

- [ ] **Step 4: Run formatting and the relevant tests**

Run:

```bash
npx prettier --write src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
node node_modules/vitest/vitest.mjs run src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
```

Expected: Prettier finishes without rewriting unrelated files, and both test files PASS.

- [ ] **Step 5: Commit the final typography sweep**

```bash
git add src/views/PurchaseOrders.vue src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/PurchaseOrders.detail-shell.test.js
git commit -m "refactor: remove purchase order page-local typography"
```

## Done Criteria

- [ ] [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) no longer contains `font-[Outfit]`
- [ ] overview banner and table toolbar are visually calmer but retain all current actions and anchors
- [ ] detail modal still exposes summary, progress, cost, items, and receipts sections through the existing `data-testid` hooks
- [ ] no old hero-style overview or detail gradients remain
- [ ] targeted Vitest coverage passes
