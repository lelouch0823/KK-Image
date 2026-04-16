# AI Action Orchestrator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a maintainable AI action system that supports synonym-aware query routing, explicit create workflows for customer/product/order/purchase order/salesperson, and a reusable app-wide refresh bus.

**Architecture:** Split the work into two rails. Rail 1 adds a reusable frontend refresh bus and migrates notification-driven refreshes onto it. Rail 2 adds backend action orchestration with D1-backed action sessions, entity adapters, structured SSE events, and frontend action cards for slot collection, preview, confirmation, success, and silent module refresh. Preserve API-first execution and explicit confirmation as hard safety boundaries.

**Tech Stack:** Cloudflare Workers (Hono), D1 SQL migrations, Vue 3 composables/components, Vitest, existing AI stream infrastructure.

---

### Task 1: Add the Reusable App Refresh Bus (TDD)

**Files:**
- Create: `src/composables/useAppRefreshBus.js`
- Create: `src/composables/__tests__/useAppRefreshBus.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { useAppRefreshBus } from '../useAppRefreshBus.js';

describe('useAppRefreshBus', () => {
  it('publishes refresh events to matching module subscribers', () => {
    const { publishRefresh, subscribeModule } = useAppRefreshBus();
    const handler = vi.fn();
    const stop = subscribeModule('orders', handler);

    publishRefresh({ module: 'orders', reason: 'ai_created', entityId: 'ord-1' });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'orders', reason: 'ai_created', entityId: 'ord-1' })
    );

    stop();
  });

  it('ignores non-matching module events', () => {
    const { publishRefresh, subscribeModule } = useAppRefreshBus();
    const handler = vi.fn();
    subscribeModule('customers', handler);

    publishRefresh({ module: 'orders', reason: 'notification' });

    expect(handler).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAppRefreshBus.test.js`
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```js
import { shallowRef } from 'vue';

const lastRefreshEvent = shallowRef(null);
const listeners = new Map();

export function useAppRefreshBus() {
  const publishRefresh = (event) => {
    const payload = {
      timestamp: Date.now(),
      silent: true,
      ...event,
    };
    lastRefreshEvent.value = payload;
    const set = listeners.get(payload.module);
    if (set) {
      for (const listener of set) listener(payload);
    }
  };

  const subscribeModule = (module, handler) => {
    const key = String(module || '');
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(handler);
    return () => listeners.get(key)?.delete(handler);
  };

  return { lastRefreshEvent, publishRefresh, subscribeModule };
}
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAppRefreshBus.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useAppRefreshBus.js src/composables/__tests__/useAppRefreshBus.test.js
git commit -m "test+feat: add reusable app refresh bus"
```

---

### Task 2: Migrate Notification Refreshes to the New Bus (TDD)

