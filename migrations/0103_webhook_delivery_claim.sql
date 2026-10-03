-- Migration number: 0103   2026-10-03
-- Webhook 送达幂等（审查 C-M5）：
-- (webhook_id, delivery_key, attempt_number) 唯一索引使"认领投递尝试"成为
-- 原子操作——outbox 租约过期被第二个 poller 重认领时，两个 worker 计算出
-- 相同的 attempt_number，只有先 INSERT 成功（认领）的那个能真正发送，
-- 另一个跳过，消除重复投递窗口。
-- 迁移时清理历史重复日志（保留最早一条）。

DELETE FROM webhook_logs
WHERE delivery_key IS NOT NULL
  AND rowid NOT IN (
    SELECT MIN(rowid) FROM webhook_logs
    WHERE delivery_key IS NOT NULL
    GROUP BY webhook_id, delivery_key, attempt_number
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_delivery_attempt
  ON webhook_logs(webhook_id, delivery_key, attempt_number)
  WHERE delivery_key IS NOT NULL;
