-- Migration: 0011_crm_schema.sql
-- Description: Add customers table and link to orders

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- 1. Create customers table
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tags TEXT,                   -- JSON array: ["VIP", "Potential"]
    remark TEXT,
    created_by TEXT,             -- Salesperson ID
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Create index for faster search
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_company ON customers(company);
CREATE INDEX idx_customers_created_by ON customers(created_by);

-- 3. Add customer_id to orders table
-- Since SQLite (D1) basic ALTER TABLE is limited, we just add the column.
-- Note: Existing orders will have NULL customer_id.
ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id);

-- 4. Create index for customer orders
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
