# AI Vision-First and Order Cache Regression Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 1 个 AI 路由行为回归和 3 个订单读写缓存一致性回归，恢复工具调用正确性与 unread 状态实时性。

**Architecture:** 先在 `manage/ai` 将 vision-first 判定收敛到“当前用户轮次”，避免历史图片污染后续文本轮次；再在订单路由中把 read/unread 状态变更与缓存失效绑定，确保列表缓存与 DB 状态同步。整体采用 TDD：先补失败测试，再最小改动通过。

**Tech Stack:** Hono routes, Cloudflare Cache API (`withCache`/`invalidateCache`), shared cache URL helpers (`cache-urls.js`), Vitest.

---

## Scope

### In Scope
- Finding 1: `manage/ai` vision-first 判定范围修正。
- Finding 2: 管理端订单列表缓存与 `markAsRead(..., 'admin')` 失效联动。
- Finding 3: 销售端订单列表缓存与 `markAsRead(..., 'sales')` 失效联动。
- Finding 4: 销售端评论触发管理员 unread 后的管理端列表缓存失效。

### Out of Scope
- 与本次 4 个 finding 无关的 cache 策略重构。
- 新增大范围缓存中间件行为变更（仅做必要修复）。

---

### Task 1: Fix vision-first scope to current user turn (P1)

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

**Step 1: Write the failing test**
- 在 `ai-routes.test.js` 增加用例：
  - 历史第一条 user message 含 image；
  - 最后一条 user message 为纯文本；
  - 断言本轮调用 `callAI` / `callAIStream` 时 tools 不应被清空（不等于 `[]`）。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Expected: FAIL（当前实现会错误进入 `visionFirst=true`）。

**Step 3: Write minimal implementation**
- 将 `hasImageInUserHistory` 改为仅检查“最后一条 user message”是否包含 image（可新增 `hasImageInLatestUserTurn`）。
- `/chat` 和 `/stream` 均改用新判定函数。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Expected: PASS.

**Step 5: Commit**
```bash
git add functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
git commit -m "fix(ai): limit vision-first mode to latest user turn"
```

---

### Task 2: Invalidate manage order list cache after admin read (P2)

**Files:**
- Modify: `functions/lib/hono/routes/manage/orders/detail.js`
- Modify: `functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js` (create if missing)
- (Optional) Reuse helper: `functions/lib/hono/routes/_shared/cache-urls.js`

**Step 1: Write the failing test**
- 新增用例验证 `GET /api/manage/orders/:id` 在执行 `markAsRead(id, 'admin')` 后，会调用 `invalidateCache` 且覆盖 `getManageOrderCacheUrls(c)` 产物。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`
- Expected: FAIL（当前无对应失效逻辑）。

**Step 3: Write minimal implementation**
- 在 `manage/orders/detail.js` 的详情读取路径（`markAsRead` 后）添加：
  - `invalidateCache(getManageOrderCacheUrls(c))`（`waitUntil`）。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`
- Expected: PASS.

**Step 5: Commit**
```bash
git add functions/lib/hono/routes/manage/orders/detail.js functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js
git commit -m "fix(cache): invalidate manage order list after admin read"
```

---

### Task 3: Invalidate sales order list cache after sales read (P2)

**Files:**
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Reuse helper: `functions/lib/hono/routes/_shared/cache-urls.js`

**Step 1: Write the failing tests**
- 为以下路径增加断言（mock `invalidateCache`）：
  - `GET /api/sales/:token/orders/:id`（内部 `markAsRead`）后应失效 token 对应 sales order list cache。
  - `PATCH /api/sales/:token/orders/:id/read` 后应失效同一组 cache。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Expected: FAIL.

**Step 3: Write minimal implementation**
- 在上述两个 read 路径补充：
  - `invalidateCache(getSalesOrderCacheUrls(c, { salesTokens: [token] }))`（`waitUntil`）。
- 若当前文件未引入 `getSalesOrderCacheUrls`，从 `cache-urls.js` 增补 import。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Expected: PASS.

**Step 5: Commit**
```bash
git add functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
git commit -m "fix(cache): invalidate sales order list after read transitions"
```

---

### Task 4: Invalidate manage order list cache after salesperson comment (P2)

**Files:**
- Modify: `functions/lib/hono/routes/sales/orders.js`
- Modify: `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Reuse helper: `functions/lib/hono/routes/_shared/cache-urls.js`

**Step 1: Write the failing test**
- 新增用例：`POST /api/sales/:token/orders/:id/comment` 触发 `setUnread(orderId, 'sales')` 后，除了通知缓存，还会失效 `getManageOrderCacheUrls(c)`。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Expected: FAIL.

**Step 3: Write minimal implementation**
- 在 comment 路径补充管理端订单列表缓存失效：
  - `invalidateCache(getManageOrderCacheUrls(c))`（`waitUntil`）。
- 保留现有通知缓存失效逻辑。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- Expected: PASS.

**Step 5: Commit**
```bash
git add functions/lib/hono/routes/sales/orders.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js
git commit -m "fix(cache): invalidate manage order list after sales comments"
```

---

### Task 5: Regression sweep and integration verification

**Files:**
- No code changes expected; run verification only.

**Step 1: Run targeted suites**
- Run:
  - `pnpm test:unit functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - `pnpm test:unit functions/lib/hono/routes/manage/orders/__tests__/order-detail-routes.test.js`
  - `pnpm test:unit functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`

**Step 2: Run route-wide suite**
- Run: `pnpm test:unit functions/lib/hono/routes`
- Expected: PASS.

**Step 3: Capture verification note**
- 在 PR/提交说明中记录：
  - 修复的 finding 编号（1-4）；
  - 对应测试名称与通过结果。

---

## Risk Notes
- `GET /orders/:id` 读请求现在会触发缓存失效，需确认性能可接受（目标是 correctness 优先）。
- 销售端 read 失效按 token 维度进行，避免无关 token 级别的广泛清理。
- 若测试中存在 mock 覆盖不足，先补 route test mock，再进行实现改动。

## Recommended Execution Order
1. Task 1 (P1)  
2. Task 2 (P2)  
3. Task 3 (P2)  
4. Task 4 (P2)  
5. Task 5 (verification)
