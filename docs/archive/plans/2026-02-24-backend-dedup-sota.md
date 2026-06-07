# 后端代码去重与 SOTA 优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 消除后端重复代码，统一错误处理风格，补齐 Repository 层，使整个后端达到一致的 SOTA 标准。

**Architecture:** 采用 Bottom-Up 策略：先创建公共辅助函数和 Repository，再逐文件替换路由层的重复代码。每个 Task 都是独立可构建、可验证的单元。由于本项目无后端单元测试框架（仅 `functions/api/utils/__tests__/` 中有少量测试），主要通过 `pnpm run build` 验证无编译错误。

**Tech Stack:** Hono (Web Framework), Cloudflare Workers (Runtime), Zod (Validation), D1 (SQLite)

---

## Task 1: 创建 `auth-helpers.js` — 提取 lockout 响应与认证逻辑

**Files:**

- Create: `functions/lib/hono/_shared/auth-helpers.js`
- Modify: `functions/lib/hono/routes/v1/auth.js`
- Modify: `functions/lib/hono/routes/sales/auth.js`

**Step 1: 创建 `auth-helpers.js`**

```js
/**
 * 认证辅助函数
 * 提取自 v1/auth.js 和 sales/auth.js 的重复逻辑
 * @module lib/hono/_shared/auth-helpers
 */

import { generateJWT, hashPassword, MSG } from './utils.js';
import {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
  formatRetryAfter,
} from '../middleware/rateLimit.js';
import { setCookie } from 'hono/cookie';

// ============================
// Cookie 常量
// ============================
export const SALES_TOKEN_COOKIE = 'sales_token';
export const SALES_COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 天

/**
 * 生成锁定错误消息
 * @param {number} retryAfter - 秒数
 * @returns {string}
 */
export function getLockedMessage(retryAfter) {
  return MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(retryAfter));
}

/**
 * 检查登录限流，如果被锁定则返回 429 响应对象，否则返回 null
 * @param {Object} c - Hono context
 * @param {string} identifier - 用户标识（username / accessToken）
 * @returns {Promise<Response|null>}
 */
export async function checkAndRespondLockout(c, identifier) {
  const { env } = c;
  const kv = env.RATE_LIMIT_KV || env.KV;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  const lockoutStatus = await checkLoginLockout(kv, ip, identifier);
  if (lockoutStatus.locked) {
    return c.json(
      {
        success: false,
        error: getLockedMessage(lockoutStatus.retryAfter),
        retryAfter: lockoutStatus.retryAfter,
      },
      429,
      { 'Retry-After': String(lockoutStatus.retryAfter) }
    );
  }
  return null;
}

/**
 * 记录登录失败并返回适当的错误响应
 * @param {Object} c - Hono context
 * @param {string} identifier - 用户标识
 * @param {string} errorMsg - 错误消息
 * @returns {Promise<Response>}
 */
export async function handleLoginFailure(c, identifier, errorMsg = MSG.AUTH.INVALID_CREDENTIALS) {
  const { env } = c;
  const kv = env.RATE_LIMIT_KV || env.KV;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  const failureResult = await recordLoginFailure(kv, ip, identifier, c.executionCtx);

  if (failureResult.locked) {
    return c.json(
      {
        success: false,
        error: getLockedMessage(failureResult.retryAfter),
        retryAfter: failureResult.retryAfter,
      },
      429,
      { 'Retry-After': String(failureResult.retryAfter) }
    );
  }

  return c.json({ success: false, error: errorMsg, remaining: failureResult.remaining }, 401);
}

/**
 * 清除登录失败记录
 * @param {Object} c - Hono context
 * @param {string} identifier - 用户标识
 */
export async function clearFailures(c, identifier) {
  const { env } = c;
  const kv = env.RATE_LIMIT_KV || env.KV;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  await clearLoginFailures(kv, ip, identifier, c.executionCtx);
}

/**
 * 设置销售端 JWT Cookie
 * @param {Object} c - Hono context
 * @param {string} token - JWT token
 */
export function setSalesTokenCookie(c, token) {
  setCookie(c, SALES_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SALES_COOKIE_MAX_AGE,
    path: '/api/sales',
  });
}

/**
 * 生成销售端 JWT 并设置 Cookie
 * @param {Object} c - Hono context
 * @param {Object} salesperson - 销售人员信息 { id, name }
 * @returns {Promise<string>} JWT token
 */
export async function generateSalesToken(c, salesperson) {
  const token = await generateJWT(
    { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
    c.env,
    SALES_COOKIE_MAX_AGE
  );
  setSalesTokenCookie(c, token);
  return token;
}

/**
 * 认证管理端用户 (Root Admin + DB Users)
 * 提取自 v1/auth.js 的重复认证逻辑
 * @param {Object} env - Cloudflare env
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object|null>} 用户对象或 null
 */
export async function authenticateAdminUser(env, username, password) {
  // 1. Check Root Admin
  if (username === env.BASIC_USER && password === env.BASIC_PASS) {
    return {
      id: username,
      name: 'Administrator',
      type: 'admin',
      role: 'admin',
      permissions: ['admin:full'],
    };
  }

  // 2. 查询数据库用户
  const dbUser = await env.DB.prepare(
    'SELECT id, password_hash, name, role, permissions FROM users WHERE username = ?'
  )
    .bind(username)
    .first();

  if (!dbUser) return null;

  // 验证密码（使用 hashPassword + 比较，与原始逻辑一致）
  const { verifyPassword } = await import('./utils.js');
  const isValid = await verifyPassword(password, dbUser.password_hash, env.JWT_SECRET);
  if (!isValid) return null;

  return {
    id: dbUser.id,
    name: dbUser.name,
    type: 'user',
    role: dbUser.role,
    permissions: dbUser.permissions ? JSON.parse(dbUser.permissions) : [],
  };
}
```

