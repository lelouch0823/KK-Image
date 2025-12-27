# Cloudflare Pages Functions - Context Propagation Best Practices

> **Critical**: Always use `context.data` to pass data between Middleware and Route Handlers.

## The Problem
In Cloudflare Pages Functions, attaching custom properties directly to the `context` object (e.g., `context.user = ...`) is **unreliable**. While it might work in some local dev environments (like `wrangler pages dev`), these properties often fail to propagate to downstream handlers in the actual deployed environment or specific runtime conditions.

This can lead to severe bugs where authentication middleware successfully verifies a user, but the API endpoint receives `undefined` or `null` when trying to access that user, resulting in 403 Forbidden errors.

## The Solution: `context.data`
Cloudflare Pages provides a dedicated `context.data` object specifically designed for passing data through the request chain.

### Anti-Pattern (Do NOT do this)
```javascript
// Middleware
context.user = user; // ❌ Unreliable

// Handler
const user = context.user; // ❌ Might be undefined
```

### Best Practice (DO this)
```javascript
// Middleware
context.data.user = user; // ✅ Recommended

// Handler
const user = context.data.user; // ✅ Reliable
```

## Implementation Example

### Middleware (`functions/_middleware.js`)
```javascript
export async function onRequest(context) {
  const user = await verifyToken(context.request);
  
  // Initialize context.data if it doesn't exist
  context.data = context.data || {};
  
  // Attach user to context.data
  context.data.user = user;
  
  // Backward compatibility (optional but harmless)
  context.user = user;
  
  return context.next();
}
```

### Route Handler (`functions/api/endpoint.js`)
```javascript
export async function onRequest(context) {
  // Retrieve from context.data, fallback to context.user only if necessary
  const user = context.data?.user || context.user;
  
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  return new Response(`Hello ${user.name}`);
}
```

## Related Incidents
- **2025-12-27**: Fixed 403 Forbidden errors on `/api/v1/files` and `/api/v1/webhooks` by migrating from `context.user` to `context.data.user`.
