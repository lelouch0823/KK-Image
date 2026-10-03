-- Migration number: 0102   2026-10-03
-- ERP 同步一致性加固（审查 C-M3）：
-- erp_webhook_events 事件去重表——ERP 重发同一 webhook（网络重试/至少一次投递）
-- 时凭 (connection_id, event_key) 幂等应答，防止重复创建本地实体。
-- event_key 取 payload.event_id；缺失时服务端以请求体哈希代替。

CREATE TABLE IF NOT EXISTS erp_webhook_events (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    event_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE,
    UNIQUE (connection_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_erp_webhook_events_created
  ON erp_webhook_events(created_at DESC);
