# Product Model SOTA 优化实施方案

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `products` 表从 MVP 级别升级至 SOTA 标准，增加库存管理、成本追踪和 SEO 优化能力。

**Architecture:** 在现有表结构上增量添加字段，保持向后兼容。不引入新表，遵循 YAGNI 原则。

**Tech Stack:** Cloudflare D1 (SQLite), Hono API, Vue 3 Frontend

---

## SOTA 评估结论

| 维度 | 现状 | 评分 | 优化 |
|:---|:---|:---:|:---|
| 库存管理 | ❌ 缺失 | 0/10 | +`stock_quantity`, `alert_threshold` |
| 价格精度 | ⚠️ REAL浮点 | 6/10 | 保持 (非财务系统) |
| 成本追踪 | ❌ 缺失 | 0/10 | +`cost_price` |
| SEO/URL | ❌ 缺失 | 0/10 | +`slug` |
| 审计追踪 | ✅ 时间戳 | 7/10 | 保持 (单管理员) |
| 软删除 | ✅ status=archived | 8/10 | 保持 |
| **综合** | | **7/10** | → 9/10 |

---

### Task 1: 数据库迁移

**Files:**
- Create: `migrations/0022_optimize_products.sql`

**Step 1: 创建迁移文件**

```sql
-- Migration: 0022_optimize_products.sql
-- SOTA Enhancement: 库存、成本、SEO

-- P0: 库存管理
ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN alert_threshold INTEGER DEFAULT 10;

-- P1: 成本追踪
ALTER TABLE products ADD COLUMN cost_price REAL;

-- P1: SEO 优化
ALTER TABLE products ADD COLUMN slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
```

**Step 2: 应用迁移**

```bash
npx wrangler d1 migrations apply DB --local
```
Expected: `0022_optimize_products.sql ✅`

**Step 3: Commit**

```bash
git add migrations/0022_optimize_products.sql
git commit -m "feat(db): add stock, cost_price, slug to products"
```

---

### Task 2: 更新 ProductRepository

**Files:**
- Modify: `functions/repositories/ProductRepository.js`

**Step 1: 更新 create 方法**

在 `create()` 中添加新字段:
```javascript
const product = {
    // ...existing fields
    stock_quantity: data.stockQuantity || 0,
    alert_threshold: data.alertThreshold || 10,
    cost_price: data.costPrice || null,
    slug: data.slug || null,
    // ...
};
```

**Step 2: 更新 update 方法**

在 `allowedFields` 数组中添加:
```javascript
const allowedFields = [
    'name', 'sku', 'category', 'brand', 'series', 
    'price', 'description', 'images', 'specifications', 'status',
    'stock_quantity', 'alert_threshold', 'cost_price', 'slug'  // NEW
];
```

**Step 3: Commit**

```bash
git add functions/repositories/ProductRepository.js
git commit -m "feat(repo): support new product fields in CRUD"
```

---

### Task 3: 更新 API 端点

**Files:**
- Modify: `functions/api/manage/products/index.js`
- Modify: `functions/api/manage/products/[id].js`

**Step 1: 更新 POST 端点**

在 `index.js` 中添加 slug 唯一性检查:
```javascript
// Check slug uniqueness if provided
if (body.slug) {
    const existingSlug = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(body.slug).first();
    if (existingSlug) {
        return c.json({ success: false, error: 'Slug already exists' }, 409);
    }
}
```

**Step 2: 更新 GET 详情**

在 `[id].js` GET 中添加新字段到返回结果 (已自动包含，无需修改)。

**Step 3: Commit**

```bash
git add functions/api/manage/products/
git commit -m "feat(api): add slug validation to product endpoints"
```

---

### Task 4: 验证

**Step 1: 验证表结构**

```bash
npx wrangler d1 execute DB --local --command "PRAGMA table_info(products);"
```
Expected: 包含 `stock_quantity`, `alert_threshold`, `cost_price`, `slug`

**Step 2: 测试 API**

```bash
curl -X POST http://localhost:8788/api/manage/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","sku":"T-001","stockQuantity":100,"costPrice":50,"slug":"test-product"}'
```

---

## 未来路线图 (暂不实施)

| 功能 | 原因 |
|:---|:---|
| 多仓库库存 | 当前单仓库足够 |
| 变体/多SKU | 复杂度高，通过 `series` 聚合替代 |
| 全文搜索 FTS5 | D1 支持待验证 |
