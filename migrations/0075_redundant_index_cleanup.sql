-- Migration: 0075_redundant_index_cleanup.sql
-- Description: Drop redundant exact-match indexes that are already covered by
-- UNIQUE constraints or stronger unique indexes, and canonicalize product slug.

DROP INDEX IF EXISTS idx_folders_share_token;
DROP INDEX IF EXISTS idx_albums_share_token;
DROP INDEX IF EXISTS idx_spaces_share_token;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_api_keys_value;
DROP INDEX IF EXISTS idx_products_sku;
DROP INDEX IF EXISTS idx_products_slug;
DROP INDEX IF EXISTS idx_products_slug_unique;
DROP INDEX IF EXISTS idx_variants_sku;
DROP INDEX IF EXISTS idx_salespersons_token;
DROP INDEX IF EXISTS idx_salespersons_wechat_openid;
DROP INDEX IF EXISTS idx_orders_no;
DROP INDEX IF EXISTS idx_purchase_orders_no;
DROP INDEX IF EXISTS idx_purchase_receipt_reversals_original_receipt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_receipt_reversals_original_receipt_unique
  ON purchase_receipt_reversals(original_receipt_id);
