# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

---

## Convention: Automation Selectors On Composite Controls

**What**: Composite inputs must expose stable `data-testid` hooks on a predictable wrapper, while automation should select the real interactive element by its ARIA role inside that wrapper.

**Why**: Components such as `Select` render a wrapper, a trigger, and teleported options. Treating every trigger or option as a generic `button` caused false smoke-test timeouts when the component correctly used `role="combobox"` and `role="option"`.

**Example**:

```js
const select = page.getByTestId('product-import-spec-column-0');
const trigger = select.getByRole('combobox');
const triggerId = await trigger.getAttribute('id');

await trigger.click();
await page
  .locator(`[data-select-id="${triggerId}"]`)
  .getByRole('option', { name: '颜色', exact: true })
  .click();
```

**Checklist**:

- Forward attrs such as `data-testid` intentionally when a component uses `inheritAttrs: false`.
- Prefer `getByRole('combobox')`, `getByRole('option')`, `getByRole('textbox')`, etc. over broad button/text selectors.
- For teleported popovers, bind a stable relationship such as `data-select-id="<trigger-id>"` and scope option selection to that popover.
- After debounced search/filter input, wait for the relevant API response or visible row before asserting detail content.

---

## Convention: Vue SFC Syntax Must Match ESLint Support

**What**: Do not add TypeScript-only syntax inside `.vue` files while the project ESLint stack lacks a TypeScript parser for SFC scripts.

**Why**: The current `pnpm lint` command runs ESLint across `src/**/*.vue` with the JavaScript parser. TypeScript constructs such as `defineProps<T>()`, `defineEmits<T>()`, `interface`, `as` assertions, typed parameters, `Record<string, string>`, and `import type` make lint fail with parsing errors even if Vite can compile them.

**Required pattern**:

```js
const props = defineProps({
  orderId: { type: String, required: true },
  initialItems: { type: Array, default: null },
});

const emit = defineEmits(['updated']);
```

**Checklist**:

- Use runtime `defineProps({ ... })` and `defineEmits([...])` in `.vue` files.
- Keep SFC helper maps and function signatures as plain JavaScript.
- If the project adopts TypeScript SFC syntax later, add and validate the matching ESLint parser/config in the same change.

---

## Convention: Audit Log Tables Render Display Fields

**What**: Audit log UI must render normalized display fields from `src/utils/audit-log.ts` instead of raw backend codes.

**Why**: Backend audit fields such as `action`, `target_type`, `changes_json`, and `metadata_json` are storage/filtering contracts. Showing raw values like `admin.auth.login`, `purchase_order.item.delete`, or JSON blobs leaks implementation detail into the admin UI.

**Required pattern**:

```js
logs.value = (json.data || []).map((row) => normalizeAuditRow(row));
```

Render:

```vue
{{ row.action_display }}
{{ row.target_display }}
{{ row.details_display }}
```

Use raw fields only for behavior that needs backend contracts, such as action filtering, badge tone selection, or debug titles:

```js
{ value: action, label: formatAuditAction(action) }
```

**Checklist**:

- Add or update mappings in `src/utils/audit-log.ts` when introducing new audit action families.
- Keep action filter option `value` as the raw action code, but show a friendly `label`.
- Keep detail formatting resilient to malformed legacy JSON.
- Add regression tests in the audit behavior tests when changing action, target, summary, or details display.

---

## Convention: Operational Event UI Renders Display Labels

**What**: Admin-facing operational pages must not render backend event codes, consumer statuses, run modes, environments, or raw JSON responses as the default user experience.

**Why**: Fields such as `event_type`, `consumer_name`, outbox job `status`, backup restore `mode`, and restore/replay response objects are backend contracts. Showing values like `purchase_receipt_recorded`, `notification · failed`, `dry_run`, or JSON dumps makes operational workflows harder to scan and leaks implementation detail.

**Required pattern**:

```js
import { formatDomainEventType, formatConsumerJobLabel } from '@/utils/event-display';
```

Render display values:

```vue
{{ formatDomainEventType(event.event_type) }}
{{ formatConsumerJobLabel(job) }}
```

Use structured summary rows for result objects:

```js
const replayResultRows = computed(() => buildReplayResultSummaryRows(props.lastReplayResult));
```

Raw values may still be used for API filters, badge tone selection, IDs, titles, or debug-only affordances.

**Checklist**:

- Add new backend event labels to `src/utils/event-display.ts` when exposing an event to Outbox, Webhook, notifications, or inventory movement UI.
- Keep filter option `value` as the backend contract, but show a friendly `label`.
- Render replay/restore results as summary rows instead of default `<pre>{{ JSON.stringify(...) }}</pre>`.
- Unknown enum values must degrade to readable text, not raw snake_case/dotted codes.
- Add focused component or formatter tests when changing event, consumer, mode, environment, or result summaries.

---

## Convention: Chart.js Config Assembly Lives In Tested Helpers

**What**: Views that render Chart.js charts should keep DOM refs, instance creation, and destroy lifecycle in the Vue SFC, but move data normalization, theme palette resolution, status labels, and Chart.js config object construction into a utility module.

**Why**: Large inline chart configs make dashboards expensive to change and hard to test. Keeping pure assembly logic in helpers lets unit tests cover labels, values, CSS token fallbacks, responsive options, and user-facing enum labels without mounting the full page.

**Required pattern**:

```js
import {
  buildSalesTrendChartConfig,
  createLineChartGradient,
  getDashboardChartPalette,
} from '@/utils/dashboard-charts';

const canvas = salesTrendChartRef.value;
const ctx = canvas.getContext('2d');
const palette = getDashboardChartPalette();

charts.salesTrendChart = new Chart(
  ctx,
  buildSalesTrendChartConfig({
    data: salesTrendData.value,
    t,
    palette,
    backgroundColor: createLineChartGradient(ctx, palette.primary),
    isMobile: window.innerWidth < 640,
  })
);
```

**Checklist**:

- Use Vue `ref` canvas handles instead of `document.getElementById` in views.
- Destroy existing Chart instances before recreating them and reset the stored instance to `null`.
- Keep `.vue` scripts plain JavaScript; put TypeScript helper types in `.ts` utility files.
- Reuse shared display helpers such as `formatOrderStatusLabel` for chart labels instead of duplicating enum maps in the view.
- Add focused utility tests for chart series shaping, status labels, color fallbacks, and responsive config differences.

---

## Convention: Auth Request Abort Signals Preserve Timeouts

**What**: Protected frontend requests must keep both logout abort behavior and request timeout behavior active, even when a caller supplies its own `AbortSignal`.

**Why**: Passing a caller signal straight through `authFetch()` can bypass global logout cancellation or disable the timeout path in `request()`. That leaves protected requests alive after logout or allows hung requests to wait forever.

**Required behavior**:

```ts
await authFetch('/api/manage/example', {
  signal: localAbortController.signal,
  timeout: 30000,
});
```

The request must abort when any of these happens:

- The caller aborts `localAbortController`.
- Logout aborts the shared auth controller.
- The configured timeout expires.

**Checklist**:

- Compose caller and auth/logout signals before calling `request()`.
- In `request()`, compose the supplied signal with the timeout controller instead of skipping timeout when `options.signal` exists.
- Convert only timeout-triggered aborts to `AppError` with `code = 'TIMEOUT'`; preserve caller/logout aborts as abort errors.
- Add focused tests for timeout-with-signal and logout-with-caller-signal behavior when changing request wrappers.

---

## Convention: Protected APIs Use Auth Request Wrappers

**What**: Admin/protected frontend calls to `/api/manage/*` or other cookie-authenticated routes must go through `authFetch`, `authFetchJson`, or a composable that wraps them.

**Why**: Direct `fetch()` can bypass shared 401 auth-state reset, timeout behavior, abort handling, and protected-fetch QA guards.

**Required pattern**:

```js
const { authFetchJson } = useAuth();
const result = await authFetchJson('/api/manage/products');
```

**Forbidden pattern**:

```js
await fetch('/api/manage/products', { credentials: 'include' });
```

**Checklist**:

- Use direct `fetch()` only for public/token endpoints or documented browser-only fetches.
- Run `pnpm qa:check-direct-protected-fetch` after touching request code.
- Add a focused component/composable test when migrating direct protected calls to wrappers.

---

## Scenario: PWA Runtime Cache Excludes Private APIs

### 1. Scope / Trigger

- Trigger: Any change to `vite.config.js` Workbox `runtimeCaching`, service-worker registration, or frontend API cache policy.

### 2. Signatures