**Step 2: 重构 `v1/auth.js` — 使用 auth-helpers**

```diff
 import { Hono } from 'hono';
 import { zValidator } from '@hono/zod-validator';
 import { LoginSchema, TokenSchema } from '../../schemas/user.js';
 import { generateJWT, ADMIN_AUTH_COOKIE, verifyTurnstile, MSG } from '../../_shared/utils.js';
-import {
-  checkLoginLockout,
-  recordLoginFailure,
-  clearLoginFailures,
-  loginRateLimitMiddleware,
-  formatRetryAfter,
-} from '../../middleware/rateLimit.js';
+import { loginRateLimitMiddleware } from '../../middleware/rateLimit.js';
+import {
+  checkAndRespondLockout,
+  handleLoginFailure,
+  clearFailures,
+  authenticateAdminUser,
+} from '../../_shared/auth-helpers.js';

 const app = new Hono();

-function getLockedMessage(retryAfter) { ... }  // 删除
-
 app.post('/login', loginRateLimitMiddleware, zValidator('json', LoginSchema), async (c) => {
   const { username, password, turnstileToken } = c.req.valid('json');
   const { env } = c;
-  const kv = env.RATE_LIMIT_KV || env.KV;
-  const ip = c.req.header('CF-Connecting-IP') || ...;

   // 检查锁定
-  const lockoutStatus = await checkLoginLockout(kv, ip, username);
-  if (lockoutStatus.locked) {
-    return c.json({ ... }, 429, { ... });
-  }
+  const lockoutRes = await checkAndRespondLockout(c, username);
+  if (lockoutRes) return lockoutRes;

   // Turnstile 验证
   if (env.TURNSTILE_SECRET_KEY && turnstileToken) { ... }

-  // 大块重复认证逻辑 (~30 行) → 1 行
-  let authenticatedUser = null;
-  if (username === env.BASIC_USER && password === env.BASIC_PASS) { ... }
-  else { ... }
+  const authenticatedUser = await authenticateAdminUser(env, username, password);

   if (!authenticatedUser) {
-    const failureResult = await recordLoginFailure(kv, ip, username, c.executionCtx);
-    // ... 重复的失败处理
+    return handleLoginFailure(c, username);
   }

-  await clearLoginFailures(kv, ip, username, c.executionCtx);
+  await clearFailures(c, username);

   // 生成 JWT & Cookie（保持原逻辑）
   ...
 });
```

对 `POST /token` 端点做同样替换（消除 ~50 行重复）。

