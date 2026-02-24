# SOTA 供应链与采购审批流演进 (SCM Evolution Plan)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 抛弃简易的单品静态成本模式，引入真实供应链场景下的【采购单 (Purchase Orders)】概念。支持多订单/多缺口的智能合并采购，并在结算后自动进行跨国运费、关税的动态分摊，同时建立采购与客订的 SOTA 状态机级联。

**Architecture:** 
1. **数据库扩容**：增加 `purchase_orders` (主表) 和 `purchase_order_items` (明细表)。明细表中通过 `pre_order_id` 强关联前端预订单，不关联的表示为“补充公共库存”。
2. **状态机级联 (Cascading State)**：用底层事件总线或服务层封装状态转移机制。当采购单(PO)改变状态时，自动计算并流转其所有绑定的客订单(CO)状态。
3. **文案级分离 (Decoupled Vocabulary)**：将底层状态机状态定为技术语义（如 `purchasing`, `shipping`），在 `manage` (后台管理) 渲染为“已订购/发往国内”，在对外客户端 `sales` 渲染为“海外备货中”。
4. **动态成本分摊 (Moving Average Cost Allocations)**：当采购单到货结算实际 `shipping_cost` + `tariff_cost` 时，按商品金额或件数比例反算到 `products` 表的移动加权成本。

**Tech Stack:** Cloudflare D1 (SQLite), Hono (Backend), Vue 3 + Tailwind CSS v4 (Frontend)

---

### Task 1: 核心供应链表设计 (SCM Schema)

**Files:**
- Create: `migrations/0035_scm_purchase_orders.sql`

**Step 1: Write the migration script**

```sql
-- Migration: 0035_scm_purchase_orders.sql
-- Description: 引入采购单记录及商品加权平均成本

-- 修改订单状态 (由于 SQLite ALTER TABLE CHECK 限制，此处可以通过注释及前后台枚举转换规避，或只在应用层扩充，暂不改写 orders 表结构，在业务代码做扩展)
-- 但最好更新 orders 使得可以兼容 'purchasing' 状态
-- 暂不修改 orders.status 的 CHECK constraint，因为 sqlite 限制。我们保持 'production' 等价于 'purchasing'

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_no TEXT UNIQUE NOT NULL,             -- 采购单号 (如 PO-20260224-001)
    status TEXT DEFAULT 'draft' CHECK(status IN (
        'draft',        -- 草稿 (选品中)
        'ordered',      -- 已向海外下单
        'shipping',     -- 国际物流在途
        'arrived',      -- 已入库/待分摊结算
        'completed',    -- 财务已结算分摊
        'cancelled'     -- 已取消
    )),
    total_goods_cost REAL DEFAULT 0,        -- 商品实际入货总额
    actual_shipping_cost REAL DEFAULT 0,    -- 运费总额 (结算时填入)
    actual_tariff_cost TEXT DEFAULT 0,      -- 关税总额 (结算时填入)
    currency TEXT DEFAULT 'CNY',            -- 结算币种
    remark TEXT,
    
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER                    -- 完结时间
);

CREATE INDEX idx_purchase_orders_no ON purchase_orders(po_no);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    pre_order_id TEXT,                 -- 绑定的预订单ID (NULL 表示补库存)
    
    quantity INTEGER DEFAULT 1,             -- 采购数量
    unit_cost REAL DEFAULT 0,               -- 单件入货成本 (外币或人民币本位)
    allocated_freight REAL DEFAULT 0,       -- 分摊到的单件运费 (完结时计算)
    allocated_tariff REAL DEFAULT 0,        -- 分摊到的单件关税 (完结时计算)
    
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (pre_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX idx_po_items_order ON purchase_order_items(pre_order_id);
```

**Step 2: Run migration locally**
Run: `npx wrangler d1 migrations apply kk-image-db --local`
Expected: 成功执行并生成 SCM 基础结构。

**Step 3: Commit**
```bash
git add migrations/0035_scm_purchase_orders.sql
git commit -m "feat(db): 建立真实采购单(Purchase Orders)及明细关联模型"
```

---

### Task 2: 后端 - 采购状态机与级联更新服务 (Cascading Service)

**Files:**
- Create: `functions/services/PurchaseOrderService.js` (或类似领域服务位置)
- Modify: `functions/lib/hono/routes/manage/purchase-orders.js` (新增路由)

**Step 1: Write state machine logic**
创建 `PurchaseOrderService.js` 封装 `updateStatus`，当 `status` 变更为：
- `ordered`: 将关联的所有 `pre_order_id` 状态变更为 `production` (代表采购中)。
- `shipping`: 关联客订单变更为 `shipping`。
- `arrived`: 关联客订单变更为 `arrived`。
- `completed`: 触发【成本动态分摊算法】：`总运费 / 总商品价值(或件数) = 分摊权重`，更新 `purchase_order_items` 中的 `allocated_freight/tariff`，并将此批 `unit_cost + 分摊附加费` 滚入 `products` 表计算新的加权平均 `cost_price`。

**Step 2: API Endpoints**
- `POST /` - 接收 `items[]` (包含预订单 ids 及补库数量) 生成草稿单。
- `PATCH /:id/status` - 流转状态，触发服务级联。
- `PUT /:id/costs` - 结算环节填入国际运费和关税。

**Step 3: Commit**
```bash
git add functions/services/PurchaseOrderService.js functions/lib/hono/routes/manage/purchase-orders.js
git commit -m "feat(api): 增加采购单核心服务、状态级联引擎与成本分摊算法"
```

---

### Task 3: 前端 - 智能选单与术语文案解耦 (UI/UX)

**Files:**
- Modify: `src/utils/constants.js` (扩展翻译字典结构)
- Create: `src/views/Procurement/PurchaseOrderList.vue`
- Modify: `src/views/GoodsOverview.vue`

**Step 1: Decoupled Vocabulary**
创建两套词典，例如用前端 I18n 工具或者常量区分：
- Management Vocabulary (`production` -> "已向海外下单/备货中")
- Customer Vocabulary (`production` -> "正在为您采购/生产中")

**Step 2: Demand-Driven UI**
在 `GoodsOverview.vue` 列表每行增加一个【多选框】，顶部加入一个【一键生成采购单】按钮。
弹窗内显示左侧“智能分配”（列出此商品的 `confirmed` 预订单），右侧显示“公共库存数量”，最后汇总出一张采购草稿。

**Step 3: Commit**
```bash
git add src/utils/constants.js src/views/Procurement/PurchaseOrderList.vue src/views/GoodsOverview.vue
git commit -m "feat(web): 引入双重视角状态翻译，订货总览支持智能多选生成采购单"
```
