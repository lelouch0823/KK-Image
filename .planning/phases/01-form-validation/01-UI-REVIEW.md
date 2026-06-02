# Phase 01 — UI Review

**Audited:** 2026-06-02
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md found)
**Screenshots:** Not captured (no dev server detected on ports 3000/5173/8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | i18n system comprehensive; minor hardcoded Chinese strings in Dashboard charts |
| 2. Visuals | 3/4 | Strong design system with composed components; chart tooltips break in dark mode |
| 3. Color | 2/4 | Hardcoded hex colors in Chart.js configs bypass dark mode; good CSS variable usage elsewhere |
| 4. Typography | 3/4 | Consistent scale; text-[10px] used in 14+ locations below recommended minimum |
| 5. Spacing | 4/4 | Excellent Tailwind spacing discipline; minimal arbitrary values |
| 6. Experience Design | 4/4 | Comprehensive state coverage: loading, error, empty, disabled, confirmation dialogs |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Dashboard chart colors hardcoded for light mode only** — Charts (sales trend, status distribution) use white backgrounds (#fff, rgba(255,255,255,0.9)) and dark text (#1a1a1a, #666) that become invisible or unreadable in dark mode — Refactor `initSalesTrendChart()` and `initStatusDistributionChart()` in `src/views/Dashboard.vue:908-912,1008-1011` to read CSS custom properties via `getComputedStyle()` like the existing `resolveDashboardChartColor()` helper does for line colors.

2. **Status distribution pie chart labels hardcoded in Chinese** — `statusLabels` object at `src/views/Dashboard.vue:966-975` contains 8 hardcoded Chinese strings (e.g., '待处理', '已确认') that bypass the i18n system — Replace with `t()` calls using keys like `order.status.pending`, `order.status.confirmed`, etc. This affects the chart legend and tooltips in non-Chinese locales.

3. **text-[10px] used extensively for metadata labels** — 14+ instances of `text-[10px]` across Dashboard, Sales, FileManager, and order components — While these are not arbitrary spacing values (they follow a pattern), 10px is below the 12px recommended minimum for body text on mobile. Consider using `text-xs` (12px) as the floor, reserving `text-[10px]` only for decorative badges where readability is non-critical.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths:**
- Comprehensive i18n system with 28+ locale files per language (zh-CN, en)
- All user-facing strings use `t()` function with proper key structure
- Validation messages use parameterized templates (`{path} is required`)
- Empty states use descriptive, actionable copy (e.g., `t('dashboard.noPendingOrders')`)
- Confirmation dialogs have clear warning text with context

**Issues:**
- `src/views/Dashboard.vue:966-975`: 8 hardcoded Chinese status labels in `statusLabels` object
- `src/views/Dashboard.vue:769-774`: Same hardcoded labels in `updateCharts()` function
- `src/locales/en/common.js:21`: `noData: 'No Data'` — generic, could be more contextual per view
- `src/locales/zh-CN/common.js:21`: `noData: '暂无数据'` — same generic pattern

### Pillar 2: Visuals (3/4)

**Strengths:**
- Well-structured design system with `SurfaceSection`, `DashboardShell`, `ManagementListShell` patterns
- Consistent card styling with `rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-card`
- Clear visual hierarchy: PageHeader > StatePanel > Content areas
- StatusBadge component with tone system (neutral, primary, success, warning, danger, info)
- Responsive design with mobile-first approach (sidebar drawer, search overlay)

**Issues:**
- Chart tooltips use hardcoded white background (`rgba(255, 255, 255, 0.9)`) at lines 909, 1008
- Grid lines use `rgba(0,0,0,0.05)` which is invisible in dark mode (line 929)
- Tick colors `#9ca3af` hardcoded instead of using `--text-muted` (lines 922, 932)
- Legend color `#6b7280` hardcoded instead of using `--text-secondary` (line 1002)

### Pillar 3: Color (2/4)

**Strengths:**
- Excellent CSS custom property system: `primitive.css` → `semantic.css` → `themes.css`
- Dark mode fully supported with dedicated `.dark` class overrides
- Tone contract system (`toneContract.ts`) maps 6 canonical tones with consistent badge/surface/text classes
- Chart colors defined in `charts.css` using CSS variables (`--color-chart-1` through `--color-chart-5`)

**Issues (critical):**
- `src/views/Dashboard.vue:909`: `backgroundColor: 'rgba(255, 255, 255, 0.9)'` — tooltip background
- `src/views/Dashboard.vue:910`: `titleColor: '#1a1a1a'` — tooltip title
- `src/views/Dashboard.vue:911`: `bodyColor: '#666'` — tooltip body
- `src/views/Dashboard.vue:912`: `borderColor: '#e5e7eb'` — tooltip border
- `src/views/Dashboard.vue:922,932`: `color: '#9ca3af'` — axis tick labels
- `src/views/Dashboard.vue:929`: `color: 'rgba(0,0,0,0.05)'` — grid lines
- `src/views/Dashboard.vue:956-963`: Status colors hardcoded instead of using CSS variables
- `src/views/Dashboard.vue:1002`: Legend color `#6b7280` hardcoded
- `src/views/Dashboard.vue:1008-1011`: Duplicate tooltip hardcoded colors

Note: The project already has `resolveDashboardChartColor()` helper that correctly reads CSS variables for line chart colors (lines 848-851). This pattern should be extended to all chart configuration.

### Pillar 4: Typography (3/4)

**Font size distribution (non-test files):**
- `text-sm` (14px): 589 instances — primary body text
- `text-xs` (12px): 513 instances — secondary/metadata text
- `text-lg` (18px): 51 instances — section headings
- `text-base` (16px): 26 instances
- `text-xl` (20px): 22 instances — page titles
- `text-2xl` (24px): 17 instances
- `text-3xl` (30px): 10 instances — stat card values

**Font weight distribution:**
- `font-medium` (500): 466 instances — primary weight
- `font-semibold` (600): 256 instances — headings
- `font-bold` (700): 93 instances — emphasis
- `font-normal` (400): 6 instances

**Issues:**
- 14+ instances of `text-[10px]` (arbitrary, not in standard scale):
  - `src/views/Dashboard.vue:97,181,258` — metadata labels
  - `src/views/Sales.vue:141,149` — tab labels
  - `src/components/SubspaceList.vue:94,101` — status badges
  - `src/components/FileSelector.vue:126` — file names
  - `src/components/SpaceProductEditor.vue:60,65` — stock indicators
- Font size scale is otherwise consistent (7 sizes used)

### Pillar 5: Spacing (4/4)

**Spacing class distribution (top 10):**
- `gap-2` (8px): 288 instances
- `gap-3` (12px): 215 instances
- `p-4` (16px): 189 instances
- `px-2` (8px): 142 instances
- `p-1` (4px): 139 instances
- `py-2` (8px): 127 instances
- `px-3` (12px): 124 instances
- `py-0` (0px): 110 instances
- `px-0` (0px): 109 instances
- `px-4` (16px): 108 instances

**Strengths:**
- Uses Tailwind's 4px grid system consistently
- Minimal arbitrary values (only `text-[10px]` and `max-w-[150px]`/`max-w-[200px]` for truncation)
- Consistent padding/margin patterns across components
- Gap-based layout (flex/grid) preferred over margin-based

**Minor observations:**
- `max-w-[150px]`, `max-w-[180px]`, `max-w-[200px]` used for text truncation — acceptable for responsive constraints
- `min-h-[300px]`, `min-h-[400px]`, `h-[180px]` used for chart containers — necessary for Chart.js

### Pillar 6: Experience Design (4/4)

**State coverage:**
- Loading states: 743 instances across views (skeleton screens, spinners, `animate-pulse`)
- Error states: 663 instances (error messages, retry buttons, `PermissionDeniedState`)
- Empty states: 180 instances (`EmptyState` component with icon, title, description, action)
- Disabled states: 197 instances (`disabled` prop on buttons/inputs)
- Confirmation dialogs: 382 instances (`ConfirmDialog` for destructive actions)
- Accessibility: 56 ARIA attributes (`aria-label`, `aria-modal`, `aria-sort`, `role="alert"`)

**Strengths:**
- `AppInput` has built-in validation with debounced onChange, blur-triggered validation, and visual feedback (success/error icons)
- `Modal` component has focus trap, ESC key handling, backdrop click, scroll lock, and focus restoration
- `AppTable` has loading skeleton rows, empty state, virtual scrolling for large datasets, and sortable columns
- Logout requires confirmation dialog (`ConfirmDialog`)
- Order void requires confirmation with warning text
- Mobile-responsive: sidebar drawer, search overlay, responsive grid layouts
- Dark mode: full theme support via CSS custom properties

**Minor observations:**
- `handleRefresh` in Header uses `window.location.reload()` (line 244) — full page reload instead of data refetch
- Chart tooltips don't adapt to dark mode (covered in Color pillar)

---

## Files Audited

**Design Tokens:**
- `src/styles/tokens/primitive.css`
- `src/styles/tokens/semantic.css`
- `src/styles/tokens/themes.css`
- `src/styles/tokens/motion.css`
- `src/styles/tokens/charts.css`

**UI Primitives:**
- `src/components/ui/AppButton.vue`
- `src/components/ui/AppInput.vue`
- `src/components/ui/AppTable.vue`
- `src/components/ui/Modal.vue`
- `src/components/ui/EmptyState.vue`

**Design System:**
- `src/design-system/toneContract.ts`
- `src/design-system/composed/SurfaceSection.vue`
- `src/design-system/patterns/DashboardShell.vue`
- `src/design-system/patterns/ManagementListShell.vue`

**Views:**
- `src/views/Dashboard.vue`
- `src/views/Settings.vue`
- `src/views/Customers.vue` (partial)

**Layout:**
- `src/components/layout/Header.vue`
- `src/components/layout/Sidebar.vue`

**Locales:**
- `src/locales/zh-CN/common.js`
- `src/locales/en/common.js`

**Total frontend source files:** 427 (excluding tests)
