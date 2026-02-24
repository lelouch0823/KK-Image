# Global Error Handler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize error handling using Hono's native `app.onError` to eliminate redundant `try-catch` boilerplate across all API routes, abiding by the DRY Principle.

**Architecture:** We will create standard robust Error classes (e.g. `AppError`, `NotFoundError`) and refactor `errorHandler.js` to match Hono's `app.onError(err, c)` signature. Once the global catcher is tested and wired in `app.js`, we will systematically strip `try-catch` layers from individual endpoints, replacing manual `return c.json({error: ...}, 404)` with `throw new NotFoundError(...)`.

**Tech Stack:** Node.js, Hono (Cloudflare Workers environment)

---

### Task 1: Create Standard Exceptions (Errors)

**Files:**
- Create: `functions/lib/hono/errors.js`

**Step 1: Write standard Error classes**

```javascript
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}
```

**Step 2: Commit**

```bash
git add functions/lib/hono/errors.js
git commit -m "feat(api): introduce standard AppError classes"
```

### Task 2: Refactor Global Error Handler

**Files:**
- Modify: `functions/lib/hono/middleware/errorHandler.js:1-35`
- Modify: `functions/lib/hono/app.js:50-65`

**Step 1: Convert `errorHandler.js` for `app.onError` syntax**

```javascript
export function errorHandler(err, c) {
  console.error('[GlobalErrorHandler]', err.name, err.message, err.stack);

  const status = err.statusCode || 500;
  const message = status === 500 && !err.statusCode ? 'Internal Server Error' : err.message;
  const code = err.code || err.name || 'INTERNAL_ERROR';

  return c.json(
    {
      success: false,
      error: message,
      code: code,
      ...(c.env?.NODE_ENV === 'development' && { stack: err.stack }),
    },
    status
  );
}
```

**Step 2: Update `app.js` to use `app.onError` instead of middleware**

```javascript
// Find and delete:
// app.use('*', errorHandler);

// Insert at the end before `export default app;`:
app.onError(errorHandler);
```

**Step 3: Commit**

```bash
git add functions/lib/hono/middleware/errorHandler.js functions/lib/hono/app.js
git commit -m "refactor(api): migrate to Hono native app.onError hook"
```

### Task 3: Strip `try-catch` from a Pilot Route (`customers.js`)

**Files:**
- Modify: `functions/lib/hono/routes/manage/customers.js`

**Step 1: Remove `try-catch` wrapper and use throw**

Strip the `try-catch` block from every endpoint in the file.
Instead of returning 404s manually, import and throw the `NotFoundError`.

```javascript
import { NotFoundError, BadRequestError } from '../../../errors.js';

// ...
const customer = await repo.create(body);
return c.json({ success: true, data: customer }, 201);
// ...

if (!success) {
    throw new NotFoundError(MSG.CUSTOMER.NOT_FOUND);
}

// ...
if (hasOrders) {
    throw new BadRequestError(MSG.CUSTOMER.HAS_ORDERS);
}
```

**Step 2: Build and Test to verify failures bubble up gracefully**

Run: `pnpm run build`
Ensure no compilation errors, and structurally everything works.

**Step 3: Commit**

```bash
git add functions/lib/hono/routes/manage/customers.js
git commit -m "refactor(api): remove try-catch from customers endpoint"
```

### Task 4: Rollout to Other Endpoints

Repeat Task 3 progressively across other key modules ensuring no syntax logic is broken during the stripping phase. Remove `try-catch` blocks and use `throw new CustomError(...)` for known client errors.

**Sub-tasks by file:**
- `manage/salespersons.js`
- `manage/products/[id].js`
- `manage/products/index.js`
- `manage/orders/detail.js`
- `manage/orders/list.js`

(Each module update should be completed and tested individually in an iterative fashion, committing one by one).