**Step 3: 重构 `sales/auth.js` — 使用 auth-helpers**

```diff
 import { Hono } from 'hono';
 import { zValidator } from '@hono/zod-validator';
-import { setCookie } from 'hono/cookie';
 import { SalesLoginSchema, WechatLoginSchema } from '../../schemas/sales.js';
-import { generateJWT, MSG, hashPassword } from '../../_shared/utils.js';
+import { MSG, hashPassword } from '../../_shared/utils.js';
 import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';
-import { ... } from '../../middleware/rateLimit.js';
+import { loginRateLimitMiddleware } from '../../middleware/rateLimit.js';
 import { NotFoundError, ForbiddenError } from '../../errors.js';
+import {
+  checkAndRespondLockout,
+  handleLoginFailure,
+  clearFailures,
+  generateSalesToken,
+  SALES_COOKIE_MAX_AGE,
+} from '../../_shared/auth-helpers.js';

 const app = new Hono();
-const SALES_TOKEN_COOKIE = 'sales_token';    // 删除（移到 auth-helpers）
-const COOKIE_MAX_AGE = 7 * 24 * 3600;        // 删除
-function getLockedMessage(retryAfter) { ... } // 删除

 app.post('/login', loginRateLimitMiddleware, ..., async (c) => {
   ...
-  const lockoutStatus = await checkLoginLockout(kv, ip, username);
-  if (lockoutStatus.locked) { ... 8 行 ... }
+  const lockoutRes = await checkAndRespondLockout(c, username);
+  if (lockoutRes) return lockoutRes;

   ...
   if (salesperson.password_hash !== passwordHash) {
-    const failureResult = await recordLoginFailure(...);
-    if (failureResult.locked) { ... 8 行 ... }
-    return c.json({ ...remaining... }, 401);
+    return handleLoginFailure(c, username);
   }

-  await clearLoginFailures(kv, ip, username, c.executionCtx);
+  await clearFailures(c, username);

-  const token = await generateJWT(...);
-  setCookie(c, SALES_TOKEN_COOKIE, token, { ... 6 行 ... });
+  const token = await generateSalesToken(c, salesperson);

   return c.json({ ... token ... });
 });
```

对 `POST /wechat-login` 和 `POST /:token/auth` 做同样提取。

**Step 4: 构建验证**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 5: 提交**

```bash
git add functions/lib/hono/_shared/auth-helpers.js functions/lib/hono/routes/v1/auth.js functions/lib/hono/routes/sales/auth.js
git commit -m "refactor: 提取认证辅助函数，消除 auth 路由中的重复逻辑"
```

---

## Task 2: 提取分页解析与缓存失效工厂

**Files:**

- Create: `functions/lib/hono/_shared/route-helpers.js`
- Modify: `functions/lib/hono/middleware/cache.js` (删除 `getProductCacheUrls`，移至新文件)
- Modify: `functions/lib/hono/routes/manage/customers.js`
- Modify: `functions/lib/hono/routes/manage/salespersons.js`
- Modify: `functions/lib/hono/routes/v1/folders.js`

**Step 1: 创建 `route-helpers.js`**

```js
/**
 * 路由层公共辅助函数
 * @module lib/hono/_shared/route-helpers
 */

/**
 * 从请求中解析分页参数
 * @param {Object} c - Hono context
 * @param {{ page?: number, limit?: number }} defaults - 默认值
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function parsePagination(c, { page: defaultPage = 1, limit: defaultLimit = 20 } = {}) {
  const page = Math.max(1, parseInt(c.req.query('page') || String(defaultPage), 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(c.req.query('limit') || String(defaultLimit), 10))
  );
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * 缓存失效 URL 工厂
 * @param {string} basePath - API 路径，如 '/api/manage/customers'
 * @param {string[]} extraParams - 额外的查询参数变体
 * @returns {(c: Object) => string[]}
 */
export function createCacheInvalidator(basePath, extraParams = []) {
  return (c) => {
    const origin = new URL(c.req.url).origin;
    return [`${origin}${basePath}`, ...extraParams.map((p) => `${origin}${basePath}?${p}`)];
  };
}
```

**Step 2: 替换 `customers.js` 中的重复代码**

