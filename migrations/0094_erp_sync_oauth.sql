-- ERP 数据同步 + OAuth2.0 授权
-- 创建时间: 2026-06-02

-- ============================================
-- ERP 数据同步表
-- ============================================

-- ERP 连接配置表
CREATE TABLE IF NOT EXISTS erp_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL CHECK(adapter_type IN ('generic','kingdee','yonyou','sap')),
  base_url TEXT NOT NULL,                   -- ERP 系统 API 地址
  auth_type TEXT NOT NULL DEFAULT 'api_key' CHECK(auth_type IN ('api_key','oauth2','basic')),
  credentials TEXT NOT NULL DEFAULT '{}',   -- 加密存储的凭据 JSON
  config TEXT NOT NULL DEFAULT '{}',        -- 适配器特定配置 JSON
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK(sync_direction IN ('push','pull','bidirectional')),
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at INTEGER,
  last_sync_status TEXT CHECK(last_sync_status IN ('success','partial','failed')),
  last_error TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ERP 同步日志表
CREATE TABLE IF NOT EXISTS erp_sync_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  connection_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('product','customer','order')),
  entity_id TEXT,                           -- 本地实体 ID
  erp_id TEXT,                              -- 远程 ERP 实体 ID
  direction TEXT NOT NULL CHECK(direction IN ('push','pull')),
  action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed','conflict')),
  request_payload TEXT,
  response_payload TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  completed_at INTEGER,
  FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE
);

-- ERP 同步映射表 (本地 ID <-> ERP ID 映射)
CREATE TABLE IF NOT EXISTS erp_entity_mappings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  connection_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('product','customer','order')),
  local_id TEXT NOT NULL,
  erp_id TEXT NOT NULL,
  erp_code TEXT,                            -- ERP 编码 (如物料编码)
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (connection_id) REFERENCES erp_connections(id) ON DELETE CASCADE,
  UNIQUE(connection_id, entity_type, local_id),
  UNIQUE(connection_id, entity_type, erp_id)
);

-- ERP 同步索引
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_connection ON erp_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_entity ON erp_sync_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_status ON erp_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_created ON erp_sync_logs(created_at DESC);

-- ============================================
-- OAuth2.0 授权表
-- ============================================

-- OAuth 客户端注册表
CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  redirect_uris TEXT NOT NULL DEFAULT '[]',  -- JSON 数组
  grant_types TEXT NOT NULL DEFAULT '["authorization_code"]', -- JSON 数组
  scopes TEXT NOT NULL DEFAULT '["read"]',   -- JSON 数组
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- OAuth 授权码表
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);

-- OAuth 访问令牌表
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);

-- OAuth 索引
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_refresh ON oauth_tokens(refresh_token);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client ON oauth_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
