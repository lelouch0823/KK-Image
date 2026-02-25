# Product Variants Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 SOTA 商品多规格模型 (Product + Options + Variants)，支持在一个主商品下管理多个具象化规格（如颜色、尺寸），并实现库存、价格在变体（Variant）层级的独立追踪。

**Architecture:** 
采用 Shopify 风格的 `Product` (SPU) + `Options` (维度) + `Variants` (SKU) 架构。
1. `products` 表增加 `options` JSON 字段，用于前端渲染规格选择面板（例如 `[{"name": "Color", "values": ["Red", "Black"]}]`）。
2. 新增 `product_variants` 表，独立记录 `sku`, `price`, `stock_quantity`, `options_values` (如 `{"Color": "Red"}`)，并关联至 `product_id`。
3. 将业务系统（Orders, Purchase Orders, Spaces）关联的实体按需接入 `variant`。

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Workers (Hono), Vue 3 (Composition API), Tailwind CSS.

---

### Task 1: Database Schema & Migration

**Files:**
- Create: `migrations/0037_product_variants.sql`

**Step 1: Write the Migration Script**

```sql
-- Migration: 0037_product_variants.sql
-- Description: Implement SOTA Product + Variant Model

-- 1. Create Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    price REAL DEFAULT 0,
    cost_price REAL,
    stock_quantity INTEGER DEFAULT 0,
    options_values TEXT DEFAULT '{}', -- JSON: {"Color": "Red", "Size": "S"}
    image_id TEXT, -- specific variant image
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);

-- 2. Add properties to existing structures
ALTER TABLE products ADD COLUMN options TEXT DEFAULT '[]';

-- 3. Modify orders and related tables to reference variants
ALTER TABLE orders ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_variant ON orders(variant_id);

ALTER TABLE purchase_order_items ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_po_items_variant ON purchase_order_items(variant_id);

ALTER TABLE space_products ADD COLUMN variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE;
```

**Step 2: Apply Migration Locally**

Run: `pnpm run db:migrate:preview` or `npx wrangler d1 migrations apply DB --local`
Expected: Successfully applied migration 0037.

**Step 3: Commit**
```bash
git add migrations/0037_product_variants.sql
git commit -m "feat(db): add product variants schema for SOTA product model"
```

---

### Task 2: Backend Product Variant Repository

**Files:**
- Create: `functions/repositories/ProductVariantRepository.js`

**Step 1: Write Variant Repository Implementation**

```javascript
import { generateId, now } from '../api/utils/id.js';

export class ProductVariantRepository {
    constructor(db) {
        this.db = db;
    }

    async createBatch(productId, variantsData) {
        if (!variantsData || variantsData.length === 0) return [];
        const timestamp = now();
        const statements = [];
        const results = [];

        for (const v of variantsData) {
            const id = v.id || generateId();
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, options_values, image_id, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id, productId, v.sku, Number(v.price) || 0, v.cost_price ? Number(v.cost_price) : null, Number(v.stock_quantity) || 0, 
                    JSON.stringify(v.options_values || {}), v.image_id || null, v.status || 'active', timestamp, timestamp
                )
            );
            results.push({ ...v, id, product_id: productId });
        }
        await this.db.batch(statements);
        return results;
    }

    async findByProductId(productId) {
        const results = await this.db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC').bind(productId).all();
        return (results.results || []).map(r => ({...r, options_values: JSON.parse(r.options_values || '{}')}));
    }
    
    async adjustStock(variantId, delta) {
        const timestamp = now();
        const result = await this.db.prepare(
            `UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?`
        ).bind(delta, timestamp, variantId).run();
        return result.meta?.changes > 0;
    }
}
```

**Step 2: Commit**
```bash
git add functions/repositories/ProductVariantRepository.js
git commit -m "feat(repo): create ProductVariantRepository"
```

---

### Task 3: Update Main Product Repository & API

