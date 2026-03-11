# Network-Driven Navigation Design

**Date:** 2026-03-11

**Scope**

This design standardizes UX for core network-driven transitions across the project:

- list to detail
- detail to edit
- picker to detail
- notification or URL query driven auto-open detail

Included modules for this phase:

- product management
- order management
- dashboard order detail entry
- purchase order order picker

Excluded for this phase:

- generic filter/search refresh
- comment submit refresh
- generic tab switches

---

## Problem

The project currently mixes multiple async navigation patterns:

- some flows wait for the network before opening detail
- some flows open detail first and then hydrate
- some detail-to-edit transitions preserve context
- others risk abrupt state changes or insufficient feedback

This inconsistency makes slow network behavior feel unreliable and hard to understand.

## Goal

Unify all core network-driven detail and edit transitions so users always enter the target context immediately and understand what is loading, what failed, and how to recover.

## Core Principle

**Enter the target context first, then hydrate inside that context.**

Users should never feel that a click was ignored or that they were thrown back to a parent view because data was still loading.

## Standard State Model

All included flows should map to the same visible interaction states:

- `preview`
- `hydrating`
- `ready`
- `error`

The code implementation does not need to use these exact enum names everywhere, but the UX must visibly represent them.

## Global Interaction Rules

### 1. List to Detail

- Open the detail container immediately using available summary data
- Show the shell, title area, and close affordance immediately
- Hydrate richer data inside the opened container
- If loading exceeds roughly 300ms, show skeleton or structured loading feedback
- If loading fails, stay inside the detail container and provide retry

### 2. Detail to Edit

- Never close detail before edit data is ready
- Preserve the detail shell or workflow shell during edit hydration
- Disable repeated clicks on the edit trigger
- Use contextual loading feedback plus editor skeleton
- On failure, return to detail with retryable error

### 3. Picker to Detail

- Open detail immediately from the picker
- Use a lightweight preview or detail skeleton while loading full data
- Do not dismiss the picker-driven detail container just because hydration fails
- Show recovery actions in-place

### 4. Notification / URL Driven Detail

- If route/query intent says “open this record”, render the target detail shell immediately
- Use inline skeleton while loading the target record
- If the record fails to load, show a visible error inside the shell with `Retry` and `Close`
- Only clear the route/query automatically when there is a deliberate dismissal or a confirmed unrecoverable state

## Visual Pattern

Adapting the useful parts of `ui-ux-pro-max`:

- use data-dense dashboard visual language, not decorative page-transition UI
- prefer in-place skeletons over blank canvases
- prefer compact status cards over full-screen spinners
- use short transitions only for content replacement, not long animated travel
- keep focus and close controls stable

### Motion

- transition duration: 150-220ms
- use opacity/content fade, not large position shifts
- respect `prefers-reduced-motion`

### Feedback

- button loading for user-triggered actions
- skeletons for container/body hydration
- inline alert with `role="alert"` or `aria-live` for failures
- retry action next to the failed region

## Component-Level Design Patterns

### A. Async Detail Workflow

Use for:

- product detail
- order detail
- picker-driven detail
- query-driven detail

Responsibilities:

- own preview, hydration, error, retry state
- render shell immediately
- keep already-known summary data visible during hydration

### B. Async Transition Action

Use for:

- detail to edit
- detail to secondary detail
- any button that triggers remote transition

Responsibilities:

- loading button state
- double-click prevention
- contextual loading overlay or panel
- in-place recovery on failure

### C. Deep Link Detail Entry

Use for:

- `route.query.id`
- notification-driven record open

Responsibilities:

- create/open the target shell immediately
- load the target record progressively
- manage retry and URL cleanup explicitly

## Module Mapping

### Product Management

Current direction is already aligned with this design after the workflow modal changes.

Next step:

- treat it as the reference implementation for detail-to-edit preservation

### Order Management

Current issue:

- detail waits for `getOrder()` before opening

Required change:

- open order detail container immediately with summary data
- progressively hydrate full order content in the container
- keep detail visible if edit is triggered during pending hydration

### Dashboard Order Detail

Current issue:

- same blocking behavior as order management

Required change:

- follow the same async detail workflow pattern as the order manager

### Purchase Order Order Picker

Current state:

- better than order manager because the detail modal opens first

Required change:

- improve loading presentation to use skeleton/structured loading
- keep failure recovery inside the already-open detail shell

### Notification / URL Auto-Open

Required change:

- open the target detail shell first
- display explicit in-shell loading and retry
- do not silently fail or clear the route without visible explanation

## Accessibility

- all failures must be announced with `role="alert"` or equivalent
- loading should not trap users with no visible explanation
- focus must remain inside the active dialog/container
- close and retry actions need visible focus states
- color must not be the sole failure signal

## Why This Design

The project does not mainly suffer from network latency itself. It suffers from inconsistent timing of UI state changes around latency.

By standardizing “target context first, hydration second,” the system becomes predictable under slow or failing networks. This is the most important UX improvement because it preserves user orientation across the entire admin experience.
