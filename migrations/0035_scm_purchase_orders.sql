-- Migration: 0035_scm_purchase_orders.sql
-- Description: 引入采购单 (Purchase Orders) 及明细表，支持境外多商品合并采购、
--              运费/关税后置分摊、客户订单状态级联同步。

-- =============================================================================
-- 采购单主表 (Purchase Orders)
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,                        -- UUID
    po_no TEXT UNIQUE NOT NULL,                 -- 采购单号 (如 PO-20260224-001)

    -- 状态枚举
    status TEXT DEFAULT 'draft' CHECK(status IN (
        'draft',        -- 草稿 (选品中)
        'ordered',      -- 已向海外下单
        'shipping',     -- 国际物流在途
        'arrived',      -- 已入库 / 待结算
        'completed',    -- 财务已结算分摊
        'cancelled'     -- 已取消
    )),

    -- 成本汇总 (结算阶段填写)
    estimated_shipping_cost REAL DEFAULT 0,     -- 预估运费 (下单时可选填)
    estimated_tariff_cost REAL DEFAULT 0,       -- 预估关税 (下单时可选填)
    actual_shipping_cost REAL,                  -- 实际运费 (到货/结算时填写)
    actual_tariff_cost REAL,                    -- 实际关税 (到货/结算时填写)
    currency TEXT DEFAULT 'CNY',                -- 结算币种
    allocation_method TEXT DEFAULT 'by_quantity' CHECK(allocation_method IN (
        'by_quantity',  -- 按件数平均分摊
        'by_value'      -- 按商品价值比例分摊
    )),

    remark TEXT,                                -- 备注

    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER                        -- 结算完成时间
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_no ON purchase_orders(po_no);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at DESC);

-- =============================================================================
-- 采购单明细表 (Purchase Order Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,                        -- UUID
    po_id TEXT NOT NULL,                        -- 所属采购单
    product_id TEXT NOT NULL,                   -- 关联商品
    customer_order_id TEXT,                     -- 关联的客户订单 (NULL = 补公共库存)

    quantity INTEGER DEFAULT 1,                 -- 采购数量
    unit_cost REAL DEFAULT 0,                   -- 单件入货成本 (海外原价)
    allocated_freight REAL DEFAULT 0,           -- 分摊后的单件运费
    allocated_tariff REAL DEFAULT 0,            -- 分摊后的单件关税

    created_at INTEGER NOT NULL,

    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_po_items_order ON purchase_order_items(customer_order_id);