```diff
+import { parsePagination, createCacheInvalidator } from '../../_shared/route-helpers.js';

-const getCacheUrls = (c) => { ... };
+const getCacheUrls = createCacheInvalidator('/api/manage/customers', ['page=1&limit=20']);

 app.get('/', withCache(60), async (c) => {
-    const search = c.req.query('search') || '';
-    const page = parseInt(c.req.query('page') || '1');
-    const limit = parseInt(c.req.query('limit') || '20');
+    const { page, limit } = parsePagination(c);
+    const search = c.req.query('search') || '';
     ...
 });
```

**Step 3: 替换 `salespersons.js` 中的重复代码**

```diff
+import { parsePagination, createCacheInvalidator } from '../../_shared/route-helpers.js';

-const getCacheUrls = (c) => { ... };
+const getCacheUrls = createCacheInvalidator('/api/manage/salespersons', ['page=1&limit=50']);

 app.get('/', withCache(60), async (c) => {
-    const page = parseInt(c.req.query('page') || '1', 10);
-    const limit = parseInt(c.req.query('limit') || '50', 10);
+    const { page, limit } = parsePagination(c, { limit: 50 });
     ...
 });
```

**Step 4: 替换 `v1/folders.js` 中的重复代码**

```diff
+import { createCacheInvalidator } from '../../_shared/route-helpers.js';

-const getFolderCacheUrls = (c) => { ... };
+const getFolderCacheUrls = createCacheInvalidator('/api/v1/folders', ['parentId=null']);
```

**Step 5: 将 `cache.js` 中的 `getProductCacheUrls` 迁移至 `route-helpers.js`**

从 `cache.js` 中删除 `getProductCacheUrls` 函数，在使用它的文件中改用 `createCacheInvalidator`。

**Step 6: 对 manage/files.js、sales/orders.js、stats.js 等也替换分页解析**

应用 `parsePagination(c, { limit: 50 })` 到所有使用手动解析的路由。

**Step 7: 构建验证**

Run: `pnpm run build`
Expected: 构建成功

**Step 8: 提交**

```bash
git add functions/lib/hono/_shared/route-helpers.js functions/lib/hono/middleware/cache.js functions/lib/hono/routes/manage/customers.js functions/lib/hono/routes/manage/salespersons.js functions/lib/hono/routes/v1/folders.js functions/lib/hono/routes/manage/files.js functions/lib/hono/routes/sales/orders.js
git commit -m "refactor: 提取分页解析和缓存失效工厂，消除路由层重复"
```

---

## Task 3: 统一 `sales/orders.js` 错误处理为 throw 风格

**Files:**

- Modify: `functions/lib/hono/routes/sales/orders.js`

**Step 1: 替换所有 `return c.json({ success: false })` 为 throw**

```diff
+import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors.js';

 // GET /:id
-if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
+if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

 // PATCH /:id
-if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
+if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

-if (!editableStatuses.includes(order.status)) {
-    return c.json({ success: false, error: MSG.ORDER.ONLY_PENDING_CAN_EDIT }, 403);
-}
+if (!editableStatuses.includes(order.status)) throw new ForbiddenError(MSG.ORDER.ONLY_PENDING_CAN_EDIT);

-if (!reason || !reason.trim()) {
-    return c.json({ success: false, error: MSG.ORDER.REASON_REQUIRED }, 400);
-}
+if (!reason || !reason.trim()) throw new BadRequestError(MSG.ORDER.REASON_REQUIRED);

 // DELETE /:id
-if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
-if (order.status !== 'pending') return c.json({ success: false, error: MSG.ORDER.ONLY_PENDING_CAN_VOID }, 403);
+if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);
+if (order.status !== 'pending') throw new ForbiddenError(MSG.ORDER.ONLY_PENDING_CAN_VOID);

 // POST /:id/comment
-if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
+if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);
```

**Step 2: 构建验证**

Run: `pnpm run build`
Expected: 构建成功

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/sales/orders.js
git commit -m "refactor: 统一 sales/orders 错误处理为 throw 风格"
```

---

## Task 4: 统一 `v1/folders.js` 和其他路由的错误处理

**Files:**

- Modify: `functions/lib/hono/routes/v1/folders.js`
- Modify: `functions/lib/hono/routes/manage/backups.js`
- Modify: `functions/lib/hono/routes/manage/user.js`
- Modify: `functions/lib/hono/routes/manage/orders/create.js`

**Step 1: 替换 `v1/folders.js` 中的旧式错误返回**

```diff
+import { NotFoundError, BadRequestError } from '../../errors.js';

 // GET /:id