**Files:**
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`

**Step 1: Update ProductRepository parsing and sets**

*In `ProductRepository.js`:*
- Add `'options'` to `allowedFields` in `updateWithMeta()`.
- In `create()`, map `options: JSON.stringify(data.options || [])`.
- In `_parseResult()`, map `options: JSON.parse(item.options || '[]')`.

**Step 2: Update API to handle Variants on Product Create/Update**

*In `functions/lib/hono/routes/manage/products/index.js` (POST handler):*
```javascript
// ... after productRepo.create(data)...
if (data.variants && data.variants.length > 0) {
    const variantRepo = new ProductVariantRepository(db);
    await variantRepo.createBatch(product.id, data.variants);
}
```

*In `functions/lib/hono/routes/manage/products/[id].js` (GET handler):*
```javascript
// ... after product = await productRepo.findById(id) ...
const variantRepo = new ProductVariantRepository(db);
product.variants = await variantRepo.findByProductId(id);
```

**Step 3: Commit**
```bash
git add functions/repositories/ProductRepository.js functions/lib/hono/routes/manage/products/
git commit -m "feat(api): integrate variants into products API endpoints"
```

---

### Task 4: Frontend Product Editor & Composables (ui-ux-pro-max SOTA UI)

**Files:**
- Modify: `src/composables/useProducts.js`
- Modify: `src/components/product/ProductDetailModal.vue`
- Modify: `src/components/product/ProductCreateModal.vue`

**Step 1: Update Composables Payload**
Ensure `useProducts` payload builder supports fetching/submitting `options` and `variants` arrays untouched to the API.

**Step 2: App-Grade SOTA UI Upgrades based on ui-ux-pro-max**
*In `ProductCreateModal.vue` and `ProductDetailModal.vue`:*
Apply the **SaaS / E-commerce Product Variants Editor** pattern:

**UI Layout & Card Design:**
- Replace flat sections with **glassmorphism cards** for high-end look:
  `bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-6`.
- High contrast typography:
  Use `text-slate-900` for primary text and `text-slate-600` for muted text in light mode (minimum 4.5:1 ratio).

**Options Builder (Dynamic Array):**
- Add an "Add Option Layer" section (e.g. Size, Color) using Heroicons SVG (`w-5 h-5` with stable `transition-colors duration-200 hover:text-primary`). No emojis allowed.
- Each option has a stable pill-list interaction for inputting variation values (e.g. S, M, L).

**Variants Matrix Table with Auto-Generation:**
- **Auto Cartesian Product**: When options change, a `watch` dynamically generates the SKU grid without blowing up existing entered prices/stock.
- Use a compact table view with **hover state feedback**: `hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer`.
- Add quick bulk-edit toolbars at the top of the table to applying uniform pricing and inventory across all variants.

**Step 3: Run Dev Server and check UI Checkpoints**
Run: `pnpm run dev`
Expected: 
- SVG icons exclusively used.
- Dark mode/Light mode verified.
- Transitions and hover states are smooth (~200ms) with no layout shift.
- Table auto-generates correctly when `Color: Red, Blue` and `Size: S, M` are applied.

**Step 4: Commit**
```bash
git add src/composables/useProducts.js src/components/product/ProductCreateModal.vue src/components/product/ProductDetailModal.vue
git commit -m "feat(ui): implement SOTA variants editor with ui-ux-pro-max aesthetics"
```

---

### Task 5: Adapt Orders & Downstream Modules

**Files:**
- Modify: `functions/repositories/order/mutations.js`
- Modify: `src/components/order/ProductBindingSection.vue`

**Step 1: Enable variant selection on orders**
Update logic to handle checking and storing `variant_id` down to the DB. Ensure `ProductBindingSection.vue` lists the particular `variant.sku` and specs when making purchases.

**Step 2: Commit**
```bash
git commit -am "feat(orders): adapt order creation and tracking for product variants"
```

---
