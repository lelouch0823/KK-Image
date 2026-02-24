# 采购单创建流程优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构采购单创建流程，支持「按预定订单采购 (Order-Driven)」和「按商品缺口补货 (Demand-Driven)」两个维度引入采购明细，并在创建后的详情面板中支持草稿状态下的增删改。

**Architecture:**
1. 将现有的极简 Create Modal 重构为一个功能完备的「新建采购单」全屏面板（或大尺寸弹窗），包含：基础信息区 + 采购商品列表 + 两个「引入」按钮
2. 新建 `OrderPickerModal.vue`：弹窗组件，列出 `confirmed` 订单，支持搜索+多选
3. 新建 `ProductPickerModal.vue`：弹窗组件，列出所有商品，优先推荐同品牌未选商品，支持搜索+多选
4. 增强 Detail Panel：草稿状态下，明细列表支持增删改操作

**Tech Stack:** Vue 3 Composition API (`<script setup>`)、Tailwind CSS v4、VueUse (`useDebounceFn`)

---

## 核心数据流

```
┌───────────────────────────────────────────────────────────┐
│                    新建采购单 Modal                        │
│                                                           │
│  [基础信息: 备注 / 预估运费 / 预估关税 / 分摊方式]        │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 采购商品列表 (本地 reactive 数组: poItems[])        │  │
│  │                                                     │  │
│  │ ┌──────────┬──────┬──────┬──────┬────────┬───────┐ │  │
│  │ │ 商品名   │ SKU  │ 品牌 │ 数量 │ 单价   │ 来源  │ │  │
│  │ ├──────────┼──────┼──────┼──────┼────────┼───────┤ │  │
│  │ │ Birkin25 │ HB01 │ H    │ 3⚠️ │ ¥8000  │ 订单A │ │  │
│  │ │ Kelly28  │ HK02 │ H    │ 2   │ ¥9500  │ 补货  │ │  │
│  │ └──────────┴──────┴──────┴──────┴────────┴───────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  [+ 关联预定单]            [+ 增加商品]                   │
│                                    [取消]  [创建采购单]   │
└───────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   OrderPickerModal              ProductPickerModal
   (confirmed orders)            (all products, 同品牌优先)
```

---

## Proposed Changes

### 前端组件层

---

#### [NEW] [OrderPickerModal.vue](file:///o:/Code/KK-Image/src/components/purchase-order/OrderPickerModal.vue)

**职责：** 弹窗列出所有 `confirmed` 状态的客户订单，支持搜索 + 多选。

**核心功能：**
- 调用 `useOrders().loadOrders({ status: 'confirmed', limit: 100 })` 获取列表
- 搜索框：按订单号/商品名称过滤（前端过滤 or 传 `search` 参数到后端）
- 每行显示：订单号、商品名、数量、客户名
- 多选 checkbox，底部显示「确认选择 (N)」按钮
- `emit('confirm', selectedOrders)` 返回完整的订单对象数组

---

#### [NEW] [ProductPickerModal.vue](file:///o:/Code/KK-Image/src/components/purchase-order/ProductPickerModal.vue)

**职责：** 弹窗列出所有商品，支持搜索 + 多选。已选品牌的同品牌未加入商品置顶推荐。

**核心功能：**
- 接收 `props.existingBrands: string[]`（从已选 poItems 中提取）
- 调用 `useProducts().loadProducts({ search, limit: 20 })` 搜索
- 排序逻辑：同品牌商品置顶，其余按名称排序
- 多选 checkbox，底部「确认选择 (N)」
- `emit('confirm', selectedProducts)` 返回商品对象数组

---

#### [MODIFY] [PurchaseOrders.vue](file:///o:/Code/KK-Image/src/views/PurchaseOrders.vue)

**修改 1：重构 Create Modal (line 357-409)**

将现有极简弹窗替换为包含「采购商品列表」的完整创建面板：

- 新增本地 `reactive` 数组 `poItems`：`[{ product_id, product_name, sku, brand, quantity, unit_cost, customer_order_id?, order_no?, required_quantity? }]`
- 新增「+ 关联预定单」按钮 → 打开 `OrderPickerModal`
- 新增「+ 增加商品」按钮 → 打开 `ProductPickerModal`
- 采购商品列表表格：
  - 列：商品名 | SKU | 品牌 | 采购数量（可编辑 input） | 单价（可编辑 input） | 来源标签 | 删除按钮
  - 数量 < `required_quantity` 时，数字标红 `text-[var(--color-danger)]`
- 提交时：如果存在 quantity < required_quantity 的行，弹出二次确认弹窗
- 提交逻辑：
  - 有 `customer_order_id` 的 items → 调用 `createFromOrders` 前先做 items 数据清洗
  - 所有情况都走 `POST /` (创建 PO) + `POST /:id/items` (批量添加明细) 的两步流程

