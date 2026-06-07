# API 性能加固与健壮性升级 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 系统性修复审查报告中发现的 22+ 端点缺失错误处理、串行查询瓶颈、生产调试残留等问题，使全部后端 API 达到 SOTA 水准。

**Architecture:** 采用渐进式修复策略，按优先级从 P0 到 P3 逐步推进。每个 Task 独立可验证，修复完即可提交。所有改动不变更数据库 Schema，不变更前端。

**Tech Stack:** Hono (路由), Cloudflare D1 (数据库), Promise.all (并行化), withCache (边缘缓存中间件)

**审查报告:** [api_performance_audit.md](file:///C:/Users/lelouch/.gemini/antigravity/brain/2a382784-cb13-4a76-a897-53e7af0d7db6/api_performance_audit.md)

---

## Task 1: [P0] customers.js — 补齐全部 try-catch

**Files:**

- Modify: `functions/lib/hono/routes/manage/customers.js`

**Step 1: 为所有 5 个端点添加 try-catch**

包裹以下端点的全部 handler 逻辑：

- `GET /` (L25-59)
- `POST /` (L64-80)
- `GET /:id` (L85-113)
- `PUT /:id` (L118-135)
- `DELETE /:id` (L140-158)

catch 块模板：

```javascript
} catch (err) {
    console.error('[Customers] 操作失败:', err);
    return c.json({ success: false, error: err.message }, 500);
}
```

> `GET /:id/orders` (L163) 是一个独立端点，也需要包裹。共 **6 个端点**。

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/customers.js
git commit -m "fix(customers): add try-catch error handling to all endpoints"
```

---

## Task 2: [P0] salespersons.js — 补齐全部 try-catch

**Files:**

- Modify: `functions/lib/hono/routes/manage/salespersons.js`

**Step 1: 为所有 7 个端点添加 try-catch**

包裹以下端点：

- `GET /` (L28-59)
- `POST /` (L64-81)
- `GET /:id` (L86-110)
- `updateHandler` (L115-140) — 此函数被 PUT 和 PATCH 共用
- `DELETE /:id` (L149-167)
- `POST /:id/reset-token` (L172-188)

catch 块模板：

```javascript
} catch (err) {
    console.error('[Salespersons] 操作失败:', err);
    return c.json({ success: false, error: err.message }, 500);
}
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/salespersons.js
git commit -m "fix(salespersons): add try-catch error handling to all endpoints"
```

---

## Task 3: [P0] orders/list.js — 补齐 try-catch + 并行化查询

**Files:**

- Modify: `functions/lib/hono/routes/manage/orders/list.js`

**Step 1: GET / — 用 Promise.all 并行化 + 包裹 try-catch**

将串行的两个查询改为并行：

```javascript
// ❌ 旧代码 (串行)
const result = await orderRepo.listForAdmin({...});
const { results: salespersons } = await env.DB.prepare('SELECT ...').all();

// ✅ 新代码 (并行)
const [result, { results: salespersons }] = await Promise.all([
    orderRepo.listForAdmin({ salespersonId, status: ..., search, startTime, endTime, page, limit }),
    env.DB.prepare('SELECT id, name, store FROM salespersons WHERE is_active = 1 ORDER BY name').all(),
]);
```

同时为 **GET /**, **GET /stats**, **GET /export** 三个端点全部添加 try-catch：

```javascript
} catch (err) {
    console.error('[Orders/List] 操作失败:', err);
    return c.json({ success: false, error: err.message }, 500);
}
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/orders/list.js
git commit -m "perf(orders): parallelize list queries with Promise.all and add error handling"
```

---

## Task 4: [P0] orders/detail.js — 补齐 try-catch

**Files:**

- Modify: `functions/lib/hono/routes/manage/orders/detail.js`

**Step 1: 为所有 5 个端点添加 try-catch**

包裹以下端点：

- `GET /:id` (L12-39)
- `PATCH /:id` (L44-95)
- `PATCH /:id/status` (L100-141)
- `POST /:id/comment` (L146-181)
- `DELETE /:id` (L186-203)

catch 块模板：

```javascript
} catch (err) {
    console.error('[Orders/Detail] 操作失败:', err);
    return c.json({ success: false, error: err.message }, 500);
}
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/orders/detail.js
git commit -m "fix(orders/detail): add try-catch error handling to all endpoints"
```

---

## Task 5: [P0] products/[id].js — 补齐 try-catch + 清理调试日志 + 改用 Repository

**Files:**

- Modify: `functions/lib/hono/routes/manage/products/[id].js`

**Step 1: GET /:id — 改用 ProductRepository**

```javascript
// ❌ 旧代码：裸 SQL
const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();

