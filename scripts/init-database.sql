-- ===========================================================================
-- kk-life 数据库初始化脚本
-- SOTA 全量架构 (合并了 migrations 0001-0015)
-- 创建时间: 2026-01-01
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- 1. 文件系统核心 (File System Core)
-- ===========================================================================

-- 文件夹表 (支持嵌套结构)
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT,                         -- 父文件夹 ID (NULL 表示根目录)
    name TEXT NOT NULL,                     -- 文件夹名称
    description TEXT DEFAULT '',            -- 描述
    share_token TEXT UNIQUE,                -- 分享 Token (用于公开访问)
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

-- 二进制大对象表 (CAS - 内容寻址存储)
-- 用于文件去重，存储文件的实际内容哈希和元数据
CREATE TABLE IF NOT EXISTS blobs (
    content_hash TEXT PRIMARY KEY,          -- SHA-256 哈希值 (也是 R2 存储的 Key)
    size INTEGER NOT NULL,                  -- 文件大小 (字节)
    mime_type TEXT,                         -- MIME 类型
    ref_count INTEGER DEFAULT 1,            -- 引用计数 (当计数为 0 时可安全删除)
    created_at INTEGER NOT NULL             -- 创建时间
);

CREATE INDEX IF NOT EXISTS idx_blobs_ref_count ON blobs(ref_count);

-- 文件表 (元数据)
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
    created_at INTEGER NOT NULL,            -- 上传时间
    updated_at INTEGER,                     -- 更新时间
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_original_hash ON files(original_hash);
CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);

-- ===========================================================================
-- 1.5 虚拟相册 (Albums - Virtual Collections)
-- ===========================================================================

-- 相册表
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

-- 相册-文件关联表 (多对多)
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
-- 2. 共享空间 (Shared Spaces)
-- ===========================================================================

-- 空间表
CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    parent_id TEXT,                         -- 父空间 ID (支持嵌套)
    name TEXT NOT NULL,                     -- 空间名称
    description TEXT DEFAULT '',            -- 描述
    template TEXT DEFAULT 'gallery',        -- 展示模板 (e.g., gallery, masonry, list)
    template_data TEXT,                     -- 模板配置数据 (JSON)
    cover_file_id TEXT,                     -- 封面图 ID
    share_token TEXT UNIQUE,                -- 分享链接 Token
    is_public INTEGER DEFAULT 0,            -- 是否公开
    password TEXT,                          -- 访问密码
    expires_at INTEGER,                     -- 过期时间
    view_count INTEGER DEFAULT 0,           -- 浏览次数
    download_count INTEGER DEFAULT 0,       -- 下载次数
    sort_order INTEGER DEFAULT 0,           -- 排序权重
    created_at INTEGER NOT NULL,            -- 创建时间
    updated_at INTEGER NOT NULL,            -- 更新时间
    FOREIGN KEY (parent_id) REFERENCES spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_spaces_parent ON spaces(parent_id);
CREATE INDEX IF NOT EXISTS idx_spaces_share_token ON spaces(share_token);
CREATE INDEX IF NOT EXISTS idx_spaces_template ON spaces(template);
CREATE INDEX IF NOT EXISTS idx_spaces_cover ON spaces(cover_file_id);

-- 空间-文件关联表 (多对多)
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

-- 访问日志
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
-- 3. 用户系统 (User System)
-- ===========================================================================

-- 管理员/用户表
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
-- 4. 客户关系管理 (CRM)
-- ===========================================================================

-- 客户表
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

-- ===========================================================================
-- 5. 订单系统 (Order System)
-- ===========================================================================

-- 销售员表
CREATE TABLE IF NOT EXISTS salespersons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                     -- 姓名
    store TEXT,                             -- 所属门店
    phone TEXT,                             -- 手机号
    access_token TEXT UNIQUE NOT NULL,      -- 访问 Token (用于免密/快速登录)
    password_hash TEXT NOT NULL,            -- 访问密码哈希
    is_active INTEGER DEFAULT 1,            -- 是否启用
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salespersons_token ON salespersons(access_token);
CREATE INDEX IF NOT EXISTS idx_salespersons_active ON salespersons(is_active);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,          -- 订单编号
    salesperson_id TEXT NOT NULL,           -- 归属销售员
    customer_id TEXT,                       -- 关联客户 (可选)
    original_data TEXT NOT NULL,            -- 原始提交数据 (JSON)
    current_data TEXT NOT NULL,             -- 当前最新数据 (JSON)
    -- 订单状态枚举
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
    FOREIGN KEY (main_image_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);

-- 订单文件 (多对多)
CREATE TABLE IF NOT EXISTS order_files (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    section TEXT DEFAULT 'product',         -- 文件分区 (e.g., product, requirements, confirmation)
    sort_order INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(order_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_file ON order_files(file_id);

-- 订单时间轴 (操作日志)
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
    actor_type TEXT NOT NULL CHECK(actor_type IN ('salesperson', 'admin')), -- 操作人类型
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

-- ===========================================================================
-- 6. 通知系统 (Notifications)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('system', 'order', 'deadline')), -- 通知类型
    title TEXT NOT NULL,                    -- 标题 (支持 i18n key JSON)
    content TEXT,                           -- 内容 (支持 i18n key JSON)
    link TEXT,                              -- 跳转链接
    is_read INTEGER DEFAULT 0,              -- 是否已读
    receiver TEXT DEFAULT 'admin' CHECK(receiver IN ('admin', 'sales')), -- 接收方
    salesperson_id TEXT,                    -- 销售员 ID (receiver='sales' 时关联)
    order_id TEXT,                          -- 关联订单 ID
    metadata TEXT,                          -- 元数据 (JSON)
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_sales ON notifications(receiver, salesperson_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id);

-- ===========================================================================
-- 7. Webhooks
-- ===========================================================================

-- Webhook 配置
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

-- Webhook 发送日志
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
-- 8. 存储镜像/同步 (Storage Mirrors)
-- ===========================================================================

-- 用于追踪文件在第三方存储 (如 R2, S3) 的同步状态
CREATE TABLE IF NOT EXISTS storage_mirrors (
    file_id TEXT NOT NULL,
    provider TEXT NOT NULL,                 -- 存储提供商 (e.g., 'r2', 's3')
    provider_file_id TEXT,                  -- 远端 ID
    status TEXT DEFAULT 'pending',          -- 状态 (pending, synced, failed)
    error TEXT,                             -- 错误信息
    synced_at INTEGER,                      -- 同步时间
    PRIMARY KEY (file_id, provider),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- ===========================================================================
-- 9. 初始数据 (Initial Data)
-- ===========================================================================

-- 根目录
INSERT OR IGNORE INTO folders (id, parent_id, name, description, share_token, is_public, created_at, updated_at)
VALUES ('root', NULL, '根目录', '默认根目录', NULL, 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
