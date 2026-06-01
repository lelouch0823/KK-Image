-- Migration 0085: 商品和订单表全文搜索 (FTS5)
-- 扩展 FTS5 全文搜索到 products 和 orders 表
-- 解决 ProductRepository 和 OrderRepository 的 %keyword% LIKE 全表扫描问题

-- ===== products_fts =====

CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    name,
    spu,
    description,
    series,
    content='products',
    content_rowid='rowid'
);

-- 初始填充
INSERT INTO products_fts(rowid, name, spu, description, series)
    SELECT rowid, name, spu, description, series FROM products;

-- 同步触发器：INSERT
CREATE TRIGGER IF NOT EXISTS products_fts_ai AFTER INSERT ON products BEGIN
    INSERT INTO products_fts(rowid, name, spu, description, series)
    VALUES (new.rowid, new.name, new.spu, new.description, new.series);
END;

-- 同步触发器：UPDATE
CREATE TRIGGER IF NOT EXISTS products_fts_au AFTER UPDATE ON products BEGIN
    INSERT INTO products_fts(products_fts, rowid, name, spu, description, series)
    VALUES ('delete', old.rowid, old.name, old.spu, old.description, old.series);
    INSERT INTO products_fts(rowid, name, spu, description, series)
    VALUES (new.rowid, new.name, new.spu, new.description, new.series);
END;

-- 同步触发器：DELETE
CREATE TRIGGER IF NOT EXISTS products_fts_ad AFTER DELETE ON products BEGIN
    INSERT INTO products_fts(products_fts, rowid, name, spu, description, series)
    VALUES ('delete', old.rowid, old.name, old.spu, old.description, old.series);
END;

-- ===== orders_fts =====

CREATE VIRTUAL TABLE IF NOT EXISTS orders_fts USING fts5(
    order_no,
    summary_name,
    summary_brand,
    summary_sku,
    content='orders',
    content_rowid='rowid'
);

-- 初始填充
INSERT INTO orders_fts(rowid, order_no, summary_name, summary_brand, summary_sku)
    SELECT rowid, order_no, summary_name, summary_brand, summary_sku FROM orders;

-- 同步触发器：INSERT
CREATE TRIGGER IF NOT EXISTS orders_fts_ai AFTER INSERT ON orders BEGIN
    INSERT INTO orders_fts(rowid, order_no, summary_name, summary_brand, summary_sku)
    VALUES (new.rowid, new.order_no, new.summary_name, new.summary_brand, new.summary_sku);
END;

-- 同步触发器：UPDATE
CREATE TRIGGER IF NOT EXISTS orders_fts_au AFTER UPDATE ON orders BEGIN
    INSERT INTO orders_fts(orders_fts, rowid, order_no, summary_name, summary_brand, summary_sku)
    VALUES ('delete', old.rowid, old.order_no, old.summary_name, old.summary_brand, old.summary_sku);
    INSERT INTO orders_fts(rowid, order_no, summary_name, summary_brand, summary_sku)
    VALUES (new.rowid, new.order_no, new.summary_name, new.summary_brand, new.summary_sku);
END;

-- 同步触发器：DELETE
CREATE TRIGGER IF NOT EXISTS orders_fts_ad AFTER DELETE ON orders BEGIN
    INSERT INTO orders_fts(orders_fts, rowid, order_no, summary_name, summary_brand, summary_sku)
    VALUES ('delete', old.rowid, old.order_no, old.summary_name, old.summary_brand, old.summary_sku);
END;
