-- Add unread flags for distinct notifications
ALTER TABLE orders ADD COLUMN unread_by_admin INTEGER DEFAULT 1; -- New orders default to unread by admin
ALTER TABLE orders ADD COLUMN unread_by_sales INTEGER DEFAULT 0;

-- Initialize unread_by_admin based on existing has_new_feedback (assuming legacy meant admin needs to see it?)
-- Actually, legacy has_new_feedback was messy. Let's reset or just map it.
-- If status is pending, Admin probably hasn't read it? No, that's not safe.
-- We'll default all existing 'pending' orders to unread_by_admin = 1, others 0.
UPDATE orders SET unread_by_admin = 1 WHERE status = 'pending';

-- If has_new_feedback = 1, we don't know who it was for.
-- Safe bet: if status != pending and has_new_feedback=1, maybe it's for Sales?
-- Let's just set default to 0 for old orders except pending.

-- Drop the old column eventually, but for now we ignore it.