- Config surface: `VitePWA({ workbox: { runtimeCaching: [...] } })`.
- Protected endpoint classes: `/api/manage/*`, `/api/v1/auth/*`, `/api/notifications*`, and other cookie-authenticated user/admin data.

### 3. Contracts

- Private API responses must not be cached by the service worker.
- Runtime caches may include static assets and explicitly public, share-token-safe resources only.
- If a public API is cached, its route pattern must be narrow and documented in the same change.

### 4. Validation & Error Matrix

- Broad `/\/api\/.*$/` runtime cache -> reject in review.
- Cache-first/network-first private API route -> reject in review.
- Narrow public route with bounded TTL and tests -> acceptable.

### 5. Good/Base/Bad Cases

- Good: cache `/file/*` or an explicitly public immutable endpoint with a short TTL and a test.
- Base: no API runtime caching.
- Bad: cache every `/api/*` response for five minutes.

### 6. Tests Required

- Add or update a config test asserting private API routes are not present in Workbox runtime caches.
- Run `pnpm build` after PWA config changes.

### 7. Wrong vs Correct

#### Wrong

```js
{ urlPattern: /\/api\/.*$/i, handler: 'NetworkFirst' }
```

#### Correct

```js
// No broad API cache. Add only narrow public endpoint patterns when needed.
runtimeCaching: [/* static/public-only entries */]
```

---

## Convention: New Tabs Use Noopener Protection

**What**: New browser tabs/windows opened from app code must use `noopener,noreferrer` semantics.

**Why**: User-controlled file/share/report URLs opened with `_blank` can otherwise retain access to `window.opener`.

**Required pattern**:

```ts
openInNewTab(url);
```

or for anchors:

```vue
<a :href="url" target="_blank" rel="noopener noreferrer">...</a>
```

**Checklist**:

- Search for `window.open` and `target="_blank"` when adding new tab behavior.
- Prefer the shared browser helper for imperative opens.
- Add a helper test when changing new-tab security behavior.

---

## Convention: Design Tokens — No Hardcoded Values

**What**: All frontend styling must use the design token system (`src/styles/tokens/`) and Tailwind utility classes. No hardcoded hex colors, font sizes, or inline `:style` bindings for static token values.

**Why**: Hardcoded values bypass the three-tier token architecture (primitive → semantic → dark theme), break dark mode, and make system-wide style changes impossible.

**Token Architecture**:

| Layer | File | Purpose |
|-------|------|---------|
| Primitive | `tokens/primitive.css` | Raw palette, radii, shadows, font-size scale |
| Semantic | `tokens/semantic.css` | Light-mode contextual aliases (bg/border/text) |
| Dark Theme | `tokens/themes.css` | `.dark` overrides for all semantic tokens |
| Motion | `tokens/motion.css` | Transition timing tokens |
| Charts | `tokens/charts.css` | Chart color palette |

**Required pattern**:

```vue
<!-- ✅ Tailwind utility with token reference -->
<div class="bg-(--bg-card) text-(--text-main) border-(--border-color)">

<!-- ❌ Inline style with static token -->
<div :style="{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }">

<!-- ❌ Hardcoded hex -->
<div style="color: #6b7280">
```

**Font-size tokens** (registered in `primitive.css`):

| Token | Value | Tailwind |
|-------|-------|----------|
| `--text-[10px]` | 0.625rem | `text-[10px]` |
| `--text-xs` | 0.75rem | `text-xs` |
| `--text-sm` | 0.875rem | `text-sm` |
| `--text-base` | 1rem | `text-base` |
| `--text-lg` | 1.125rem | `text-lg` |
| `--text-xl` | 1.25rem | `text-xl` |

**Border-radius convention**: Card-level containers use `rounded-2xl`. Smaller elements (icons, badges, buttons) use `rounded-lg` or `rounded-xl` as appropriate.

**Legitimate inline `:style`** (allowed):

- Dynamic computed values (progress bars, virtual scroll, drag position)
- User-configured values (print accent color, custom themes)
- CSS calculations that depend on runtime data

**Checklist**:

- Search for `:style` bindings — static token references must be Tailwind utility classes.
- Search for hex color literals (`#xxx`, `#xxxxxx`) — replace with token references.
- Search for `text-[Npx]` arbitrary values — use standard scale or register a new token.
- Verify card containers use `rounded-2xl`.
- Run `pnpm qa:check-design-system` after styling changes.