**Files:**
- Modify: `src/composables/useNotifications.js`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/views/Sales.vue`
- Create: `src/composables/__tests__/useNotifications.refresh-bus.test.js`

**Step 1: Write the failing test**

```js
it('publishes an orders refresh event when unread notification count increases', async () => {
  // mock publishRefresh and verify { module: 'orders', reason: 'notification' }
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useNotifications.refresh-bus.test.js`
Expected: FAIL because notifications still only mutate `lastNotificationTime`.

**Step 3: Write minimal implementation**

```js
import { useAppRefreshBus } from './useAppRefreshBus';

const { publishRefresh } = useAppRefreshBus();

if (newUnreadCount > unreadCount.value) {
  publishRefresh({ module: currentMode === 'sales' ? 'salesOrders' : 'orders', reason: 'notification' });
}
```

Update consumers to subscribe to module refreshes instead of watching `lastNotificationTime` directly:

```js
const { subscribeModule } = useAppRefreshBus();
let stopRefreshSubscription = null;

onMounted(() => {
  stopRefreshSubscription = subscribeModule('orders', () => {
    if (!showEditModal.value && !showDetailModal.value && !showCreateModal.value) {
      refreshOrders();
    }
  });
});

onUnmounted(() => stopRefreshSubscription?.());
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useNotifications.refresh-bus.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useNotifications.js src/components/OrderManager.vue src/views/Sales.vue src/composables/__tests__/useNotifications.refresh-bus.test.js
git commit -m "refactor: route notification refreshes through app refresh bus"
```

---

### Task 3: Add D1-Backed AI Action Sessions (TDD)

**Files:**
- Create: `migrations/0049_ai_action_sessions.sql`
- Create: `functions/ai/action-session-store.js`
- Create: `functions/ai/__tests__/action-session-store.test.js`
- Modify: `docs/DATABASE_SCHEMA.md`

**Step 1: Write the failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { D1ActionSessionStore } from '../action-session-store.js';

describe('D1ActionSessionStore', () => {
  it('creates a new action session with collecting status', async () => {
    // expect insert payload includes entity_type, action_type, status
  });

  it('updates slots and status for an existing session', async () => {
    // expect update statement persists slots_json and status
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-session-store.test.js`
Expected: FAIL with missing module/class.

**Step 3: Write minimal implementation**

```js
export class D1ActionSessionStore {
  constructor(db) {
    this.db = db;
  }

  async createSession(payload) {
    // insert row with collecting status and timestamps
  }

  async getLatestActiveSession(userId) {
    // read latest non-expired non-completed session
  }

  async updateSession(id, patch) {
    // update status, slots_json, preview_json, updated_at
  }
}
```

Write migration:

```sql
CREATE TABLE IF NOT EXISTS ai_action_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  status TEXT NOT NULL,
  slots_json TEXT NOT NULL DEFAULT '{}',
  preview_json TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_action_sessions_user_updated
ON ai_action_sessions(user_id, updated_at DESC);
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-session-store.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add migrations/0049_ai_action_sessions.sql functions/ai/action-session-store.js functions/ai/__tests__/action-session-store.test.js docs/DATABASE_SCHEMA.md
git commit -m "test+feat: add ai action session storage"
```

---

### Task 4: Build Synonym Canonicalization and Entity Adapter Registry (TDD)

**Files:**
- Create: `functions/ai/canonicalization.js`
- Create: `functions/ai/action-registry.js`
- Create: `functions/ai/adapters/customer.js`
- Create: `functions/ai/adapters/order.js`
- Create: `functions/ai/adapters/product.js`
- Create: `functions/ai/adapters/purchase-order.js`
- Create: `functions/ai/adapters/salesperson.js`
- Create: `functions/ai/__tests__/canonicalization.test.js`
- Create: `functions/ai/__tests__/action-registry.test.js`

**Step 1: Write the failing tests**

```js
it('maps 规格 and 商品规格 to variant semantics', () => {
  expect(canonicalizeBusinessText('这个商品规格有哪些')).toEqual(
    expect.objectContaining({ normalizedTerms: expect.arrayContaining(['variant']) })
  );
});

it('maps 业务员 to salesperson create entity', () => {
  expect(detectCreateIntent('帮我新增一个业务员')).toEqual(
    expect.objectContaining({ entityType: 'salesperson', actionType: 'create_salesperson' })
  );
});

it('returns required slots and target module for product adapter', () => {
  const adapter = getActionAdapter('product');
  expect(adapter.requiredSlots).toContain('variants');
  expect(adapter.targetModule).toBe('products');
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/canonicalization.test.js functions/ai/__tests__/action-registry.test.js`
Expected: FAIL with missing canonicalizer/registry.

**Step 3: Write minimal implementation**

```js
const TERM_MAP = [
  { aliases: ['规格', '商品规格', '款式规格'], canonical: 'variant' },
  { aliases: ['业务员', '销售员', '导购'], canonical: 'salesperson' },
  { aliases: ['备货单', '补货单', '采购单'], canonical: 'purchase_order' },
];

export function canonicalizeBusinessText(text = '') {
  // return normalized terms and matched aliases
}

export function detectCreateIntent(text = '') {
  // detect create + entity using alias map
}
```

Adapters should export:

```js
export const productActionAdapter = {
  entityType: 'product',
  actionType: 'create_product',
  targetModule: 'products',
  requiredSlots: ['name', 'currency', 'variants'],
  optionalSlots: ['spu', 'brand', 'category', 'description', 'dimensions'],
};
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/canonicalization.test.js functions/ai/__tests__/action-registry.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/ai/canonicalization.js functions/ai/action-registry.js functions/ai/adapters functions/ai/__tests__/canonicalization.test.js functions/ai/__tests__/action-registry.test.js
git commit -m "test+feat: add ai canonicalization and entity adapter registry"
```

---

### Task 5: Implement the AI Action Orchestrator Core (TDD)

**Files:**
- Create: `functions/ai/action-orchestrator.js`
- Create: `functions/ai/__tests__/action-orchestrator.test.js`

**Step 1: Write the failing tests**

```js
it('returns slot_request when required fields are missing', async () => {
  // create_order with only productName should request salespersonId
});

it('returns action_preview when required fields are complete', async () => {
  // complete customer payload should produce preview summary without submitting
});

it('submits only after explicit confirmation in awaiting_confirmation state', async () => {
  // confirmation text outside preview state must not submit
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-orchestrator.test.js`
Expected: FAIL with missing orchestrator.

**Step 3: Write minimal implementation**

```js
export class AIActionOrchestrator {
  constructor({ sessionStore, registry, submitters }) {
    this.sessionStore = sessionStore;
    this.registry = registry;
    this.submitters = submitters;
  }

  async advance({ userId, text, confirmation, context }) {
    // load or create session
    // merge slots
    // compute missing slots
    // return slot_request or action_preview
    // require explicit confirmation before submit
  }
}
```

Return shapes:

```js
{ kind: 'slot_request', session, prompt, fields }
{ kind: 'action_preview', session, title, summary, submitLabel }
{ kind: 'action_submitted', session, createdEntityId, targetModule, successMessage }
```

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-orchestrator.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/ai/action-orchestrator.js functions/ai/__tests__/action-orchestrator.test.js
git commit -m "test+feat: add ai action orchestrator core"
```

---

### Task 6: Add API-First Create Submitters for the Five Entities (TDD)

**Files:**
- Create: `functions/ai/action-submitters.js`
- Create: `functions/ai/__tests__/action-submitters.test.js`
- Modify: `functions/lib/hono/routes/manage/customers.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js`
- Modify: `functions/lib/hono/routes/manage/salespersons.js`

**Step 1: Write the failing tests**

```js
it('builds customer create payload from normalized slots', async () => {
  // submit create_customer through system boundary and return target module customers
});

it('builds product create payload with at least one variant', async () => {
  // reject when variants empty; allow valid variant array
});

it('routes purchase-order from-orders mode to the correct endpoint', async () => {
  // mode=from_orders -> POST /from-orders semantics
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-submitters.test.js`
Expected: FAIL with missing submitter implementations.

**Step 3: Write minimal implementation**

```js
export function createActionSubmitters(deps) {
  return {
    async create_customer(slots) {
      return deps.customerRepo.create(/* mapped payload */);
    },
    async create_product(slots) {
      if (!Array.isArray(slots.variants) || slots.variants.length === 0) {
        throw new Error('At least one variant is required');
      }
      return deps.productService.create(/* mapped payload */);
    },
    // order / purchase order / salesperson
  };
}
```

Keep route/service boundaries intact. If helper extraction is needed to avoid calling HTTP from the worker to itself, extract reusable create functions from current route code into shared helpers and keep routes delegating to those helpers.

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-submitters.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/ai/action-submitters.js functions/ai/__tests__/action-submitters.test.js functions/lib/hono/routes/manage/customers.js functions/lib/hono/routes/manage/products/index.js functions/lib/hono/routes/manage/orders/create.js functions/lib/hono/routes/manage/purchase-orders.js functions/lib/hono/routes/manage/salespersons.js
git commit -m "test+feat: add api-first ai create submitters"
```

---

### Task 7: Integrate Structured Action Events into the AI Route (TDD)

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/api/utils/ai-prompts.js`
- Create: `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`

**Step 1: Write the failing tests**

```js
it('streams slot_request when create intent lacks required slots', async () => {
  // POST /stream with "帮我创建订单" should emit slot_request event
});

it('streams action_preview before submission', async () => {
  // enough customer fields -> emit action_preview and no create call yet
});

it('streams action_submitted and module_refresh after explicit confirmation', async () => {
  // confirmation round -> emits success + refresh event
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`
Expected: FAIL because route only supports text/tool streaming today.

**Step 3: Write minimal implementation**

Add action branch ahead of normal query flow:

```js
const actionResult = await orchestrator.advance({
  userId: user?.id,
  text: latestUserText,
  context: clientContext,
});

if (actionResult) {
  await stream.writeSSE({ event: actionResult.kind, data: JSON.stringify(actionResult.payload) });
  if (actionResult.kind === 'action_submitted') {
    await stream.writeSSE({
      event: 'module_refresh',
      data: JSON.stringify({
        module: actionResult.payload.targetModule,
        reason: 'ai_created',
        entityId: actionResult.payload.createdEntityId,
      }),
    });
  }
  return;
}
```

Strengthen the system prompt so the model understands that create workflows are orchestrated by the system and must not self-submit.

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/ai.js functions/api/utils/ai-prompts.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js
git commit -m "test+feat: add structured ai action events to manage ai route"
```

---

### Task 8: Add Frontend Action Cards and Wire Module Refresh Consumption (TDD)

**Files:**
- Modify: `src/composables/useAIStream.js`
- Modify: `src/components/common/AIChatWidget.vue`
- Create: `src/components/common/ai/ActionPreviewCard.vue`
- Create: `src/components/common/ai/SlotQuestionCard.vue`
- Create: `src/components/common/ai/ActionResultCard.vue`
- Create: `src/composables/__tests__/useAIStream.actions.test.js`
- Modify: `src/views/Customers.vue`
- Modify: `src/components/ProductManager.vue`
- Modify: `src/components/OrderManager.vue`
- Modify: `src/views/PurchaseOrders.vue`
- Modify: `src/components/SalespersonManager.vue`

**Step 1: Write the failing tests**

```js
it('captures slot_request, action_preview, action_submitted, and module_refresh events from SSE', async () => {
  // expect composable state to store latest action event payloads
});

it('publishes module_refresh to the app refresh bus', async () => {
  // expect AI stream consumer to call publishRefresh({ module: 'orders', reason: 'ai_created' })
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIStream.actions.test.js`
Expected: FAIL because action events are not parsed/stored yet.

**Step 3: Write minimal implementation**

In `useAIStream.js`:

```js
const actionCard = ref(null);

if (event.type === 'slot_request') {
  actionCard.value = { type: 'slot_request', ...event.data };
}
if (event.type === 'action_preview') {
  actionCard.value = { type: 'action_preview', ...event.data };
}
if (event.type === 'action_submitted') {
  actionCard.value = { type: 'action_result', ...event.data };
}
if (event.type === 'module_refresh') {
  publishRefresh(event.data);
}
```

In `AIChatWidget.vue`, render action cards above or inside the latest assistant message block using the structured action state.

Update the five target modules to subscribe to their own refresh keys and silently reload when active.

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIStream.actions.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useAIStream.js src/components/common/AIChatWidget.vue src/components/common/ai/ActionPreviewCard.vue src/components/common/ai/SlotQuestionCard.vue src/components/common/ai/ActionResultCard.vue src/composables/__tests__/useAIStream.actions.test.js src/views/Customers.vue src/components/ProductManager.vue src/components/OrderManager.vue src/views/PurchaseOrders.vue src/components/SalespersonManager.vue
git commit -m "test+feat: add ai action cards and module refresh consumption"
```

---

### Task 9: Expand Query Coverage with API-First Canonical Routing (TDD)

**Files:**
- Modify: `functions/utils/ai-tool-executor.js`
- Modify: `functions/api/utils/ai-prompts.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Create: `functions/utils/__tests__/ai-tool-executor.canonicalization.test.js`

**Step 1: Write the failing tests**

```js
it('resolves 规格 queries toward variant search/detail flows', async () => {
  // canonical variant terms should prefer searchVariants/getVariantDetail
});

it('adds coverage for purchase-order suggestions and customer-order lookups', async () => {
  // expect new tool handlers to delegate to repo/service helpers
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/utils/__tests__/ai-tool-executor.canonicalization.test.js`
Expected: FAIL with missing handlers or canonical behavior.

**Step 3: Write minimal implementation**

Add new read helpers:

```js
case 'getDashboardOverview':
case 'getCustomerOrders':
case 'getPurchaseSuggestions':
```

Adjust prompt guidance and routing helpers so canonicalized variant/product/purchase-order terms guide tool selection more deterministically.

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/utils/__tests__/ai-tool-executor.canonicalization.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/utils/ai-tool-executor.js functions/api/utils/ai-prompts.js functions/lib/hono/routes/manage/ai.js functions/utils/__tests__/ai-tool-executor.canonicalization.test.js
git commit -m "test+feat: expand ai query coverage with canonical api-first routing"
```

---

### Task 10: Verification and Final Integration Check

**Files:**
- Modify: `docs/plans/2026-03-09-ai-action-orchestrator-implementation-plan.md` (append verification notes if needed)

**Step 1: Run targeted backend tests**

Run:
```bash
node node_modules/vitest/vitest.mjs run \
  functions/ai/__tests__/action-session-store.test.js \
  functions/ai/__tests__/canonicalization.test.js \
  functions/ai/__tests__/action-registry.test.js \
  functions/ai/__tests__/action-orchestrator.test.js \
  functions/ai/__tests__/action-submitters.test.js \
  functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js \
  functions/utils/__tests__/ai-tool-executor.canonicalization.test.js
```
Expected: all PASS.

**Step 2: Run targeted frontend tests**

Run:
```bash
node node_modules/vitest/vitest.mjs run \
  src/composables/__tests__/useAppRefreshBus.test.js \
  src/composables/__tests__/useNotifications.refresh-bus.test.js \
  src/composables/__tests__/useAIStream.actions.test.js
```
Expected: all PASS.

**Step 3: Run focused lint on touched surfaces**

Run:
```bash
pnpm lint src/composables src/components/common src/components src/views functions/lib/hono/routes/manage functions/ai functions/utils
```
Expected: PASS or only pre-existing unrelated failures.

**Step 4: Manual smoke checklist**

1. Ask AI to create a customer with only a partial name and verify it asks follow-up questions.
2. Ask AI to create a salesperson and verify password is previewed in masked form before submit.
3. Ask AI to create an order with "规格" language and verify it routes to variant-aware lookup before preview.
4. Ask AI to create a purchase order from orders and verify success emits a silent `purchaseOrders` refresh.
5. Confirm that active customers/products/orders/purchase-orders/salespersons views reload without full-page refresh.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-09-ai-action-orchestrator-implementation-plan.md
git commit -m "docs: add verification notes for ai action orchestrator rollout"
```
