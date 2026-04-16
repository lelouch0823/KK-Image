# Minisales Sales V2 Alignment Design

**Problem**

The `minisales/` WeChat mini program has fallen behind the current sales web client in three coupled areas:

- backend contract usage is still based on older request and response assumptions
- order workflows do not reflect the current product-binding, line-level progress, and read/update semantics
- mobile UI structure still reflects the old mini-program shell rather than the current web sales experience

As a result, the mini program is no longer a reliable mobile equivalent of the live sales product. Fixing only the API calls would still leave business flow and UI inconsistencies; fixing only the UI would still leave the app on the wrong contract.

**Goal**

Rebuild the mini-program sales experience so it aligns with the current web sales module across:

- backend API contracts
- core business workflows
- information architecture and interaction semantics
- visual hierarchy and page-level UI structure

This is a one-time full replacement of the current mini-program sales flow, not a staged partial migration.

## Scope

This design covers the entire `minisales/` sales surface:

- authentication and session recovery
- order list
- order detail
- order creation
- product binding and variant selection
- order comment and read-state behavior
- stats
- spaces list and space detail
- notifications
- WeChat binding entry and related profile behavior
- shared shell, visual tokens, empty/error/loading states, and page interaction patterns

This design also covers the supporting client-side layers required to make that possible:

- request layer
- auth/session layer
- sales-domain service layer
- data normalization helpers
- mini-program component decomposition

## Non-Goals

This design does not include:

- backend route redesign
- admin web changes beyond reference-driven parity checks
- introducing a shared cross-platform component library between Vue web and WeChat mini program
- maintaining the current mini-program UI as a legacy fallback
- inventing new business capabilities that do not already exist in the current web sales module

## Current Gaps

### 1. Contract drift

The mini program still assumes older request and response shapes:

- order creation still posts `images` instead of the current `fileIds`
- order creation does not fully model `productId` and `variantId` binding
- order detail page still centers `currentData` and does not treat `lines` as first-class progress data
- request handling is page-local and inconsistent, instead of using a unified sales API contract

### 2. Workflow drift

The current mini program does not reflect the web sales workflow:

- login and session restore are implemented separately from the current sales auth semantics
- order read-state and feedback handling are incomplete
- detail page actions are behind current web behavior
- form flow is still old-style manual entry plus upload, with no web-level product binding parity

### 3. UI drift

The current mini-program visual structure is not aligned with the web sales client:

- page shell hierarchy is different
- action priority differs between pages
- detail information grouping is outdated
- loading, empty, and error states are inconsistent with the current sales experience
- cards, headers, and form sections still reflect the previous mini-program design language

## Approach Options

### Option A: API-only adaptation

- keep most current mini-program pages and visuals
- update request payloads and response parsing only

Pros:

- smallest immediate change set

Cons:

- still leaves the mini program behind the current product
- creates a hybrid client with old UI and new backend semantics
- guarantees follow-up rework

### Option B: Full minisales alignment to current web sales module

- treat the web sales module as the reference product
- rebuild the mini-program sales flow in WeChat-native components
- align API usage, business logic, and UI structure together

Pros:

- matches the requested one-time switch
- produces a maintainable mobile equivalent
- removes most accumulated divergence at once

Cons:

- larger change surface
- requires coordinated refactor of shared mini-program foundations before page migration

### Option C: Shared domain layer for both web and mini program first

- abstract a cross-platform sales domain package before rebuilding mini-program pages

Pros:

- clean long-term architecture

Cons:

- turns this into a platform architecture project
- slows delivery without being required for the immediate migration

## Recommended Design

Use Option B.

The web sales module becomes the behavioral and UI reference, while the mini program gets its own WeChat-native implementation. The goal is parity of capability and interaction semantics, not literal component reuse.

## Alignment Principles

### 1. Web is the source of truth for sales behavior

The current web sales module defines the expected user journey for:

- login and auth validation
- order list fetch and pagination semantics
- order detail structure
- product binding
- order creation payload
- comment and refresh flows
- stats and spaces information hierarchy
- notification behavior

The mini program should not preserve old behavior just because it already exists.

### 2. Mini program remains native, not a visual clone

Parity means:

- same information order
- same action priority
- same state vocabulary
- same status presentation semantics
- same business guardrails