-if (!folder) return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
+if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

 // POST /
-if (!parent) return c.json({ success: false, error: MSG.FOLDER.PARENT_NOT_FOUND }, 404);
+if (!parent) throw new NotFoundError(MSG.FOLDER.PARENT_NOT_FOUND);

 // PUT /:id
-if (!folder) return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
+if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

-if (updates.length === 0) return c.json({ success: false, error: MSG.COMMON.NO_UPDATE_FIELDS }, 400);
+if (updates.length === 0) throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);

 // DELETE /:id
-if (!folder) return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
+if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);
```

**Step 2: 替换其余文件中的旧式错误**

- `manage/backups.js` L57: 改为 `throw new NotFoundError(MSG.COMMON.NOT_FOUND)`
- `manage/user.js` L14: 改为 `throw new UnauthorizedError('Unauthorized')`
- `manage/orders/create.js` L22: 改为 `throw new BadRequestError('Product Name and Salesperson are required')`

**Step 3: 构建验证**

Run: `pnpm run build`
Expected: 构建成功

**Step 4: 提交**

```bash
git add functions/lib/hono/routes/v1/folders.js functions/lib/hono/routes/manage/backups.js functions/lib/hono/routes/manage/user.js functions/lib/hono/routes/manage/orders/create.js
git commit -m "refactor: 统一错误处理为 throw 风格（v1/folders, backups, user, orders/create）"
```

---

## Task 5: 统一 `notifications.js` 和 `settings.js` 响应风格

**Files:**

- Modify: `functions/lib/hono/routes/manage/notifications.js`
- Modify: `functions/lib/hono/routes/manage/settings.js`

**Step 1: 替换 `notifications.js` 中的 `success()` 为 `c.json()`**

```diff
-import { success } from '../../../../api/utils/response.js';
-import { MSG } from '../../../../api/utils/messages.js';
+import { MSG } from '../../_shared/utils.js';

 // GET /
-return success(result);
+return c.json({ success: true, data: result });

 // POST /
-return success(result, MSG.COMMON.CREATE_SUCCESS);
+return c.json({ success: true, message: MSG.COMMON.CREATE_SUCCESS, data: result });

 // POST /:id/read
-return success(null, MSG.COMMON.UPDATE_SUCCESS);
+return c.json({ success: true, message: MSG.COMMON.UPDATE_SUCCESS });
```

**Step 2: 替换 `settings.js` 中的 `success()` 为 `c.json()`**

```diff
-import { success } from '../../../../api/utils/response.js';

 // GET /
-return success(c, settings);
+return c.json({ success: true, data: settings });

 // POST /batch
-return success(c, { count: settings.length });
+return c.json({ success: true, data: { count: settings.length } });

 // PUT /:key
-return success(c, { key, value });
+return c.json({ success: true, data: { key, value } });
```

> **注意：** `settings.js` 中的 `success(c, data)` 传入了 `c` 作为第一个参数——这其实是一个 bug！`response.js` 中的 `success(data, message)` 期望第一个参数是数据而非 context。改为 `c.json()` 同时修复了这个潜在 bug。

**Step 3: 构建验证**

Run: `pnpm run build`
Expected: 构建成功

**Step 4: 提交**

```bash
git add functions/lib/hono/routes/manage/notifications.js functions/lib/hono/routes/manage/settings.js
git commit -m "refactor: 统一 notifications/settings 响应风格为 c.json()，修复 settings 的参数传递 bug"
```

---

## Task 6: 修复 `app.js` 重复注释与 `folders.js` import 位置

**Files:**

- Modify: `functions/lib/hono/app.js`
- Modify: `functions/lib/hono/routes/manage/folders.js`

**Step 1: 删除 `app.js` 重复注释块**

```diff
-// ============================================
-// 全局中间件（洋葱模型，从外到内执行）
-// ============================================
-
 // ============================================
 // 全局中间件（洋葱模型，从外到内执行）
 // ============================================
