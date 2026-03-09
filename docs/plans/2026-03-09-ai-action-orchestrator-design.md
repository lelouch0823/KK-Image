# AI Action Orchestrator Design

**Date:** 2026-03-09

**Goal**

Upgrade the admin AI module from query-only assistance into a controlled action system that can understand business synonyms, prefer system APIs, guide users through missing information, generate a confirmation preview, execute create actions only after explicit confirmation, and silently refresh the relevant frontend module.

**Problem Summary**

The current AI stack can already query several business domains through tools, but its behavior still depends too heavily on prompt-only inference:

1. Domain synonyms such as "规格", "商品规格", and "变体" are not normalized in a stable, testable way.
2. API coverage is broader than the AI tool layer currently exposes, especially for dashboard, active variants, purchase-order suggestions, and related detail endpoints.
3. The AI has no structured create workflow. It cannot reliably collect missing fields, present a template preview, require explicit confirmation, and then execute a system create API.
4. The frontend has a notification-driven refresh signal, but it is coupled to notification semantics rather than a reusable project-wide refresh bus.

**Chosen Direction**

Adopt a structured action architecture instead of extending prompt-only tool calling:

1. Keep the existing AI query flow and expand it with better synonym normalization and API-first routing.
2. Introduce an `AI Action Orchestrator` that manages create sessions as explicit state machines.
3. Define entity adapters for the first five create-capable entities: customer, product, order, purchase order, and salesperson.
4. Add a reusable frontend refresh bus so notification updates, AI-created data, and future write flows can all refresh modules through one shared mechanism.

This approach is intentionally stricter than "let the model decide". It trades some short-term simplicity for predictable behavior, testability, and maintainability.

**Scope**

In scope:

1. AI-side synonym normalization and entity intent routing
2. Query coverage improvements for high-frequency domains
3. Structured create flows for customer, product, order, purchase order, and salesperson
4. Explicit missing-field questioning, preview, confirmation, submit, and success messaging
5. A reusable app-wide refresh bus consumed by AI and notification workflows
6. Backend session/orchestrator/adapter structure and frontend event-rendering support

Out of scope:

1. Update or delete actions
2. Arbitrary write access outside the supported entity set
3. Automatic file upload or media-binding side effects driven by AI
4. Replacing the current notification center UI

**Architecture**

### 1. Intent and Canonicalization Layer

Add a stable normalization layer ahead of tool execution and action orchestration.

Responsibilities:

1. Map domain synonyms into canonical business terms
2. Distinguish between query intent and create intent
3. Resolve ambiguous references using current page context when possible
4. Prefer system APIs and entity lookups over prompt-only inference

Examples:

1. "规格", "商品规格", and "款式规格" map to variant-oriented search/detail flows
2. "业务员" maps to salesperson
3. "补货单" and "备货单" map to purchase order

The output of this layer is not user-facing text. It is a normalized internal command such as:

1. `query.variant.search`
2. `create.order`
3. `create.purchase_order.from_orders`

### 2. AI Action Orchestrator

Introduce a dedicated orchestrator for write flows instead of embedding write logic inside prompts.

Core responsibilities:

1. Start or resume an action session
2. Track collected slots and missing slots
3. Decide the next question to ask
4. Build a preview payload when required slots are complete
5. Block submission until explicit confirmation
6. Execute the mapped create API
7. Emit success and refresh events

Recommended action states:

1. `collecting`
2. `previewing`
3. `awaiting_confirmation`
4. `submitting`
5. `completed`
6. `cancelled`

This state machine is the core guardrail that keeps the AI from free-form auto-submitting records.

### 3. Entity Adapters

Each supported entity should live behind a dedicated adapter.

Initial adapters:

1. `customer`
2. `product`
3. `order`
4. `purchase_order`
5. `salesperson`

Each adapter defines:

1. Intent aliases and synonyms
2. Required slots
3. Optional slots
4. Slot question order
5. Preview formatter
6. Submit target and payload builder
7. Target module for post-submit refresh and user guidance

This keeps the orchestrator generic while localizing business rules to the correct domain.

### 4. Query and Action Separation

Keep read and write flows separate in the backend:

1. Query chain continues to use the current AI tools with better canonicalization and broader API coverage.
2. Action chain routes create requests into the orchestrator and never submits until the system state allows it.

This separation reduces accidental coupling between analysis prompts and write operations.

### 5. Session Persistence

Action sessions should survive transient UI interruptions.

Recommended storage:

1. Add an `ai_action_sessions` table in D1

Suggested columns:

1. `id`
2. `user_id`
3. `action_type`
4. `entity_type`
5. `status`
6. `slots_json`
7. `preview_json`
8. `expires_at`
9. `created_at`
10. `updated_at`

This allows the user to answer "确认" after a stream interruption or page reload without losing action context.

**Entity Models**

### 1. Customer

Aliases:

1. `客户`
2. `新客户`
3. `客户档案`
4. `客户资料`
5. `联系人`

Required slots:

1. `name`

Optional slots:

1. `phone`
2. `company`
3. `email`
4. `address`
5. `tags`
6. `remark`

Submit target:

1. `POST /api/manage/customers`

Success guidance:

1. Tell the user to check the customer management module
2. Emit refresh for `customers`

### 2. Salesperson

Aliases:

1. `销售员`
2. `业务员`
3. `导购`
4. `销售账号`

Required slots:

1. `name`
2. `password`

Optional slots:

1. `store`
2. `phone`

Submit target:

1. `POST /api/manage/salespersons`

Success guidance:

1. Tell the user to check salesperson management
2. Mention that an access link can be copied there
3. Emit refresh for `salespersons`

### 3. Order

Aliases:

1. `订单`
2. `建单`
3. `下单`
4. `预订单`

Required slots:

1. `productName`
2. `salespersonId`

Recommended high-value slots:

1. `productId`
2. `variantId`
3. `quantity`

Optional slots:

1. `brand`
2. `series`
3. `sku`
4. `size`
5. `color`
6. `material`
7. `remark`
8. `deadline`
9. `status`
10. `fileIds`

Submit target:

1. `POST /api/manage/orders`

Success guidance:

1. Tell the user to check order management
2. Emit refresh for `orders`

### 4. Product

Aliases:

1. `商品`
2. `产品`
3. `新款`
4. `款式`
5. `货号`

Required slots:

1. `name`
2. `currency`
3. `variants`

Recommended slots:

1. `spu`
2. `brand`
3. `category`

Optional slots:

1. `description`
2. `images`
3. `dimensions`

Special rule:

1. Product creation must collect at least one valid variant because the current API requires it.
2. "规格" in product-creation language should map to `dimensions + variants`, not to a loose text field.

Submit target:

1. `POST /api/manage/products`

Success guidance:

1. Tell the user to check product management
2. Emit refresh for `products`

### 5. Purchase Order

Aliases:

1. `采购单`
2. `备货单`
3. `补货单`
4. `下采购`

Modes:

1. `manual`
2. `from_orders`

Required slots:

1. Manual mode requires `items`
2. From-orders mode requires `order_ids`

Optional slots:

1. `remark`
2. `currency`
3. `allocation_method`
4. `estimated_shipping_cost`
5. `estimated_tariff_cost`

Submit targets:

1. Manual mode uses `POST /api/manage/purchase-orders`
2. From-orders mode uses `POST /api/manage/purchase-orders/from-orders`

Success guidance:

1. Tell the user to check purchase-order management
2. Emit refresh for `purchaseOrders`

**Interaction Protocol**

The frontend should not infer action state from plain assistant text alone. Add structured SSE events on top of the current stream.

Recommended events:

1. `action_state`
2. `slot_request`
3. `action_preview`
4. `action_confirmation`
5. `action_submitted`
6. `module_refresh`

