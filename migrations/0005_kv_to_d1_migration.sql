-- Migration number: 0005 	 2025-12-28T20:30:00Z
-- KV to D1 Migration: Create users, webhooks, webhook_logs, storage_mirrors tables

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    permissions TEXT, -- JSON 数组字符串
    created_at INTEGER NOT NULL,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Webhook 配置表
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT, -- JSON 数组字符串
    secret TEXT,
    headers TEXT, -- JSON 对象字符串
    enabled INTEGER DEFAULT 1,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_by TEXT,
    updated_at INTEGER
);

-- Webhook 执行日志表
CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT, -- JSON
    status_code INTEGER,
    response TEXT,
    duration_ms INTEGER,
    success INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- 存储镜像状态表 (替代 img_url KV)
CREATE TABLE IF NOT EXISTS storage_mirrors (
    file_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_file_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, synced, failed
    error TEXT,
    synced_at INTEGER,
    PRIMARY KEY (file_id, provider),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
