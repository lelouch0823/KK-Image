-- ===========================================================================
-- kk-life 数据库初始化脚本
-- SOTA 全量架构 (Cloudflare D1 优化版)
-- 版本: 2.1.1
-- 更新时间: 2026-01-27
-- ===========================================================================
-- 
-- 使用说明:
--   1. 本文件用于全新部署，包含完整的表结构和索引
--   2. 所有表使用 IF NOT EXISTS，支持幂等执行
--   3. 增量更新请使用 migrations/ 目录下的迁移文件
--
-- D1 兼容性说明:
--   - 不使用 Generated Columns (D1 不完全支持)
--   - 使用 INTEGER 存储毫秒级时间戳
--   - 使用 TEXT 存储 JSON 数据
--
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- 1. 文件系统核心 (File System Core)
-- ===========================================================================

-- 1.1 文件夹表 (支持嵌套结构)
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT,                         -- 父文件夹 ID (NULL 表示根目录)
    name TEXT NOT NULL,                     -- 文件夹名称
    description TEXT DEFAULT '',            -- 描述
    share_token TEXT UNIQUE,                -- 分享 Token (用于公开访问)
    share_expires_at INTEGER,               -- 分享过期时间
    is_public INTEGER DEFAULT 0,            -- 是否公开 (0: 私有, 1: 公开)
    password TEXT,                          -- 访问密码 (可选)
    created_by TEXT,                        -- 创建人 (用户名或 ID)
    created_at INTEGER NOT NULL,            -- 创建时间 (毫秒级时间戳)
    updated_at INTEGER NOT NULL,            -- 更新时间
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_share_token ON folders(share_token);
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by);

-- 1.2 二进制大对象表 (CAS - 内容寻址存储)
-- 用于文件去重，存储文件的实际内容哈希和元数据
CREATE TABLE IF NOT EXISTS blobs (
    content_hash TEXT PRIMARY KEY,          -- SHA-256 哈希值 (也是 R2 存储的 Key)
    size INTEGER NOT NULL,                  -- 文件大小 (字节)
    mime_type TEXT,                         -- MIME 类型
    ref_count INTEGER DEFAULT 1,            -- 引用计数 (当计数为 0 时可安全删除)
    created_at INTEGER NOT NULL             -- 创建时间
);

CREATE INDEX IF NOT EXISTS idx_blobs_ref_count ON blobs(ref_count);

-- 1.3 文件表 (元数据)
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    folder_id TEXT,                         -- 所属文件夹 ID
    name TEXT NOT NULL,                     -- 显示名称
    original_name TEXT,                     -- 原始文件名
    size INTEGER DEFAULT 0,                 -- 文件大小
    mime_type TEXT,                         -- MIME 类型
    storage_key TEXT NOT NULL,              -- 存储 Key (通常是 content_hash，或者是随机 ID)
    content_hash TEXT,                      -- 压缩后内容哈希 (关联 blobs 表，支持 CAS)
    original_hash TEXT,                     -- 原始文件哈希 (用于跨设备/浏览器去重)
    is_public INTEGER DEFAULT 0,            -- 是否公开
    created_by TEXT,                        -- 上传人
    width INTEGER,                          -- 图片宽度 (像素)
    height INTEGER,                         -- 图片高度 (像素)
    blurhash TEXT,                          -- BlurHash 占位符字符串
    status TEXT DEFAULT 'normal' CHECK(status IN ('normal', 'blocked', 'whitelisted', 'liked')),
    created_at INTEGER NOT NULL,            -- 上传时间
    updated_at INTEGER,                     -- 更新时间
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_original_hash ON files(original_hash);
CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
-- [SOTA] 复合索引：按文件夹+创建时间排序
CREATE INDEX IF NOT EXISTS idx_files_folder_created ON files(folder_id, created_at DESC);

