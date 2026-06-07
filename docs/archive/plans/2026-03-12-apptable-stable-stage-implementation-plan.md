# AppTable Stable Stage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `AppTable` from a content-height-driven table into a stable management-list stage with predictable height, sparse-data fill behavior, and footer anchoring suitable for KK-Image's business admin flows.

**Architecture:** Keep the change centered in the shared `AppTable` primitive so all management pages inherit the new behavior without page-by-page layout rewrites. Lock the new contract with focused design tests first, then add the minimum new props and internal state branches needed for `loading`, `empty`, `sparse`, and `normal` stage behavior. Leave page-specific pagination wiring unchanged unless a focused regression test proves a page depends on the old collapsing layout.

**Tech Stack:** Vue 3 SFCs, Vue Test Utils, Vitest, Tailwind utility classes, existing `AppIcon` and optional footer slot composition

---

### Task 1: Lock the stable stage design contract

**Files:**

- Modify: `src/components/ui/__tests__/AppTable.design-contract.test.js`
- Reference: `src/components/ui/AppTable.vue`

**Step 1: Write the failing test**

Extend the design-contract test with assertions for the new stage behavior. Add a case like:

```js
it('keeps a stable stage height and sparse fill region for low row counts', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [{ id: 1, name: 'Alpha' }],
    },
    slots: {
      footer: '<div data-test="footer">Pagination</div>',
    },
  });

  expect(wrapper.get('[data-table-stage]').classes()).toContain('app-table__stage');
  expect(wrapper.get('[data-table-stage-mode="sparse"]').exists()).toBe(true);
  expect(wrapper.get('[data-table-sparse-fill]').exists()).toBe(true);
  expect(wrapper.get('[data-table-footer]').exists()).toBe(true);
});
```

Add a second case asserting empty state still renders inside the same stage shell:

```js
it('keeps empty state inside the stable stage shell', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [],
    },
  });

  expect(wrapper.get('[data-table-stage-mode="empty"]').exists()).toBe(true);
  expect(wrapper.get('[data-table-stage]').classes()).toContain('app-table__stage');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: FAIL because `data-table-stage`, `data-table-stage-mode`, or sparse-fill hooks do not exist yet.

**Step 3: Write minimal implementation**

Do not add behavior beyond the test surface yet. Add stable DOM hooks and classes in `AppTable.vue`:

- Wrap the scroll/table area in a dedicated stage container with `data-table-stage`
- Expose stage mode with `data-table-stage-mode`
- Add a sparse fill element with `data-table-sparse-fill`
- Add a footer wrapper with `data-table-footer`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/__tests__/AppTable.design-contract.test.js src/components/ui/AppTable.vue
git commit -m "test(ui): lock AppTable stable stage contract"
```

### Task 2: Add stage sizing props and sparse/empty state branching

**Files:**

- Modify: `src/components/ui/AppTable.vue`
- Modify: `src/components/ui/__tests__/AppTable.design-contract.test.js`

**Step 1: Write the failing test**

Add focused assertions for the new props and internal mode selection:

```js
it('uses sparse mode when data count is below the threshold', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ],
      sparseThreshold: 3,
      minRows: 7,
    },
  });

  expect(wrapper.get('[data-table-stage-mode="sparse"]').exists()).toBe(true);
  expect(wrapper.attributes('data-min-rows')).toBe('7');
});
```

Add a second case for normal mode:

```js
it('uses normal mode when data count exceeds the sparse threshold', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
      ],
      sparseThreshold: 3,
    },
  });

  expect(wrapper.get('[data-table-stage-mode="normal"]').exists()).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: FAIL because `minRows`, `sparseThreshold`, and computed stage-mode behavior do not exist.

**Step 3: Write minimal implementation**

In `AppTable.vue`:

- Add props:

```js
minRows: {
  type: Number,
  default: 7,
},
sparseThreshold: {
  type: Number,
  default: 3,
},
fillSparseSpace: {
  type: Boolean,
  default: true,
},
```

- Add computed state branches:

```js
const isEmpty = computed(() => !props.loading && (!props.data || props.data.length === 0));
const isSparse = computed(
  () => !props.loading && props.data.length > 0 && props.data.length <= props.sparseThreshold
);
const stageMode = computed(() => {
  if (props.loading) return 'loading';
  if (isEmpty.value) return 'empty';
  if (isSparse.value) return 'sparse';
  return 'normal';
});
```

- Bind `data-min-rows` on the outer table shell and `data-table-stage-mode` on the stage wrapper.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/__tests__/AppTable.design-contract.test.js src/components/ui/AppTable.vue
git commit -m "feat(ui): add AppTable stable stage state model"
```

### Task 3: Implement stable minimum stage height and sparse fill presentation

**Files:**

- Modify: `src/components/ui/AppTable.vue`
- Modify: `src/components/ui/__tests__/AppTable.design-contract.test.js`

**Step 1: Write the failing test**

Add a test that verifies the stage exposes a minimum-height style and sparse fill only when enabled:

```js
it('applies a stable minimum stage height derived from minRows', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [{ id: 1, name: 'Alpha' }],
      minRows: 6,
      estimateSize: 48,
    },
  });

  expect(wrapper.get('[data-table-stage]').attributes('style')).toContain('min-height');
});

it('can disable sparse fill for exception pages', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [{ id: 1, name: 'Alpha' }],
      fillSparseSpace: false,
    },
  });

  expect(wrapper.find('[data-table-sparse-fill]').exists()).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: FAIL because the stage has no `min-height` style and sparse fill is not conditional.

**Step 3: Write minimal implementation**

In `AppTable.vue`:

- Create a computed minimum stage height from header + row baseline:

```js
const stageMinHeight = computed(() => {
  const headerHeight = 52;
  const rowHeight = props.estimateSize || 48;
  return `${headerHeight + rowHeight * props.minRows}px`;
});
```

- Bind it to the stage wrapper:

```html
<div
  data-table-stage
  class="app-table__stage flex min-w-0 flex-col"
  :data-table-stage-mode="stageMode"
  :style="{ minHeight: stageMinHeight }"
></div>
```

- Render a low-emphasis sparse fill region only when:
  `stageMode === 'sparse' && fillSparseSpace`

- Style it as passive structure, not fake rows:
  `border-t`, very light background, `flex-1`, `pointer-events-none`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/__tests__/AppTable.design-contract.test.js src/components/ui/AppTable.vue
git commit -m "feat(ui): add AppTable sparse fill and stable stage height"
```

### Task 4: Anchor the footer and protect loading and empty-state stability

**Files:**

- Modify: `src/components/ui/AppTable.vue`
- Modify: `src/components/ui/__tests__/AppTable.design-contract.test.js`
- Reference: `src/views/Customers.vue`
- Reference: `src/views/PurchaseOrders.vue`

**Step 1: Write the failing test**

Add assertions that the footer wrapper is always rendered after the stage when a footer slot exists, and that loading mode uses the same stage shell:

```js
it('keeps the footer anchored below the stable stage', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [{ id: 1, name: 'Alpha' }],
    },
    slots: {
      footer: '<div data-test="footer">Footer</div>',
    },
  });

  const html = wrapper.html();
  expect(html.indexOf('data-table-stage')).toBeLessThan(html.indexOf('data-table-footer'));
});

it('uses the same stage shell in loading mode', () => {
  const wrapper = mount(AppTable, {
    props: {
      columns: [{ key: 'name', label: 'Name' }],
      data: [],
      loading: true,
    },
  });

  expect(wrapper.get('[data-table-stage-mode="loading"]').exists()).toBe(true);
  expect(wrapper.get('[data-table-stage]').classes()).toContain('app-table__stage');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: FAIL if loading bypasses the shared stage shell or footer placement is not explicitly anchored.

**Step 3: Write minimal implementation**

In `AppTable.vue`:

- Keep all table states inside the same `app-table__stage`
- Make the outer component a flex column surface so footer naturally anchors below the stage:

```html
<div class="app-table flex w-full flex-col overflow-hidden"></div>
```

- Make the stage `flex-1`
- Keep footer in a dedicated `data-table-footer` wrapper with the existing border rules

Do not introduce internal vertical scroll for standard mode.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/__tests__/AppTable.design-contract.test.js src/components/ui/AppTable.vue
git commit -m "feat(ui): anchor AppTable footer below stable stage"
```

### Task 5: Run focused regression coverage for representative management pages

**Files:**

- Modify: none unless regressions appear
- Reference: `src/views/__tests__/GoodsOverview.design-system-migration.test.js`
- Reference: `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
- Reference: `src/views/__tests__/Customers.create-success-ux.test.js`

**Step 1: Run the focused regression suite**

Run:

```bash
npx vitest run src/components/ui/__tests__/AppTable.design-contract.test.js src/views/__tests__/GoodsOverview.design-system-migration.test.js src/views/__tests__/PurchaseOrders.design-system-migration.test.js src/views/__tests__/Customers.create-success-ux.test.js
```

Expected: existing management-list and customer pagination behavior still passes while the new `AppTable` contract remains green.

**Step 2: Fix regressions if present**

If a page test fails:

- Prefer adjusting `AppTable.vue` structure or non-semantic classes
- Do not patch page-level layout unless the page is depending on collapsed table height as an implementation detail
- If a page truly needs exception behavior, route it through new props such as `fillSparseSpace={false}` instead of one-off CSS

**Step 3: Run the regression suite again**

Run the same command and confirm all tests pass.

**Step 4: Commit**

```bash
git add src/components/ui/AppTable.vue src/components/ui/__tests__/AppTable.design-contract.test.js
git commit -m "test(ui): verify stable AppTable stage across management pages"
```

### Task 6: Document the new AppTable contract for future page migrations

**Files:**

- Modify: `docs/architecture/modules/frontend-components.md`

**Step 1: Write the failing doc diff**

Add a short `AppTable` contract update describing:

- default `minRows: 7`
- default `sparseThreshold: 3`
- `fillSparseSpace` exception behavior
- standard business tables use pagination rather than internal vertical scrolling

**Step 2: Review the doc locally**

Run: `Get-Content -Path 'docs/architecture/modules/frontend-components.md'`

Expected: the `AppTable` section reflects the new stable-stage rules with no contradictory wording.

**Step 3: Write the minimal documentation update**

Update the `AppTable` subsection so future work does not reintroduce content-driven collapsing behavior.

**Step 4: Commit**

```bash
git add docs/architecture/modules/frontend-components.md
git commit -m "docs(ui): document AppTable stable stage contract"
```
