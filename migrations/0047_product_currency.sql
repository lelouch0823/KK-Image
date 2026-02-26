-- Migration: 0047_product_currency.sql
-- Description: 商品级货币字段

ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'CNY';