**修改 2：增强 Detail Panel (line 310-344)**

- 草稿状态下，在明细列表表头右侧增加：
  - 「+ 关联预定单」按钮
  - 「+ 增加商品」按钮
  - 每行增加「删除」按钮（调用 `removeItem`）
- 与预定订单关联的商品行：锁定删除（显示 tooltip "请先取消关联的预定单"），但数量可修改
- 修改数量后调用新增的 `updateItem` API

---

#### [MODIFY] [usePurchaseOrders.js](file:///o:/Code/KK-Image/src/composables/usePurchaseOrders.js)

新增方法：
- `updateItem(poId, itemId, updates)` → `PATCH /:id/items/:itemId`（需要后端新增路由）

---

### 后端 API 层

---

#### [MODIFY] [purchase-orders.js](file:///o:/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js)

新增路由：
```javascript
// PATCH /:id/items/:itemId — 更新单条明细（数量/单价）
app.patch('/:id/items/:itemId', async (c) => {
  const body = await c.req.json();
  const repo = new PurchaseOrderRepository(c.env.DB);
  const po = await repo.findById(c.req.param('id'));
  if (!po) throw new NotFoundError('采购单不存在');
  if (po.status !== 'draft') throw new BadRequestError('仅草稿状态允许修改明细');
  
  const updated = await repo.updateItem(c.req.param('itemId'), body);
  if (!updated) throw new NotFoundError('明细不存在');
  return c.json({ success: true });
});
```

---

#### [MODIFY] [PurchaseOrderRepository.js](file:///o:/Code/KK-Image/functions/repositories/PurchaseOrderRepository.js)

新增方法：
```javascript
// 更新单条明细项
async updateItem(itemId, updates) {
  const fields = [];
  const values = [];
  
  if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity); }
  if (updates.unit_cost !== undefined) { fields.push('unit_cost = ?'); values.push(updates.unit_cost); }
  
  if (fields.length === 0) return false;
  
  values.push(itemId);
  const result = await this.db.prepare(
    `UPDATE purchase_order_items SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  return result.changes > 0;
}
```

---

### 国际化

#### [MODIFY] zh-CN/purchaseOrder.js + en/purchaseOrder.js

新增键：
```javascript
// 选择器
'selection.orderTitle': '关联预定单',
'selection.orderSubtitle': '选择已确认的客户订单，系统将自动导入商品信息',
'selection.emptyOrders': '暂无已确认的客户订单',
'selection.productTitle': '增加商品',
'selection.productSubtitle': '搜索并选择要采购的商品',
'selection.recommendedBrand': '推荐（同品牌）',

// 创建表单
'form.linkOrders': '关联预定单',
'form.addProducts': '增加商品',
'form.noItems': '暂未添加采购商品，请通过上方按钮引入',
'form.source.order': '预定单',
'form.source.stock': '补货',
'form.quantityWarning': '采购数量低于预定需求',
'form.confirmShortage': '以下商品的采购数量低于预定单需求，确认继续创建？',

// 详情面板增强
'action.addOrder': '关联预定单',
'action.addProduct': '增加商品',
'action.selectOrders': '选择预定单',
'detail.linkedOrder': '关联订单',
'detail.orderLocked': '与预定单关联的商品请通过管理关联订单来变更',
```

---

### 采购单 ↔ 商品库存联动 (PO-Inventory Linkage)

> **当前问题：** `PurchaseOrderService.updateStatus()` 在状态变更时只级联更新客户订单状态，**完全不碰** `products.stock_quantity`。这意味着即使采购单到货了，商品库存依然为 0，订货总览的 `shortage` 永远不能被消除。

#### 设计分析：什么时候该更新库存？

```
采购单状态流转:
  draft → ordered → shipping → arrived → completed → (结束)
                               ↑ cancelled
                               
商品库存变更时机:
  ┌──────────┬──────────────────────────────────────────────────────┐
  │ 状态变更  │ 库存操作                                            │
  ├──────────┼──────────────────────────────────────────────────────┤
  │ → arrived│ ✅ 入库：stock_quantity += 每条明细的 quantity        │
  │ → cancel │ ⚠️ 回滚：如果之前已入库(was arrived), stock -= qty   │
  │ 其他变更  │ 无操作                                              │
  └──────────┴──────────────────────────────────────────────────────┘
