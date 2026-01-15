-- 种子数据：共享空间（覆盖所有 6 种模板）
-- 画廊模板
INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-gallery-1', '精选图库', '瀑布流画廊展示', 'gallery', '{}', 'all', 1736949600000, 1736949600000);

INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-gallery-2', '新品展示', '最新上架产品图库', 'gallery', '{}', 'selected', 1736949600000, 1736949600000);

-- 商品模板
INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-product-1', '爆款推荐', '电商风格商品详情', 'product', '{"brand":"品牌A","price":1999,"series":"旗舰系列","material":"不锈钢","sku":"SKU-100001"}', 'all', 1736949600000, 1736949600000);

INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-product-2', '新品上架', '最新商品展示', 'product', '{"brand":"品牌B","price":2999,"series":"经典系列","material":"合金","sku":"SKU-100002"}', 'selected', 1736949600000, 1736949600000);

-- 作品集模板
INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-portfolio-1', '设计作品集', '大图轮播展示设计案例', 'portfolio', '{}', 'all', 1736949600000, 1736949600000);

INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-portfolio-2', '项目案例', '客户项目展示', 'portfolio', '{}', 'none', 1736949600000, 1736949600000);

-- 文档库模板
INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-document-1', '产品规格书', '产品技术文档下载', 'document', '{}', 'all', 1736949600000, 1736949600000);

INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-document-2', '技术文档', '开发技术资料', 'document', '{}', 'selected', 1736949600000, 1736949600000);

-- 合集模板
INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-collection-1', '产品系列合集', '多个子空间的合集', 'collection', '{}', 'all', 1736949600000, 1736949600000);

INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-collection-2', '品牌专区', '品牌产品合集', 'collection', '{}', 'none', 1736949600000, 1736949600000);

-- 自定义模板
INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-custom-1', '自定义空间', '通用网格布局', 'custom', '{}', 'all', 1736949600000, 1736949600000);

INSERT OR IGNORE INTO spaces (id, name, description, template, template_data, share_mode, created_at, updated_at)
VALUES ('space-custom-2', '临时分享', '快速分享空间', 'custom', '{}', 'selected', 1736949600000, 1736949600000);

-- 销售员种子数据 (password_hash is required NOT NULL)
INSERT OR IGNORE INTO salespersons (id, name, store, phone, access_token, password_hash, is_active, created_at, updated_at)
VALUES ('salesperson-1', '张伟', '北京旗舰店', '13800138001', 'test-token-1', 'seed-hash-placeholder', 1, 1736949600000, 1736949600000);

INSERT OR IGNORE INTO salespersons (id, name, store, phone, access_token, password_hash, is_active, created_at, updated_at)
VALUES ('salesperson-2', '李芳', '上海中心店', '13800138002', 'test-token-2', 'seed-hash-placeholder', 1, 1736949600000, 1736949600000);

INSERT OR IGNORE INTO salespersons (id, name, store, phone, access_token, password_hash, is_active, created_at, updated_at)
VALUES ('salesperson-3', '王强', '广州天河店', '13800138003', 'test-token-3', 'seed-hash-placeholder', 1, 1736949600000, 1736949600000);

-- 空间销售分享关联（selected 模式的空间分配给销售员）
INSERT OR IGNORE INTO space_salesperson_shares (space_id, salesperson_id, shared_at)
VALUES ('space-gallery-2', 'salesperson-1', 1736949600000);

INSERT OR IGNORE INTO space_salesperson_shares (space_id, salesperson_id, shared_at)
VALUES ('space-gallery-2', 'salesperson-2', 1736949600000);

INSERT OR IGNORE INTO space_salesperson_shares (space_id, salesperson_id, shared_at)
VALUES ('space-product-2', 'salesperson-2', 1736949600000);

INSERT OR IGNORE INTO space_salesperson_shares (space_id, salesperson_id, shared_at)
VALUES ('space-product-2', 'salesperson-3', 1736949600000);

INSERT OR IGNORE INTO space_salesperson_shares (space_id, salesperson_id, shared_at)
VALUES ('space-document-2', 'salesperson-1', 1736949600000);

INSERT OR IGNORE INTO space_salesperson_shares (space_id, salesperson_id, shared_at)
VALUES ('space-custom-2', 'salesperson-3', 1736949600000);
