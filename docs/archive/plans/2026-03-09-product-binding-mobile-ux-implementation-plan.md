# Product Binding Mobile UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `ProductBindingSection` feel more compact and refined on mobile without changing product-binding behavior.

**Architecture:** Keep the existing component contract intact and limit changes to responsive classes in `ProductBindingSection.vue`. Lock the intended mobile structure with class-based component tests so future visual regressions are caught without introducing behavioral risk.

**Tech Stack:** Vue 3, Tailwind CSS 4, Vitest, Vue Test Utils

---

### Task 1: Add failing tests for mobile layout tokens

**Files:**

- Modify: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- Modify: `src/components/order/ProductBindingSection.vue`

**Step 1: Write the failing test**

Add assertions that mount the bound-product state and check for:

```js
expect(wrapper.find('[data-testid="binding-header"]').classes()).toContain('px-3');
expect(wrapper.find('[data-testid="binding-header"]').classes()).toContain('py-2.5');
expect(wrapper.find('[data-testid="bound-image-shell"]').classes()).toContain('size-14');
expect(wrapper.find('[data-testid="inventory-summary"]').classes()).toContain('p-3');
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: FAIL because the current component does not expose the new test ids or mobile class tokens.

**Step 3: Write minimal implementation**

Update the template to:

1. Add stable `data-testid` hooks for the header, image shell, and inventory summary
2. Reduce mobile-only padding, gap, and image-size classes
3. Keep desktop classes at current or near-current density

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/components/order/ProductBindingSection.vue
git commit -m "refactor: tighten product binding mobile layout"
```

### Task 2: Refine mobile hierarchy and tap targets

**Files:**

- Modify: `src/components/order/ProductBindingSection.vue`
- Test: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

**Step 1: Write the failing test**

Add assertions for touch-safe icon actions and lighter selector/footer structure:

```js
expect(wrapper.find('[data-testid="unbind-product"]').classes()).toContain('min-h-11');
expect(wrapper.find('[data-testid="unbind-product"]').classes()).toContain('min-w-11');
expect(wrapper.find('[data-testid="dimension-options-size"]').classes()).toContain('gap-2');
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: FAIL because the current action buttons and selector groups do not use the new mobile tokens or test ids.

**Step 3: Write minimal implementation**

Update the component to:

1. Keep action icons visually light but give them at least 44x44 mobile hit areas
2. Tighten selector spacing and soften the footer treatment
3. Avoid changing emitted events, variant resolution, or loading behavior

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/order/__tests__/ProductBindingSection.variant-status.test.js src/components/order/ProductBindingSection.vue
git commit -m "refactor: polish product binding mobile interactions"
```

### Task 3: Verify no regressions in component behavior

**Files:**

- Test: `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`

**Step 1: Run the focused test suite**

Run:

```bash
pnpm test:unit src/components/order/__tests__/ProductBindingSection.variant-status.test.js
```

Expected: PASS with the new layout assertions and the existing behavior assertions all green.

**Step 2: Run a related resilience test**

Run:

```bash
pnpm test:unit src/views/sales/__tests__/SalesFormView.resilience.test.js
```

Expected: PASS to confirm the parent sales flow still tolerates the updated component structure.

**Step 3: Commit**

```bash
git add src/components/order/ProductBindingSection.vue src/components/order/__tests__/ProductBindingSection.variant-status.test.js
git commit -m "test: verify product binding mobile ux refinement"
```
