-- 微信小程序支持迁移
-- 为 salespersons 表添加 wechat_openid 字段

ALTER TABLE salespersons ADD COLUMN wechat_openid TEXT UNIQUE;

-- 创建索引以加速 openid 查询
CREATE INDEX IF NOT EXISTS idx_salespersons_wechat_openid ON salespersons(wechat_openid);
