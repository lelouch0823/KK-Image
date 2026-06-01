-- Migration 0083: 客户表全文搜索 (FTS5)
-- 解决 CustomerRepository.list() 的 %keyword% 前缀通配符 LIKE 全表扫描问题

-- 创建 FTS5 虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS customers_fts USING fts5(
    name,
    phone,
    company,
    content='customers',
    content_rowid='rowid'
);

-- 初始填充
INSERT INTO customers_fts(rowid, name, phone, company)
    SELECT rowid, name, phone, company FROM customers;

-- 同步触发器：INSERT
CREATE TRIGGER IF NOT EXISTS customers_fts_ai AFTER INSERT ON customers BEGIN
    INSERT INTO customers_fts(rowid, name, phone, company)
    VALUES (new.rowid, new.name, new.phone, new.company);
END;

-- 同步触发器：UPDATE
CREATE TRIGGER IF NOT EXISTS customers_fts_au AFTER UPDATE ON customers BEGIN
    INSERT INTO customers_fts(customers_fts, rowid, name, phone, company)
    VALUES ('delete', old.rowid, old.name, old.phone, old.company);
    INSERT INTO customers_fts(rowid, name, phone, company)
    VALUES (new.rowid, new.name, new.phone, new.company);
END;

-- 同步触发器：DELETE
CREATE TRIGGER IF NOT EXISTS customers_fts_ad AFTER DELETE ON customers BEGIN
    INSERT INTO customers_fts(customers_fts, rowid, name, phone, company)
    VALUES ('delete', old.rowid, old.name, old.phone, old.company);
END;