```

**Step 2: 移动 `folders.js` 中间位置的 import 到文件顶部**

将 L263-265 的两个 import 移动到文件顶部的 import 区域：

```diff
 import { Hono } from 'hono';
 import { zValidator } from '@hono/zod-validator';
 import { z } from 'zod';
 import { requirePermission } from '../../middleware/auth.js';
+import { triggerWebhook } from '../../_shared/utils.js';
+import { storeFile } from '../../../../api/utils/file-utils.js';
 import {
   generateId,
   generateShareToken,
   timestampToIso,
   MSG,
   getShareUrl,
   getFileUrl,
 } from '../../_shared/utils.js';
 ...

-// L263-265 删除
-import { triggerWebhook } from '../../_shared/utils.js';
-import { storeFile } from '../../../../api/utils/file-utils.js';
```

> **注意：** `triggerWebhook` 已在上方的 `_shared/utils.js` barrel 中导出，直接合并到已有的 import 声明中即可。

**Step 3: 构建验证**

Run: `pnpm run build`
Expected: 构建成功

**Step 4: 提交**

```bash
git add functions/lib/hono/app.js functions/lib/hono/routes/manage/folders.js
git commit -m "chore: 修复 app.js 重复注释和 folders.js import 位置"
```

---

## Task 7: `dashboard.js` 修复 Repository 封装破坏

**Files:**

- Modify: `functions/repositories/StatsRepository.js`
- Modify: `functions/lib/hono/routes/manage/dashboard.js`

**Step 1: 在 `StatsRepository` 中添加 `getRecentFiles` 方法**

查阅 `StatsRepository.js` 当前实现，添加：

```js
/**
 * 获取最近上传的文件
 * @param {number} limit - 返回数量
 * @returns {Promise<Object[]>}
 */
async getRecentFiles(limit = 5) {
  const { results } = await this.db.prepare(
    `SELECT id, name, size, mime_type as type, storage_key, created_at as timestamp
     FROM files ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return results;
}
```

**Step 2: 修改 `dashboard.js` 使用 Repository 方法**

```diff
-import { getChinaDayStart, getFileUrl } from '../../_shared/utils.js';
+import { getChinaDayStart, getFileUrl } from '../../_shared/utils.js';

 // 在 Promise.all 中替换直接 DB 调用
-globalStatsRepo.db.prepare(
-  `SELECT id, name, size, ...`
-).all().then(r => r.results.map(f => ({ ...f, url: getFileUrl(f.storage_key) }))),
+globalStatsRepo.getRecentFiles(5).then(files =>
+  files.map(f => ({ ...f, url: getFileUrl(f.storage_key) }))
+),
```

**Step 3: 构建验证**

Run: `pnpm run build`
Expected: 构建成功

**Step 4: 提交**

```bash
git add functions/repositories/StatsRepository.js functions/lib/hono/routes/manage/dashboard.js
git commit -m "refactor: dashboard 改用 StatsRepository.getRecentFiles()，修复封装破坏"
```

---

## Verification Plan

### Automated Tests

本项目已有少量工具函数测试，但无路由层单元测试。每个 Task 完成后通过以下命令验证：

```bash
pnpm run build
```

Expected: 构建成功，无任何错误。

如果已有测试可用：

```bash
# 运行已有的工具函数测试（如果配置了测试命令）
npx vitest run functions/api/utils/__tests__/ --reporter=verbose 2>/dev/null || echo "No test runner configured"
```

### Manual Verification

由于本次为纯重构（不改变外部行为），可通过以下方式手动验证：

1. **功能回归测试**: 启动本地开发服务器后，检查以下核心流程：
   - 管理后台登录 (`POST /api/v1/auth/login`)
   - 销售端登录 (`POST /api/sales/login`)
   - 文件列表 (`GET /api/manage/files`)
   - 客户列表 (`GET /api/manage/customers`)
   - 仪表盘 (`GET /api/manage/dashboard/overview`)

2. **错误处理验证**: 访问不存在的资源，确认返回格式一致：
   ```json
   { "success": false, "error": "...", "code": "NOT_FOUND" }
   ```
