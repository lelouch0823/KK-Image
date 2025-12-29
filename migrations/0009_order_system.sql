-- Migration number: 0009   2025-12-29
-- 预定管理系统：销售人员、订单、时间轴

-- =============================================================================
-- 销售人员表
-- =============================================================================
CREATE TABLE IF NOT EXISTS salespersons (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL,                     -- 姓名
    store TEXT,                             -- 所属门店/区域
    phone TEXT,                             -- 联系电话
    access_token TEXT UNIQUE NOT NULL,      -- 专属链接后缀
    password_hash TEXT NOT NULL,            -- 加密密码
    is_active INTEGER DEFAULT 1,            -- 是否启用 (0=禁用, 1=启用)
    created_at INTEGER NOT NULL,            -- 创建时间 (毫秒时间戳)
    updated_at INTEGER NOT NULL             -- 更新时间
);

CREATE INDEX IF NOT EXISTS idx_salespersons_token ON salespersons(access_token);
CREATE INDEX IF NOT EXISTS idx_salespersons_active ON salespersons(is_active);

-- =============================================================================
-- 订单表
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,                    -- UUID
    order_no TEXT UNIQUE NOT NULL,          -- 订单编号 (如 ORD-20251229-0001)
    salesperson_id TEXT NOT NULL,           -- 关联销售人员
    
    -- 原始数据 (销售提交，不可更改，用于回溯)
    original_data TEXT NOT NULL,            -- JSON: {name, size, color, material, remark}
    
    -- 当前数据 (管理员修正后的版本)
    current_data TEXT NOT NULL,             -- JSON: 同上结构
    
    -- 状态枚举
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',      -- 待处理
        'confirmed',    -- 已确认
        'rejected',     -- 已驳回
        'production',   -- 生产中
        'shipping',     -- 在途
        'arrived',      -- 已到货
        'delivered'     -- 已交付
    )),
    
    -- 媒体
    main_image_id TEXT,                     -- 主图文件 ID
    
    -- 标记
    has_new_feedback INTEGER DEFAULT 0,     -- 红点提醒 (0=无, 1=有)
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE RESTRICT,
    FOREIGN KEY (main_image_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);

-- =============================================================================
-- 订单图片关联表
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_files (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    section TEXT DEFAULT 'product',         -- product | attachment
    sort_order INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(order_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_file ON order_files(file_id);

-- =============================================================================
-- 时间轴日志表
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_timeline (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    
    -- 动作类型
    action_type TEXT NOT NULL CHECK(action_type IN (
        'created',          -- 创建订单
        'field_updated',    -- 字段修正
        'status_changed',   -- 状态变更
        'comment'           -- 留言
    )),
    
    -- 操作人
    actor_type TEXT NOT NULL CHECK(actor_type IN ('salesperson', 'admin')),
    actor_id TEXT,                          -- 关联 salespersons.id 或 users.id
    actor_name TEXT,                        -- 冗余存储姓名，避免关联查询
    
    -- 变更内容
    field_name TEXT,                        -- 修改的字段名 (如 'material')
    old_value TEXT,                         -- 修改前的值
    new_value TEXT,                         -- 修改后的值
    reason TEXT,                            -- 编辑理由 (管理员修改时必填)
    comment TEXT,                           -- 留言内容
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON order_timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_action ON order_timeline(action_type);
