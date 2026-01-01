-- ===========================================================================
-- kk-life Database Initialization Script
-- SOTA Full Schema (consolidated from migrations 0001-0015)
-- Created: 2026-01-01
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- 1. File System (Core)
-- ===========================================================================

-- Folders (nested structure)
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    share_token TEXT UNIQUE,
    is_public INTEGER DEFAULT 0,
    password TEXT,
    created_by TEXT,                        -- 0006: ownership
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_share_token ON folders(share_token);
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by);

-- Blobs (CAS - Content-Addressable Storage)
CREATE TABLE IF NOT EXISTS blobs (
    content_hash TEXT PRIMARY KEY,  -- SHA-256, also R2 key
    size INTEGER NOT NULL,
    mime_type TEXT,
    ref_count INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blobs_ref_count ON blobs(ref_count);

-- Files
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    folder_id TEXT,
    name TEXT NOT NULL,
    original_name TEXT,
    size INTEGER DEFAULT 0,
    mime_type TEXT,
    storage_key TEXT NOT NULL,
    content_hash TEXT,                      -- 0014: CAS link
    is_public INTEGER DEFAULT 0,            -- 0004: visibility
    created_by TEXT,                        -- 0004: ownership
    width INTEGER,                          -- 0006: media metadata
    height INTEGER,                         -- 0006: media metadata
    blurhash TEXT,                          -- 0006: blur placeholder
    created_at INTEGER NOT NULL,
    updated_at INTEGER,                     -- 0004: optional
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);

-- ===========================================================================
-- 2. Shared Spaces
-- ===========================================================================

CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    template TEXT DEFAULT 'gallery',
    template_data TEXT,
    cover_file_id TEXT,
    share_token TEXT UNIQUE,
    is_public INTEGER DEFAULT 0,
    password TEXT,
    expires_at INTEGER,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_spaces_parent ON spaces(parent_id);
CREATE INDEX IF NOT EXISTS idx_spaces_share_token ON spaces(share_token);
CREATE INDEX IF NOT EXISTS idx_spaces_template ON spaces(template);
CREATE INDEX IF NOT EXISTS idx_spaces_cover ON spaces(cover_file_id);

-- Space-File relationship (many-to-many)
CREATE TABLE IF NOT EXISTS space_files (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    section TEXT DEFAULT 'default',
    sort_order INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(space_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_space_files_space ON space_files(space_id);
CREATE INDEX IF NOT EXISTS idx_space_files_file ON space_files(file_id);

-- Access logs
CREATE TABLE IF NOT EXISTS space_access_logs (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    accessed_at INTEGER NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_space_access_logs_space ON space_access_logs(space_id);
CREATE INDEX IF NOT EXISTS idx_space_access_logs_time ON space_access_logs(accessed_at DESC);

-- ===========================================================================
-- 3. User System
-- ===========================================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    permissions TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ===========================================================================
-- 4. CRM
-- ===========================================================================

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tags TEXT,
    remark TEXT,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);

-- ===========================================================================
-- 5. Order System
-- ===========================================================================

CREATE TABLE IF NOT EXISTS salespersons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    store TEXT,
    phone TEXT,
    access_token TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salespersons_token ON salespersons(access_token);
CREATE INDEX IF NOT EXISTS idx_salespersons_active ON salespersons(is_active);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    salesperson_id TEXT NOT NULL,
    customer_id TEXT,
    original_data TEXT NOT NULL,
    current_data TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'confirmed', 'rejected', 'production',
        'shipping', 'arrived', 'delivered', 'void'
    )),
    main_image_id TEXT,
    has_new_feedback INTEGER DEFAULT 0,
    unread_by_admin INTEGER DEFAULT 1,
    unread_by_sales INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (main_image_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);

CREATE TABLE IF NOT EXISTS order_files (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    section TEXT DEFAULT 'product',
    sort_order INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(order_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_file ON order_files(file_id);

CREATE TABLE IF NOT EXISTS order_timeline (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN (
        'created', 'field_updated', 'status_changed', 'comment'
    )),
    actor_type TEXT NOT NULL CHECK(actor_type IN ('salesperson', 'admin')),
    actor_id TEXT,
    actor_name TEXT,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    comment TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON order_timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_action ON order_timeline(action_type);

-- ===========================================================================
-- 6. Notifications
-- ===========================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('system', 'order', 'deadline')),
    title TEXT NOT NULL,
    content TEXT,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    metadata TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ===========================================================================
-- 7. Webhooks
-- ===========================================================================

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT,
    secret TEXT,
    headers TEXT,
    enabled INTEGER DEFAULT 1,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_by TEXT,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT,
    status_code INTEGER,
    response TEXT,
    duration_ms INTEGER,
    success INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- ===========================================================================
-- 8. Storage Mirrors
-- ===========================================================================

CREATE TABLE IF NOT EXISTS storage_mirrors (
    file_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_file_id TEXT,
    status TEXT DEFAULT 'pending',
    error TEXT,
    synced_at INTEGER,
    PRIMARY KEY (file_id, provider),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- ===========================================================================
-- 9. Initial Data
-- ===========================================================================

-- Root folder
INSERT OR IGNORE INTO folders (id, parent_id, name, description, share_token, is_public, created_at, updated_at)
VALUES ('root', NULL, '根目录', '默认根目录', NULL, 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
