# Space Product Association Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 允许在共享空间 (Space) 编辑器中关联实际的商品 (Product)，完善空间与商品的绑定功能。

**Architecture:** 
此功能分为三层实现：
1. 数据库层：通过新增 migration 向 `spaces` 表添加 `product_id` 外键。
2. API层：修改后端的 Zod 验证规则 ( `crud.js` )，以及 `SpaceRepository.js` 中的查询和更新语句，读取并保存 `product_id`（并关联查询产品基础信息）。
3. 前端层：在 `SpaceProductEditor.vue` 的左侧商品信息栏 ( `info` tab ) 引入 `ProductBindingSection.vue`，实现商品的选择、解绑，以及提交给后端保存。

**Tech Stack:** Vue 3, Cloudflare D1 (SQLite), Hono (Cloudflare Workers)

---

### Task 1: 数据库 Migration

**Files:**
- Create: `migrations/0033_add_product_id_to_spaces.sql`

**Step 1: Write the failing test**
不需要传统测试框架。执行前通过 D1 手动测试 `PRAGMA table_info(spaces)` 不应包含 `product_id`。

**Step 2: Write minimal implementation**
在 `migrations/0033_add_product_id_to_spaces.sql` 编写如下 SQL 语句：
```sql
-- Migration: 0033_add_product_id_to_spaces.sql
-- Description: Add product_id to spaces to allow associating actual products with spaces

ALTER TABLE spaces ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spaces_product_id ON spaces(product_id);
```

**Step 3: Run test to verify it passes**
Run: `npm run db:migrate:local` （假设使用本地 Wrangler D1 migration 命令，具体根据此项目配置执行，比如 `npx wrangler d1 migrations apply database --local`）
Expected: 成功执行迁移。

**Step 4: Commit**
```bash
git add migrations/0033_add_product_id_to_spaces.sql
git commit -m "feat(db): add product_id to spaces table"
```

---

### Task 2: 后端 API 和 Repository 更新

**Files:**
- Modify: `functions/lib/hono/routes/manage/spaces/crud.js`
- Modify: `functions/repositories/SpaceRepository.js`

**Step 1: Write minimal implementation (Repository)**
在 `functions/repositories/SpaceRepository.js` 中：
1. `getWithFiles(id)` 和 `findAll()` 和 `findByIdForSalesperson()` 中，使用 `LEFT JOIN products p ON s.product_id = p.id` 扩展查询，返回 `product_id` 以及关联的产品信息（如 `p.name as product_name, p.sku as product_sku, p.images as product_images` 等，若需要）。但由于前端只需要简单的 id 取回即可，我们可以仅返回 `product_id`。为了优化前端 `ProductBindingSection`，建议在 `getWithFiles` 中联表查询绑定产品的基础信息。
2. `create(data)` 增加 `data.productId` 的插入。
3. `update()` 中收集并更新 `product_id = ?`。

**Step 2: Write minimal implementation (crud.js)**
在 `functions/lib/hono/routes/manage/spaces/crud.js` 中：
1. `CreateSpaceSchema` 和 `UpdateSpaceSchema` 增加：
   ```javascript
   productId: z.string().optional().nullable(),
   ```
2. 在 `crud.post('/')` 和 `crud.on(['PUT', 'PATCH'])` 中，从 `data` 获取 `productId`，并在调用 `repo.create` 和构建 `updates/values` 数组时传入 `productId`。

**Step 3: Commit**
```bash
git add functions/lib/hono/routes/manage/spaces/crud.js functions/repositories/SpaceRepository.js
git commit -m "feat(api): support product_id field for spaces"
```

---

### Task 3: 前端 SpaceProductEditor.vue 引入选品组件

**Files:**
- Modify: `src/components/SpaceProductEditor.vue`

**Step 1: Write minimal implementation**
1. 在 `<script setup>` 中引入：
   ```javascript
   import ProductBindingSection from '@/components/order/ProductBindingSection.vue';
   ```
2. 新增响应式状态：
   ```javascript
   const boundProduct = ref(null);
   // form.value 增加 productId: null
   ```
3. `initData` 方法中处理绑定的产品数据。如果在 Task 2 中 `loadSpace` 接口返回了 `product` 相关字段，则在这里初始化 `boundProduct.value = { ... }` 和 `form.value.productId`。如果未返回全量数据，可自行调用 `loadProduct` 补全。
4. 提供 `@select` 和 `@unbind` 对应的 handler 方法。
5. 在左侧面板的 UI 中 (在 `<div class="flex-1 space-y-4 overflow-y-auto p-6">` 的顶部) 插入 `<ProductBindingSection>`:
   ```html
   <div class="mb-4">
     <ProductBindingSection
       :bound-product="boundProduct"
       @select="handleProductSelect"
       @unbind="unbindProduct"
     />
   </div>
   ```

**Step 2: Commit**
```bash
git add src/components/SpaceProductEditor.vue
git commit -m "feat(ui): add product binding section in space editor"
```

---

### Task 4: 手动功能验收 (Manual Verification)

在完成以上 Task 之后：
1. **测试用例 1: 绑定产品**：打开一个共享空间设置，在左侧栏使用商品搜索选择一个商品。点击保存，刷新页面，确保左侧成功显示刚刚绑定的商品且不丢失。
2. **测试用例 2: 解绑产品**：点击已绑定的商品右侧删除按钮，保存，刷新页面，确认绑定解除。
3. **测试用例 3: 数据流向查询**：通过数据库客户端查询 `spaces` 表，确认 `product_id` 正确写入。
