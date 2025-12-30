-- Migration number: 0012   2025-12-30
-- 智能提醒系统：通知表

-- =============================================================================
-- 通知表
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,                    -- UUID
    type TEXT NOT NULL CHECK(type IN (
        'system',       -- 系统通知
        'order',        -- 订单相关
        'deadline'      -- 期限提醒
    )),
    title TEXT NOT NULL,                    -- 标题
    content TEXT,                           -- 内容
    link TEXT,                              -- 跳转链接 (可选)
    is_read INTEGER DEFAULT 0,              -- 是否已读 (0=未读, 1=已读)
    metadata TEXT,                          -- 扩展数据 (JSON)
    created_at INTEGER NOT NULL             -- 创建时间
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