```

**为什么选择 `arrived` 而不是 `completed`？**
- `arrived` = 货到了，物理上进了仓库，理应立刻反映到库存
- `completed` = 财务结算完毕（属于成本层操作），此时库存早已入库
- 这样最贴合实际：采购员收货→标记到货→库存立刻加上→客户订单同步变成"已到货"

---

#### [MODIFY] [PurchaseOrderService.js](file:///o:/Code/KK-Image/functions/services/PurchaseOrderService.js)

在 `updateStatus()` 方法中，**step 3（级联）和 step 4（成本分摊）之间**，加入库存更新逻辑：

```javascript
// === 新增 Step 3.5: 库存联动 ===
if (newStatus === 'arrived') {
  // 入库：按明细批量增加商品库存
  await this._updateInventory(po.items, 'increment');
}

// 如果从 arrived 状态取消（极端回滚场景）
if (newStatus === 'cancelled' && po.status === 'arrived') {
  // 回滚库存：按明细批量减少商品库存
  await this._updateInventory(po.items, 'decrement');
}
```

新增私有方法 `_updateInventory()`：

```javascript
/**
 * 批量更新商品库存（原子增减操作）
 * 使用 D1 batch 确保事务性
 *
 * @param {Array} items - 采购单明细 (含 product_id, quantity)
 * @param {'increment'|'decrement'} direction - 增 or 减
 */
async _updateInventory(items, direction = 'increment') {
  if (!items || items.length === 0) return;

  // 按 product_id 聚合数量（同一商品可能出现在多条明细中）
  const stockChanges = {};
  for (const item of items) {
    if (!item.product_id) continue;
    stockChanges[item.product_id] = (stockChanges[item.product_id] || 0) + (item.quantity || 0);
  }

  const operator = direction === 'increment' ? '+' : '-';
  const now = Date.now();
  
  const stmts = Object.entries(stockChanges).map(([productId, qty]) =>
    this.db.prepare(
      `UPDATE products 
       SET stock_quantity = MAX(0, stock_quantity ${operator} ?), 
           updated_at = ? 
       WHERE id = ?`
    ).bind(qty, now, productId)
  );

  if (stmts.length > 0) {
    await this.db.batch(stmts);
  }
}
```

**关键细节：**
- 使用 `MAX(0, stock_quantity - ?)` 防止库存变为负数
- 使用 `D1 batch()` 确保批量操作的原子性
- 按 `product_id` 聚合：同一商品在同一采购单中可能有多条明细（代购订单 A 买 1 个 + 补货 2 个 = 同商品 2 条明细，总增 3）

---

#### 完整级联流程图（增强版）

```
采购单状态: draft → ordered → shipping → arrived → completed
                                           │
                ┌──────────────────────────┤
                ▼                          ▼
      客户订单状态级联             商品库存 +N
      confirmed → production     products.stock_quantity += poi.quantity
      production → shipping      (按 product_id 聚合)
      shipping → arrived
                                           │
                                           ▼
                                  订货总览 shortage 自动重算
                                  shortage = demand - stock_quantity
                                  (无需额外操作，每次查询实时计算)
```

---

#### [MODIFY] [ProductRepository.js](file:///o:/Code/KK-Image/functions/repositories/ProductRepository.js)

新增原子增减方法（可选，供其他场景复用）：

```javascript
/**
 * 原子增减库存
 * @param {string} productId
 * @param {number} delta - 正数加库存，负数减库存
 */
async adjustStock(productId, delta) {
  const now = Date.now();
  const result = await this.db.prepare(
    `UPDATE products 
     SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? 
     WHERE id = ?`
  ).bind(delta, now, productId).run();
  return result.meta?.changes > 0;
}
```

---

#### 前端展示联动

在 `PurchaseOrders.vue` **详情面板**中，当用户点击「标记到货」时：
- Toast 提示增强：`"状态已更新，同步更新了 N 个客户订单，库存已入库 M 件"`
- 这需要后端 `updateStatus` 返回库存变更信息

修改 `updateStatus` 返回值：

```javascript
return { 
  success: true, 
  cascadedOrders, 
  stockUpdated: newStatus === 'arrived' ? Object.keys(stockChanges).length : 0,
  totalStockAdded: newStatus === 'arrived' 
    ? Object.values(stockChanges).reduce((a, b) => a + b, 0) 
    : 0 
};
```

---

## Verification Plan

### Build 验证
```bash
pnpm run build
```

### 手动验证
1. 打开 `/manage/scm/purchase-orders`，点击「新建」
2. 点击「+ 关联预定单」，验证弹出订单选择弹窗，搜索并多选
3. 确认后验证商品自动填入列表，修改数量使其低于需求值 → 数字标红
4. 点击创建 → 弹出二次确认弹窗
5. 确认创建后从列表进入详情，验证明细正确
6. 在详情面板中测试增删改操作
7. **库存联动验证**：
   - 创建含 3 个商品的采购单 → 标记为 arrived
   - 检查商品的 `stock_quantity` 是否正确增加
   - 检查订货总览 shortage 是否自动减少
   - 取消已到货的采购单 → 检查库存是否正确回滚