// ✅ 新代码：使用 Repository (已引入 ProductRepository)
const repo = new ProductRepository(env.DB);
const product = await repo.findById(id);
```

> `ProductRepository.findById()` 已存在，且内部会自动解析 `images` 和 `specifications` JSON 字段，所以后面的手动 JSON.parse 也可以删除。

**Step 2: PATCH /:id — 删除 3 行调试 console.log**

删除第 50-55 行的三个 `console.log`：

```javascript
// ❌ 删除以下三行
console.log('[PATCH /products/:id] ID:', id);
console.log('[PATCH /products/:id] Body:', JSON.stringify(body));
console.log('[PATCH /products/:id] Result:', JSON.stringify(result));
```

**Step 3: 为所有 4 个端点添加 try-catch**

包裹 `GET /:id`, `PATCH /:id`, `PUT /:id`, `DELETE /:id`。

**Step 4: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 5: 提交**

```bash
git add functions/lib/hono/routes/manage/products/[id].js
git commit -m "fix(products): use repository pattern, remove debug logs, add error handling"
```

---

## Task 6: [P1] StatsRepository.getGlobalStats() — 全面并行化

**Files:**

- Modify: `functions/repositories/StatsRepository.js`

**Step 1: 将全部 6 个查询统一放入 Promise.all**

当前代码：先 `Promise.all` 执行 3 个查询，再串行执行 3 个。改为一次性并行全部 6 个：

```javascript
async getGlobalStats(todayStart) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [
        counts,
        recentFiles,
        fileStatusStats,
        // 以下 3 个原来是串行的，现在并入 Promise.all
        typeStatsResult,
        topSpacesResult,
        trafficLogsResult,
    ] = await Promise.all([
        // 原有 3 个查询不变...
        this.db.prepare(`SELECT ...`).bind(todayStart).first(),
        this.db.prepare(`SELECT ...`).all(),
        this.db.prepare(`SELECT ...`).all(),
        // 新并入的 3 个查询
        this.db.prepare(`SELECT mime_type as type, COUNT(*) as count, COALESCE(SUM(size), 0) as size FROM files GROUP BY mime_type ORDER BY count DESC`).all(),
        this.db.prepare(`SELECT id, name, view_count as views, created_at FROM spaces ORDER BY view_count DESC LIMIT 5`).all(),
        this.db.prepare(`SELECT DATE(accessed_at / 1000, 'unixepoch', '+8 hours') as date, COUNT(*) as count FROM space_access_logs WHERE accessed_at >= ? GROUP BY date ORDER BY date ASC`).bind(thirtyDaysAgo).all(),
    ]);

    const typeStats = typeStatsResult.results;
    const topSpaces = topSpacesResult.results;
    const trafficLogs = trafficLogsResult.results;
    // ... 后续逻辑不变
}
```

> **性能影响**：原来 6 个查询串行执行约需 6 个 RTT。改为全部并行后只需 1 个 RTT（D1 会批处理）。对统计页的加载速度提升约 **60-70%**。

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 3: 提交**

```bash
git add functions/repositories/StatsRepository.js
git commit -m "perf(stats): parallelize all 6 queries in getGlobalStats with Promise.all"
```

---

## Task 7: [P2] 高频只读端点加缓存

**Files:**

- Modify: `functions/lib/hono/routes/manage/salespersons.js`
- Modify: `functions/lib/hono/routes/manage/customers.js`

**Step 1: salespersons.js GET / 添加 withCache(120)**

```javascript
import { withCache } from '../../middleware/cache.js';

// ✅ 120秒缓存，因为销售人员信息变化不频繁
app.get('/', withCache(120), async (c) => { ... });
```

**Step 2: customers.js GET / 添加 withCache(60)**

```javascript
import { withCache } from '../../middleware/cache.js';

// ✅ 60秒缓存
app.get('/', withCache(60), async (c) => { ... });
```

**Step 3: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 4: 提交**

```bash
git add functions/lib/hono/routes/manage/salespersons.js functions/lib/hono/routes/manage/customers.js
git commit -m "perf(api): add edge cache to salespersons (120s) and customers (60s) list endpoints"
```

---

## Task 8: [P0] products/index.js — 补齐 GET / 的 try-catch

**Files:**

- Modify: `functions/lib/hono/routes/manage/products/index.js`

**Step 1: GET / 添加 try-catch**

当前代码（L23-46）没有 try-catch，POST / （L51-73）已有部分 try-catch 但只包裹了 create 操作而没有包裹 SKU 检查等前置逻辑。

将 GET / 整体包裹进 try-catch。

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/products/index.js
git commit -m "fix(products): add try-catch error handling to GET list endpoint"
```

---

## 验证计划

### 自动验证

- 每个 Task 完成后运行 `pnpm run build` 确保编译通过
- 最终运行 `pnpm run build` 做全量回归

### 手动验证

- 部署后在管理后台分别访问客户页、销售页、订单列表页、商品详情页，验证正常功能不受影响
- 可使用浏览器 DevTools Network 面板对比查询延迟变化（特别是统计页和订单列表页）

---

## 预估时间表

| Task                                | 预估时间     | 累计提交      |
| ----------------------------------- | ------------ | ------------- |
| Task 1 (customers try-catch)        | ~3 分钟      | 1             |
| Task 2 (salespersons try-catch)     | ~3 分钟      | 2             |
| Task 3 (orders/list 并行+try-catch) | ~5 分钟      | 3             |
| Task 4 (orders/detail try-catch)    | ~3 分钟      | 4             |
| Task 5 (products/[id] 综合修复)     | ~5 分钟      | 5             |
| Task 6 (StatsRepository 全面并行化) | ~5 分钟      | 6             |
| Task 7 (高频端点加缓存)             | ~3 分钟      | 7             |
| Task 8 (products/index try-catch)   | ~2 分钟      | 8             |
| **合计**                            | **~29 分钟** | **8 commits** |