Example semantics:

1. `slot_request` asks for missing business fields with field metadata
2. `action_preview` renders a confirmation template card
3. `action_confirmation` indicates the session is waiting for explicit submit approval
4. `action_submitted` contains created entity metadata and user guidance
5. `module_refresh` is a non-visual signal for active modules

**Frontend Runtime**

### 1. AI Chat Rendering

Extend the current AI chat widget to render business cards, not just markdown:

1. `SlotQuestionCard`
2. `ActionPreviewCard`
3. `ActionResultCard`

These components should consume structured events rather than parsing free-form text.

### 2. App Refresh Bus

Extract the existing notification-driven refresh behavior into a shared mechanism.

Current evidence:

1. The notification composable already exposes a global time-based refresh signal
2. Order-related pages already react to that signal and reload data

Target design:

1. Introduce a reusable app refresh bus
2. Notification polling becomes one producer of refresh events
3. AI create success becomes another producer

Recommended event payload:

1. `module`
2. `reason`
3. `entityId`
4. `timestamp`
5. `silent`

Initial target modules:

1. `customers`
2. `products`
3. `orders`
4. `purchaseOrders`
5. `salespersons`

This should be implemented as a small internal composable, not as notification-specific logic.

**Confirmation and Safety Rules**

### 1. Explicit Confirmation

Create actions must submit only when:

1. The current action session is in `awaiting_confirmation`
2. The user explicitly confirms through UI action or recognized confirmation text

The system must not submit based on vague acknowledgements outside the confirmation state.

### 2. Permission Enforcement

AI actions must obey the existing backend permission model.

Suggested mapping:

1. Customer create uses the same permission boundary as the current customer route
2. Product create requires `products:manage`
3. Order create requires `orders:manage`
4. Purchase-order create requires `products:manage`
5. Salesperson create requires `users:write`

The AI layer must never bypass route or service permission checks.

### 3. API-First Write Execution

The create flow should submit through system routes or service boundaries, not through prompt-generated repository access.

Reasons:

1. This matches the project goal of API-first AI control
2. It preserves existing validations, compensation logic, cache invalidation, and side effects
3. It keeps the action layer maintainable

### 4. Failure Handling

Failures should be structured and resumable where possible.

Suggested response shape:

1. `userMessage`
2. `fieldErrors`
3. `retryable`
4. `sessionStatus`

Handling policy:

1. Validation failures return to `collecting`
2. Conflicts return to preview or collecting with clear correction guidance
3. Network/service failures remain retryable without discarding the session

**Observability and Audit**

AI create flows should log:

1. `user_id`
2. `session_id`
3. `entity_type`
4. `action_type`
5. `normalized_slots`
6. `confirmation_state`
7. `submit_result`
8. `error_summary`

These logs should be sufficient to trace unexpected creates without depending on raw model output.

**Testing Strategy**

### 1. Backend Unit Tests

Cover:

1. Canonicalization rules
2. Adapter payload builders
3. Orchestrator state transitions
4. Confirmation gating

### 2. Backend Route Tests

Cover:

1. Structured action SSE events
2. Multi-turn resume behavior
3. Permission failures
4. Successful create followed by `module_refresh`

### 3. Frontend Tests

Cover:

1. Slot-question rendering
2. Preview rendering
3. Explicit confirmation handling
4. Refresh-bus-driven list reloads

**Acceptance Criteria**

1. The AI can normalize common business synonyms into stable query or create intents.
2. The AI uses broader read coverage across product, variant, order, purchase-order, customer, and salesperson domains.
3. The AI can guide users through create flows for customer, product, order, purchase order, and salesperson.
4. The AI never submits a create request before explicit confirmation.
5. Create success produces both a user-facing success message and a silent module refresh event.
6. Refresh signaling is extracted into a project-wide reusable mechanism instead of remaining coupled to notifications.
