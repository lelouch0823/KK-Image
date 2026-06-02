-- 添加 refresh_token UNIQUE 约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_refresh_unique ON oauth_tokens(refresh_token) WHERE refresh_token IS NOT NULL;