Parity does not mean copying Vue components or desktop-only interaction patterns that do not fit WeChat.

### 3. Replace in place, not dual-track

Because the requested release strategy is one-time cutover, `minisales/` should be migrated in place. The mini program should not keep a legacy route tree or a runtime feature flag that doubles maintenance cost.

## Target Architecture

The mini program should be reorganized into three layers.

### 1. Transport layer

Responsibility:

- unified request function
- JWT injection
- access-token aware route generation
- normalized `{ success, data, error, code }` handling
- auth expiry handling
- consistent loading and toast behavior

This replaces the current pattern where each page directly decides how to interpret response payloads.

### 2. Sales domain layer

Responsibility:

- auth/session service
- orders service
- products service
- notifications service
- spaces service
- stats service
- normalization helpers for order summary, order detail, product variant display, and timeline items

This layer should absorb the web-side contract knowledge currently missing from mini-program pages.

### 3. Page and component layer

Responsibility:

- route-specific data orchestration
- WeChat page lifecycle wiring
- TDesign and native component rendering
- local page interaction state

Pages should become thin consumers of stable sales-domain methods instead of embedding request logic directly.

## API Contract Design

### Auth

Mini-program auth must align to the live routes:

- `POST /api/sales/login`
- `POST /api/sales/wechat-login`
- `GET /api/sales/:token/auth`
- `POST /api/sales/:token/auth`
- `POST /api/sales/:token/bind-wechat`

Session design:

- persist both JWT and access token
- validate session on app/page entry with current route semantics
- centralize logout on 401
- keep WeChat login and username/password login in the same auth service

### Orders

The mini program must support the current order contract:

- `GET /api/sales/:token/orders`
- `POST /api/sales/:token/orders`
- `GET /api/sales/:token/orders/:id`
- `PATCH /api/sales/:token/orders/:id/read`
- `PATCH /api/sales/:token/orders/:id`
- `DELETE /api/sales/:token/orders/:id`
- `POST /api/sales/:token/orders/:id/comment`

Creation payload must follow the current schema:

- `fileIds`
- `quantity`
- optional `productId`
- optional `variantId`

The mini program must stop using the old `images` payload field.

### Products

The mini program must adopt the current product-selection flow:

- `GET /api/sales/:token/products`
- `GET /api/sales/:token/products/:id`

Variant selection needs to respect current active variant and inventory availability semantics rather than older free-form manual assumptions.

### Supporting domains

The mini program must also align these areas:

- `GET /api/sales/:token/stats`
- `GET /api/sales/:token/spaces`
- `GET /api/sales/:token/spaces/:id`
- `GET /api/sales/:token/notifications`
- `POST /api/sales/:token/notifications/:id/read`

## Data Normalization Design

The web client already relies on normalized sales-order semantics. The mini program needs the same idea in its own helpers.

### Order list normalization

Normalize each order list item into a stable render shape:

- id
- order number
- customer or order title
- summary image
- visible status badge
- unread or feedback state
- updated-at display
- quantity summary

The page layer should not decide per field whether to read from top-level order fields, `currentData`, or line-derived fallbacks.

### Order detail normalization

Normalize order detail into render-ready groups:

- header summary
- editable order fields
- line-progress collection
- file gallery
- timeline entries
- action availability

This allows the mini program to render current line-level progress without repeatedly branching on legacy field paths.

### Product detail normalization

Normalize product details for mobile variant picking:

- product summary
- primary image
- dimension map
- active variants
- selected variant state
- stock and replenishment display fields

## UI Alignment Design

The UI target is the current web sales experience translated into WeChat-native interaction patterns.

### Visual direction

Use the current web sales visual language as reference:

- clean light background
- blue primary action color
- card-based grouped information
- compact mobile-first header
- clear section dividers
- prominent primary CTA

The mini program should preserve WeChat-native feel, but the information grouping and button priority should match the web client.

### Shell parity

The mini program should align to the web shell in structure:

- sticky top bar with current page identity
- order-focused primary action placement
- bottom tab navigation for orders and spaces
- consistent notification entry
- reusable loading / empty / error state panels

### Page parity rules

For every page, parity means:

- same primary task
- same data blocks and ordering
- same status labels
- same major actions
- same empty/error fallback intent

## Page-by-Page Design