-- ===========================================================================
-- 2. 虚拟相册 (Albums - Virtual Collections)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                     -- 相册名称
    description TEXT DEFAULT '',            -- 相册描述
    share_token TEXT UNIQUE,                -- 分享 Token
    is_public INTEGER DEFAULT 0,            -- 是否公开
    cover_file_id TEXT,                     -- 封面图片 ID
    created_at INTEGER NOT NULL,            -- 创建时间
    updated_at INTEGER NOT NULL,            -- 更新时间
    FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS album_files (
    album_id TEXT NOT NULL,                 -- 相册 ID
    file_id TEXT NOT NULL,                  -- 文件 ID
    sort_order INTEGER DEFAULT 0,           -- 排序权重
    PRIMARY KEY (album_id, file_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_albums_share_token ON albums(share_token);
CREATE INDEX IF NOT EXISTS idx_album_files_album ON album_files(album_id);
CREATE INDEX IF NOT EXISTS idx_album_files_file ON album_files(file_id);

-- ===========================================================================
-- 3. 共享空间 (Shared Spaces)
-- ===========================================================================

-- 3.1 空间表
-- 注意: template_data 中的字段 (material, category, author, tags) 需在应用层提取
-- D1 对 Generated Columns 支持有限，故在此不使用
CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    parent_id TEXT,                         -- 父空间 ID (支持嵌套)
    name TEXT NOT NULL,                     -- 空间名称
    description TEXT DEFAULT '',            -- 描述
    template TEXT DEFAULT 'gallery',        -- 展示模板 (gallery, masonry, list, product)
    template_data TEXT,                     -- 模板配置数据 (JSON)
    cover_file_id TEXT,                     -- 封面图 ID
    share_token TEXT UNIQUE,                -- 分享链接 Token
    is_public INTEGER DEFAULT 0,            -- 是否公开
    password TEXT,                          -- 访问密码
    expires_at INTEGER,                     -- 过期时间
    view_count INTEGER DEFAULT 0,           -- 浏览次数
    download_count INTEGER DEFAULT 0,       -- 下载次数
    sort_order INTEGER DEFAULT 0,           -- 排序权重
    share_mode TEXT DEFAULT 'none' CHECK(share_mode IN ('none', 'all', 'selected')), -- 分享模式 (none: 私有, all: 所有销售, selected: 指定销售)
    created_at INTEGER NOT NULL,            -- 创建时间
    updated_at INTEGER NOT NULL,            -- 更新时间
    FOREIGN KEY (parent_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_spaces_parent ON spaces(parent_id);
CREATE INDEX IF NOT EXISTS idx_spaces_share_token ON spaces(share_token);
CREATE INDEX IF NOT EXISTS idx_spaces_template ON spaces(template);
CREATE INDEX IF NOT EXISTS idx_spaces_cover ON spaces(cover_file_id);
-- [SOTA] 复合索引：公开空间按更新时间排序
CREATE INDEX IF NOT EXISTS idx_spaces_public_updated ON spaces(is_public, updated_at DESC);
-- [SOTA] 索引：按分享模式筛选
CREATE INDEX IF NOT EXISTS idx_spaces_share_mode ON spaces(share_mode);

-- 3.1.1 空间-销售员分享关联表 (选择性分享)
CREATE TABLE IF NOT EXISTS space_salesperson_shares (
    space_id TEXT NOT NULL,
    salesperson_id TEXT NOT NULL,
    shared_at INTEGER NOT NULL,
    PRIMARY KEY (space_id, salesperson_id),
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_space_shares_salesperson ON space_salesperson_shares(salesperson_id);
-- [SOTA] 索引：按分享模式筛选

-- 3.2 空间-文件关联表 (多对多)
CREATE TABLE IF NOT EXISTS space_files (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    section TEXT DEFAULT 'default',         -- 分区/分组 (用于页面布局)
    sort_order INTEGER DEFAULT 0,           -- 排序
    added_at INTEGER NOT NULL,              -- 添加时间
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(space_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_space_files_space ON space_files(space_id);
CREATE INDEX IF NOT EXISTS idx_space_files_file ON space_files(file_id);

-- 3.3 访问日志
CREATE TABLE IF NOT EXISTS space_access_logs (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    ip_address TEXT,                        -- 访客 IP
    user_agent TEXT,                        -- 浏览器 UA
    referrer TEXT,                          -- 来源页面
    accessed_at INTEGER NOT NULL,           -- 访问时间
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_space_access_logs_space ON space_access_logs(space_id);
CREATE INDEX IF NOT EXISTS idx_space_access_logs_time ON space_access_logs(accessed_at DESC);

-- ===========================================================================
-- 4. 用户系统 (User System)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,          -- 用户名
    password_hash TEXT NOT NULL,            -- 密码哈希
    name TEXT,                              -- 显示名称
    email TEXT,                             -- 邮箱
    role TEXT DEFAULT 'user',               -- 角色 (admin, user)
    permissions TEXT,                       -- 权限列表 (JSON)
    created_at INTEGER NOT NULL,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ===========================================================================
-- 5. API Keys (Service-to-Service 或开发者访问)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_value TEXT NOT NULL UNIQUE,         -- API Key 值 (避免使用保留字 'key')
    name TEXT,                              -- 密钥名称/描述
    permissions TEXT,                       -- 权限列表 (JSON)
    created_at INTEGER NOT NULL,            -- 创建时间
    expires_at INTEGER,                     -- 过期时间 (NULL 表示永不过期)
    disabled INTEGER DEFAULT 0              -- 是否禁用
);

CREATE INDEX IF NOT EXISTS idx_api_keys_value ON api_keys(key_value);

-- ===========================================================================
-- 6. 商品系统 (Merchandise System) [SOTA]
-- ===========================================================================

-- 6.1 商品表 (Products)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL,                     -- 商品名称
    sku TEXT UNIQUE NOT NULL,               -- 库存单位 (Stock Keeping Unit)
    slug TEXT,                              -- URL 别名 (SEO 优化, UNIQUE via index)
    
    -- 分类与品牌
    category TEXT,                          -- 分类 (如: Handbag, Wallet)
    brand TEXT,                             -- 品牌 (如: Hermes, Chanel)
    series TEXT,                            -- 系列 (如: Birkin, Kelly)
    
    -- 价格与成本
    price REAL DEFAULT 0,                   -- 标准售价
    cost_price REAL,                        -- 成本价 (用于利润分析)
    
    -- 库存管理
    stock_quantity INTEGER DEFAULT 0,       -- 当前库存数量
    alert_threshold INTEGER DEFAULT 10,     -- 低库存预警阈值
    
    -- 详情
    description TEXT,                       -- 商品描述 (Supports Markdown)
    
    -- 媒体
    images TEXT DEFAULT '[]',               -- JSON Array of file IDs: ["file_id_1", "file_id_2"]
    
    -- 规格参数 (JSON)
    -- 用于存储尺寸、颜色选项、材质等结构化数据
    -- 示例: {"size": "25", "leather": "Togo", "hardware": "Gold"}
    specifications TEXT DEFAULT '{}',
    
    -- 状态
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft')),
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique ON products(slug); -- SQLite workaround for ALTER but good here too
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- ===========================================================================
-- 7. 客户关系管理 (CRM)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                     -- 客户姓名
    company TEXT,                           -- 公司/单位
    phone TEXT,                             -- 联系电话
    email TEXT,                             -- 电子邮箱
    address TEXT,                           -- 地址
    tags TEXT,                              -- 标签 (逗号分隔或 JSON)
    remark TEXT,                            -- 备注
    created_by TEXT,                        -- 创建人
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- ===========================================================================
-- 8. 订单系统 (Order System)
-- ===========================================================================

-- 7.1 销售员表
CREATE TABLE IF NOT EXISTS salespersons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                     -- 姓名
    store TEXT,                             -- 所属门店
    phone TEXT,                             -- 手机号
    access_token TEXT UNIQUE NOT NULL,      -- 访问 Token (用于免密/快速登录)
    password_hash TEXT NOT NULL,            -- 访问密码哈希
    wechat_openid TEXT UNIQUE,              -- 微信小程序 OpenID (用于微信一键登录)
    is_active INTEGER DEFAULT 1,            -- 是否启用
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salespersons_token ON salespersons(access_token);
CREATE INDEX IF NOT EXISTS idx_salespersons_active ON salespersons(is_active);
CREATE INDEX IF NOT EXISTS idx_salespersons_wechat_openid ON salespersons(wechat_openid);

-- 7.2 订单表
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,          -- 订单编号
    salesperson_id TEXT NOT NULL,           -- 归属销售员
    customer_id TEXT,                       -- 关联客户 (可选)
    product_id TEXT,                        -- 关联标准商品 (可选，用于标准化订单)
    variant_id TEXT,                        -- 关联标准变体 (可选)
    quantity INTEGER DEFAULT 1,             -- 订单数量
    original_data TEXT NOT NULL,            -- 原始提交数据 (JSON)
    current_data TEXT NOT NULL,             -- 当前最新数据 (JSON)
    -- 订单状态枚举 (完整生命周期)
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',      -- 待确认
        'confirmed',    -- 已确认
        'rejected',     -- 被驳回
        'production',   -- 生产中
        'shipping',     -- 已发货
        'arrived',      -- 已到店
        'delivered',    -- 已交付
        'void'          -- 已作废
    )),
    main_image_id TEXT,                     -- 主图 ID
    has_new_feedback INTEGER DEFAULT 0,     -- [已弃用] 是否有新反馈
    unread_by_admin INTEGER DEFAULT 1,      -- 管理员未读 (1: 未读, 0: 已读)
    unread_by_sales INTEGER DEFAULT 0,      -- 销售未读
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (main_image_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_variant_id ON orders(variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);
-- [SOTA] 复合索引：按状态+创建时间排序 (常用查询优化)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
-- [SOTA] 复合索引：管理员未读筛选
CREATE INDEX IF NOT EXISTS idx_orders_unread_admin ON orders(unread_by_admin, created_at DESC);

-- 7.3 订单文件 (多对多)
CREATE TABLE IF NOT EXISTS order_files (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    section TEXT DEFAULT 'product',         -- 文件分区 (product, requirements, confirmation)
    sort_order INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(order_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_file ON order_files(file_id);

-- 7.4 订单时间轴 (操作日志)
CREATE TABLE IF NOT EXISTS order_timeline (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    -- 动作类型
    action_type TEXT NOT NULL CHECK(action_type IN (
        'created',          -- 创建
        'field_updated',    -- 字段更新
        'status_changed',   -- 状态变更
        'comment'           -- 评论/反馈
    )),
    actor_type TEXT NOT NULL CHECK(actor_type IN ('salesperson', 'admin')),
    actor_id TEXT,                            -- 操作人 ID
    actor_name TEXT,                          -- 操作人姓名 (快照)
    field_name TEXT,                          -- 变更字段名 (仅 field_updated)
    old_value TEXT,                           -- 旧值
    new_value TEXT,                           -- 新值
    reason TEXT,                              -- 变更原因/备注
    comment TEXT,                             -- 评论内容
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON order_timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_action ON order_timeline(action_type);

-- 7.5 订单行与采购履约基础表
CREATE TABLE IF NOT EXISTS order_lines (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT,
    variant_id TEXT,
    snapshot_name TEXT NOT NULL,
    snapshot_sku TEXT,
    snapshot_specs TEXT,
    snapshot_image TEXT,
    ordered_qty INTEGER NOT NULL DEFAULT 0,
    procured_qty INTEGER NOT NULL DEFAULT 0,
    received_qty INTEGER NOT NULL DEFAULT 0,
    reserved_qty INTEGER NOT NULL DEFAULT 0,
    shipped_qty INTEGER NOT NULL DEFAULT 0,
    cancelled_qty INTEGER NOT NULL DEFAULT 0,
    display_status TEXT NOT NULL DEFAULT 'unprocured' CHECK(display_status IN (
        'unprocured',
        'partially_procured',
        'fully_procured',
        'partially_received',
        'ready',
        'partially_shipped',
        'completed',
        'cancelled'
    )),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_variant_id ON order_lines(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_display_status ON order_lines(display_status);

CREATE TABLE IF NOT EXISTS purchase_receipts (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL,
    purchase_order_item_id TEXT,
    product_id TEXT,
    variant_id TEXT,
    receipt_no TEXT,
    received_qty INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    received_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_id
    ON purchase_receipts(purchase_order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_item_id
    ON purchase_receipts(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_variant_id
    ON purchase_receipts(variant_id);

CREATE TABLE IF NOT EXISTS inventory_events (
    id TEXT PRIMARY KEY,
    variant_id TEXT,
    order_line_id TEXT,
    purchase_receipt_id TEXT,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'purchase_ordered',
        'purchase_received',
        'purchase_arrival',
        'inventory_allocated_to_order_line',
        'inventory_deallocated_from_order_line',
        'inventory_reserved',
        'reservation_hold',
        'inventory_released',
        'reservation_release',
        'order_shipment',
        'order_line_cancelled',
        'inventory_adjusted_reversal',
        'manual_adjustment'
    )),
    quantity_delta INTEGER NOT NULL,
    source_type TEXT,
    source_id TEXT,
    metadata TEXT,
    occurred_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE SET NULL,
    FOREIGN KEY (purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_events_variant_occurred_at
    ON inventory_events(variant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_events_order_line_id
    ON inventory_events(order_line_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_purchase_receipt_id
    ON inventory_events(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_source
    ON inventory_events(source_type, source_id);

CREATE TABLE IF NOT EXISTS order_line_allocations (
    id TEXT PRIMARY KEY,
    order_line_id TEXT NOT NULL,
    variant_id TEXT,
    inventory_event_id TEXT,
    allocated_qty INTEGER NOT NULL DEFAULT 0,
    released_qty INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'released', 'cancelled')),
    allocated_at INTEGER NOT NULL,
    released_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (inventory_event_id) REFERENCES inventory_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_line_allocations_order_line_id
    ON order_line_allocations(order_line_id);
CREATE INDEX IF NOT EXISTS idx_order_line_allocations_variant_id
    ON order_line_allocations(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_line_allocations_status
    ON order_line_allocations(status);

-- ===========================================================================
-- 9. 通知系统 (Notifications)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('system', 'order', 'deadline')),
    title TEXT NOT NULL,                    -- 标题 (支持 i18n key JSON)
    content TEXT,                           -- 内容 (支持 i18n key JSON)
    link TEXT,                              -- 跳转链接
    is_read INTEGER DEFAULT 0,              -- 是否已读
    receiver TEXT DEFAULT 'admin' CHECK(receiver IN ('admin', 'sales')),
    salesperson_id TEXT,                    -- 销售员 ID (receiver='sales' 时关联)
    order_id TEXT,                          -- 关联订单 ID
    metadata TEXT,                          -- 元数据 (JSON)
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
-- [SOTA] 复合索引：销售端通知查询优化
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_sales ON notifications(receiver, salesperson_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id);

-- ===========================================================================
-- 10. Webhooks
-- ===========================================================================

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,                      -- 目标 URL
    events TEXT,                            -- 订阅事件 (逗号分隔或 JSON)
    secret TEXT,                            -- 签名密钥
    headers TEXT,                           -- 自定义 Headers (JSON)
    enabled INTEGER DEFAULT 1,              -- 是否启用
    created_by TEXT,                        -- 创建人
    created_at INTEGER NOT NULL,
    updated_by TEXT,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,                    -- 触发事件
    payload TEXT,                           -- 发送载荷
    status_code INTEGER,                    -- 响应状态码
    response TEXT,                          -- 响应内容
    duration_ms INTEGER,                    -- 耗时 (ms)
    success INTEGER DEFAULT 0,              -- 是否成功
    created_at INTEGER NOT NULL,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- ===========================================================================
-- 11. 存储镜像/同步 (Storage Mirrors)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS storage_mirrors (
    file_id TEXT NOT NULL,
    provider TEXT NOT NULL,                 -- 存储提供商 (r2, s3, telegram)
    provider_file_id TEXT,                  -- 远端 ID
    status TEXT DEFAULT 'pending',          -- 状态 (pending, synced, failed)
    error TEXT,                             -- 错误信息
    synced_at INTEGER,                      -- 同步时间
    PRIMARY KEY (file_id, provider),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- ===========================================================================
-- 12. 系统设置 (System Settings)
-- ===========================================================================

-- 配置表 (Key-Value)
CREATE TABLE IF NOT EXISTS SystemSettings (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "updatedAt" INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ===========================================================================
-- 13. 初始数据 (Initial Data)
-- ===========================================================================

-- 创建根目录
INSERT OR IGNORE INTO folders (id, parent_id, name, description, share_token, is_public, created_at, updated_at)
VALUES ('root', NULL, '根目录', '默认根目录', NULL, 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===========================================================================
-- Schema Version: 2.5.0 (2026-03-28)
-- Tables: 26 (Added order line/procurement foundation tables)
-- SOTA: Inventory, Cost, SEO included in products
-- ===========================================================================
