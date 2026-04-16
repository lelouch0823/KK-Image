-- Migration number: 0071   2026-04-16
-- Add first-batch performance indexes for hot backend read paths.

CREATE INDEX IF NOT EXISTS idx_spaces_share_mode
  ON spaces(share_mode);

CREATE INDEX IF NOT EXISTS idx_notifications_receiver_read_created
  ON notifications(receiver, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_space_files_space_section_sort
  ON space_files(space_id, section, sort_order);

CREATE INDEX IF NOT EXISTS idx_space_access_logs_space_time
  ON space_access_logs(space_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson_created
  ON orders(salesperson_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson_status_created
  ON orders(salesperson_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_lines_order_created
  ON order_lines(order_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_order_lines_variant_status_created
  ON order_lines(variant_id, display_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_files_folder_deleted_created
  ON files(folder_id, is_deleted, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_original_hash_deleted
  ON files(original_hash, is_deleted);

CREATE INDEX IF NOT EXISTS idx_folders_parent_deleted_created
  ON folders(parent_id, is_deleted, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_folders_deleted_name
  ON folders(is_deleted, name);