### 1. Login

Target behavior:

- support username/password login
- support WeChat login when backend is configured
- support session restore
- support WeChat bind entry after authenticated password login when relevant

UI alignment:

- center the login task on one clear auth card
- keep error feedback inline and immediate
- avoid the current bare form look

### 2. Order List

Target behavior:

- pagination and infinite loading semantics match current sales list behavior
- search and refresh behavior align with the web list flow
- unread or feedback markers remain visible
- tap-through enters the current detail experience

UI alignment:

- search anchored at top
- list cards grouped like the web mobile shell
- explicit loading, empty, and retry states

### 3. Order Create

Target behavior:

- support manual order creation
- support product binding and variant selection
- support upload first, then create with `fileIds`
- preserve progress and failure feedback
- support duplicate-prefill from detail

UI alignment:

- top guidance card
- dedicated product-binding section before the main form
- grouped form sections instead of one long flat form
- clear primary submit CTA

### 4. Order Detail

Target behavior:

- fetch current detail shape with `lines`, `files`, and `timeline`
- mark order as read through current semantics
- show comment flow
- support refresh and duplicate
- expose allowed update or void actions if they exist in the current sales experience

UI alignment:

- summary header first
- line-progress card as a first-class block
- files and timeline as separate sections
- action bar fixed to the page logic, not buried at the bottom of raw content

### 5. Stats

Target behavior:

- show the same KPI meaning as current web sales stats
- keep trend rendering stable and readable on mobile

UI alignment:

- metric cards first
- trend second
- clear empty or loading fallback

### 6. Spaces List and Detail

Target behavior:

- preserve current spaces capability
- align hierarchy and visual grouping to the web sales spaces experience

UI alignment:

- card-based list, less waterfall randomness
- detail page sections based on template type
- file preview behavior stays WeChat-native

### 7. Notifications

Target behavior:

- expose notification list and unread count consistently
- support mark-as-read
- navigate from notification to order detail

UI alignment:

- use a focused overlay or page consistent with mini-program constraints
- maintain the same importance level as the web notification bell flow

## Component Strategy

Do not leave pages as monoliths. The mini program should introduce reusable sales components for:

- shell header and tab bar
- async state blocks
- order summary cards
- product binding and variant picker
- order detail sections
- notification list items
- stats cards

This creates a mini-program equivalent of the current web sales composition model, without trying to share framework-specific components.

## File Structure Direction

The migrated mini program should move toward a structure like:

- `miniprogram/services/`
- `miniprogram/services/sales/`
- `miniprogram/components/sales/`
- `miniprogram/utils/normalize/`

Representative responsibilities:

- auth/session APIs and persistence
- order APIs and normalizers
- product APIs and variant helpers
- page-shell components
- state-panel components
- detail cards and form sections

Exact file paths and task slicing belong in the implementation plan, but the key design decision is to stop centering all business logic inside `pages/*/*.ts`.

## Testing Strategy

This migration needs verification at three levels.

### 1. Contract verification

- request payloads match current sales API schema
- auth and 401 behavior are consistent
- detail parsing works for current `lines/files/timeline` shape

### 2. Page-flow verification

- login
- session restore
- list fetch and pagination
- product-bound create flow
- manual create flow
- detail read and comment flow
- stats load
- spaces load
- notification read and navigation

### 3. Visual and UX verification

- page hierarchy matches the web sales experience
- key actions are discoverable in the same places
- loading, empty, and error states are consistent
- status labels and badges are aligned across list and detail

## Rollout Strategy

Release strategy is a single coordinated cutover, but implementation should still proceed in dependency order:

1. transport and auth foundations
2. sales-domain services and normalizers
3. order mainline pages: login, list, create, detail
4. supporting pages: stats, spaces, notifications, bind flow
5. final UI parity pass and full regression

The mini program should only be considered ready once all pages are migrated and validated together.

## Success Criteria

This migration is complete when:

- the mini program uses the current `/api/sales/*` contract end to end
- order creation uses `fileIds`, `quantity`, and product binding semantics correctly
- order detail renders current line-level progress and timeline information
- login, notifications, stats, and spaces behave like the current sales product
- the mini-program shell and page hierarchy visibly match the current web sales experience
- the old mini-program-specific legacy workflow assumptions are removed rather than patched around
