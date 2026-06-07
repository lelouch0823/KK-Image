# Product Binding Mobile Detail Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the compact mobile presentation of `ProductBindingSection` so its metadata and summary surfaces feel more premium without changing behavior.

**Architecture:** Keep all existing data flow and variant-selection logic intact. Limit the change to template class tokens in `ProductBindingSection.vue`, then lock the intended polish with one focused component test plus a targeted regression run.

**Tech Stack:** Vue 3, Tailwind CSS 4, Vitest, Vue Test Utils

---

### Task 1: Add a failing test for the detail polish tokens

**Files:**

- Modify: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- Modify: `src/components/order/ProductBindingSection.vue`

**Step 1: Write the failing test**

Add assertions for:

```js
expect(wrapper.find('[data-testid="bound-sku"]').classes()).toContain('bg-(--bg-muted)/45');
expect(wrapper.find('[data-testid="availability-badge"]').classes()).toContain('border');
expect(wrapper.find('[data-testid="inventory-stats"]').classes()).toContain('divide-x');
expect(wrapper.find('[data-testid="dimension-option-card-size"]').classes()).toContain(
  'bg-(--bg-muted)/20'
);
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: FAIL because the component does not yet expose the new test hooks or polish tokens.

**Step 3: Write minimal implementation**

Update `ProductBindingSection.vue` to:

1. Add test hooks for the SKU chip, availability badge, inventory stats wrapper, and non-color option cards
2. Lighten the SKU treatment
3. Add a subtle border treatment to the availability badge
4. Add an internal divider to the inventory stats row
5. Refine the non-color option surface without changing control size

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/components/order/ProductBindingSection.vue
git commit -m "refactor: polish product binding mobile detail surfaces"
```

### Task 2: Verify the polish did not break related behavior

**Files:**

- Test: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- Test: `src/views/sales/__tests__/SalesFormView.resilience.test.js`

**Step 1: Run the focused component suite**

Run:

```bash
pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js
```

Expected: PASS with all previous behavior tests and the new polish test green.

**Step 2: Run a related integration-style regression**

Run:

```bash
pnpm test:unit src/views/sales/__tests__/SalesFormView.resilience.test.js
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/order/ProductBindingSection.vue src/components/order/__tests__/ProductBindingSection.variant-status.test.js
git commit -m "test: verify product binding mobile detail polish"
```
