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
