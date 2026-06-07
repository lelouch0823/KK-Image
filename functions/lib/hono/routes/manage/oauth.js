import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { OAuthRepository, hashSecret } from '../../../../repositories/OAuthRepository.js';
import { requirePermission } from '../../middleware/auth.js';
import { generatePrefixedId } from '../../../../_shared/utils.js';
import { rateLimit } from '../../middleware/rateLimit.js';

const app = new Hono();

/** OAuth Token 端点专用限流：每分钟最多 20 次 */
const oauthTokenRateLimit = rateLimit({
  window: 60000,
  max: 20,
  keyPrefix: 'oauth_token',
});

/**
 * 常数时间比较两个字符串（防止时序攻击）
 * 先计算输入的哈希，再与存储的哈希做常数时间比较
 */
async function verifySecret(inputSecret, storedHash) {
  const inputHash = await hashSecret(inputSecret);
  const a = new TextEncoder().encode(inputHash);
  const b = new TextEncoder().encode(storedHash);
  if (a.length !== b.length) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

// ============================================
// 应用管理（需要管理员权限）
// ============================================

app.use('/apps', requirePermission('admin:full'));
app.use('/apps/*', requirePermission('admin:full'));

const CreateAppSchema = z
  .object({
    name: z.string().min(1, '应用名称不能为空').max(100),
    description: z.string().max(500).optional(),
    redirectUris: z.array(z.string().url('无效的回调地址')).min(1, '至少需要一个回调地址'),
    grantTypes: z
      .array(z.enum(['authorization_code', 'refresh_token']))
      .default(['authorization_code']),
    scopes: z.array(z.string()).default(['read']),
  })
  .strict();

const UpdateAppSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    redirectUris: z.array(z.string().url()).min(1).optional(),
    grantTypes: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
    scopes: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

/**
 * GET /apps - 列出所有 OAuth 应用
 */
app.get('/apps', async (c) => {
  const repo = new OAuthRepository(c.env.DB);
  const clients = await repo.listClients();
  return c.json({ success: true, data: clients });
});

/**
 * POST /apps - 注册新 OAuth 应用
 */
app.post('/apps', zValidator('json', CreateAppSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new OAuthRepository(c.env.DB);
  const client = await repo.createClient({
    ...body,
    actorId: c.get('user')?.id || c.get('user')?.sub,
  });
  return c.json({ success: true, data: client }, 201);
});

/**
 * GET /apps/:id - 获取应用详情
 */
app.get('/apps/:id', async (c) => {
  const repo = new OAuthRepository(c.env.DB);
  const client = await repo.getClientById(c.req.param('id'));
  if (!client) return c.json({ success: false, error: '应用不存在' }, 404);
  return c.json({ success: true, data: client });
});

/**
 * PUT /apps/:id - 更新应用
 */
app.put('/apps/:id', zValidator('json', UpdateAppSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new OAuthRepository(c.env.DB);
  const client = await repo.updateClient(c.req.param('id'), {
    ...body,
    actorId: c.get('user')?.id || c.get('user')?.sub,
  });
  if (!client) return c.json({ success: false, error: '应用不存在' }, 404);
  return c.json({ success: true, data: client });
});

/**
 * DELETE /apps/:id - 删除应用
 */
app.delete('/apps/:id', async (c) => {
  const repo = new OAuthRepository(c.env.DB);
  await repo.deleteClient(c.req.param('id'));
  return c.json({ success: true });
});

/**
 * POST /apps/:id/regenerate-secret - 重新生成客户端密钥
 */
app.post('/apps/:id/regenerate-secret', async (c) => {
  const repo = new OAuthRepository(c.env.DB);
  const newSecret = await repo.regenerateSecret(c.req.param('id'));
  return c.json({ success: true, data: { clientSecret: newSecret } });
});

/**
 * GET /apps/:id/tokens - 查看应用活跃令牌
 */
app.get('/apps/:id/tokens', async (c) => {
  const repo = new OAuthRepository(c.env.DB);
  const tokens = await repo.listTokensByClient(c.req.param('id'));
  return c.json({ success: true, data: tokens });
});

/**
 * POST /apps/:id/revoke-tokens - 撤销应用所有令牌
 */
app.post('/apps/:id/revoke-tokens', async (c) => {
  const repo = new OAuthRepository(c.env.DB);
  await repo.revokeAllForClient(c.req.param('id'));
  return c.json({ success: true });
});

// ============================================
// OAuth2.0 授权码流程
// ============================================

const AuthorizeSchema = z
  .object({
    client_id: z.string().min(1),
    redirect_uri: z.string().url(),
    response_type: z.literal('code'),
    scope: z.string().optional(),
    state: z.string().optional(),
  })
  .strict();

const AuthorizeQuerySchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  response_type: z.literal('code'),
  scope: z.string().optional(),
  state: z.string().optional(),
});

const RevokeSchema = z
  .object({
    token: z.string().min(1),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
  })
  .strict();

const TokenSchema = z
  .object({
    grant_type: z.enum(['authorization_code', 'refresh_token']),
    code: z.string().optional(),
    redirect_uri: z.string().url().optional(),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    refresh_token: z.string().optional(),
  })
  .strict();

/**
 * GET /authorize - 授权页面（返回授权信息供前端展示）
 * 前端调用此接口获取应用信息，用户确认后调用 POST /authorize
 */
app.get('/authorize', zValidator('query', AuthorizeQuerySchema), async (c) => {
  const { client_id, redirect_uri, scope, state } = c.req.valid('query');

  const repo = new OAuthRepository(c.env.DB);
  const client = await repo.getClientByClientId(client_id);
  if (!client || !client.enabled) {
    return c.json(
      { success: false, error: 'invalid_client', error_description: '客户端不存在或已禁用' },
      400
    );
  }

  if (!client.redirectUris.includes(redirect_uri)) {
    return c.json(
      { success: false, error: 'invalid_redirect_uri', error_description: '回调地址不匹配' },
      400
    );
  }

  const requestedScopes = scope ? scope.split(' ') : client.scopes;
  const invalidScopes = requestedScopes.filter((s) => !client.scopes.includes(s));
  if (invalidScopes.length > 0) {
    return c.json(
      {
        success: false,
        error: 'invalid_scope',
        error_description: `无效的权限范围: ${invalidScopes.join(', ')}`,
      },
      400
    );
  }

  return c.json({
    success: true,
    data: {
      client: { name: client.name, description: client.description },
      redirectUri: redirect_uri,
      scopes: requestedScopes,
      state: state || null,
    },
  });
});

/**
 * POST /authorize - 用户确认授权，生成授权码
 */
app.post('/authorize', zValidator('json', AuthorizeSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('user')?.id || c.get('user')?.sub;
  if (!userId) return c.json({ success: false, error: 'unauthorized' }, 401);

  const repo = new OAuthRepository(c.env.DB);
  const client = await repo.getClientByClientId(body.client_id);
  if (!client || !client.enabled) {
    return c.json({ success: false, error: 'invalid_client' }, 400);
  }
  if (!client.redirectUris.includes(body.redirect_uri)) {
    return c.json({ success: false, error: 'invalid_redirect_uri' }, 400);
  }

  const requestedScopes = body.scope ? body.scope.split(' ') : client.scopes;
  const { code } = await repo.createAuthorizationCode({
    clientId: body.client_id,
    userId,
    redirectUri: body.redirect_uri,
    scopes: requestedScopes,
  });

  return c.json({ success: true, data: { code, state: body.state || null } });
});

/**
 * POST /token - 交换授权码获取访问令牌
 */
app.post('/token', oauthTokenRateLimit, zValidator('json', TokenSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new OAuthRepository(c.env.DB);

  // 验证客户端
  const client = await repo.getClientByClientId(body.client_id);
  if (!client || !client.enabled) {
    return c.json({ success: false, error: 'invalid_client' }, 400);
  }
  if (!(await verifySecret(body.client_secret, client.clientSecret))) {
    return c.json({ success: false, error: 'invalid_client' }, 400);
  }

  if (body.grant_type === 'authorization_code') {
    if (!body.code || !body.redirect_uri) {
      return c.json(
        {
          success: false,
          error: 'invalid_request',
          error_description: '缺少 code 或 redirect_uri',
        },
        400
      );
    }

    const authCode = await repo.consumeAuthorizationCode(body.code);
    if (!authCode) {
      return c.json(
        { success: false, error: 'invalid_grant', error_description: '授权码无效或已过期' },
        400
      );
    }
    if (authCode.clientId !== body.client_id) {
      return c.json(
        { success: false, error: 'invalid_grant', error_description: '授权码与客户端不匹配' },
        400
      );
    }
    if (authCode.redirectUri !== body.redirect_uri) {
      return c.json(
        { success: false, error: 'invalid_grant', error_description: '回调地址不匹配' },
        400
      );
    }

    const accessToken = generatePrefixedId('at_');
    const refreshToken = client.grantTypes.includes('refresh_token')
      ? generatePrefixedId('rt_')
      : null;

    const token = await repo.createToken({
      clientId: body.client_id,
      userId: authCode.userId,
      scopes: authCode.scopes,
      accessToken,
      refreshToken,
    });

    return c.json({
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor((token.expiresAt - Date.now()) / 1000),
      refresh_token: token.refreshToken || undefined,
      scope: token.scopes.join(' '),
    });
  }

  if (body.grant_type === 'refresh_token') {
    if (!body.refresh_token) {
      return c.json(
        { success: false, error: 'invalid_request', error_description: '缺少 refresh_token' },
        400
      );
    }

    const existingToken = await repo.getTokenByRefreshToken(body.refresh_token);
    if (!existingToken || existingToken.clientId !== body.client_id) {
      return c.json(
        { success: false, error: 'invalid_grant', error_description: '刷新令牌无效或已过期' },
        400
      );
    }

    // 撤销旧令牌
    await repo.revokeToken(existingToken.accessToken);

    const accessToken = generatePrefixedId('at_');
    const refreshToken = generatePrefixedId('rt_');
    const token = await repo.createToken({
      clientId: body.client_id,
      userId: existingToken.userId,
      scopes: existingToken.scopes,
      accessToken,
      refreshToken,
    });

    return c.json({
      access_token: token.accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor((token.expiresAt - Date.now()) / 1000),
      refresh_token: token.refreshToken,
      scope: token.scopes.join(' '),
    });
  }

  return c.json({ success: false, error: 'unsupported_grant_type' }, 400);
});

/**
 * POST /revoke - 撤销令牌
 */
app.post('/revoke', zValidator('json', RevokeSchema), async (c) => {
  const { token, client_id, client_secret } = c.req.valid('json');

  const repo = new OAuthRepository(c.env.DB);
  const client = await repo.getClientByClientId(client_id);
  if (!client || !(await verifySecret(client_secret, client.clientSecret))) {
    return c.json({ success: false, error: 'invalid_client' }, 400);
  }

  await repo.revokeToken(token);
  return c.json({ success: true });
});

/**
 * GET /userinfo - 获取当前令牌用户信息（资源服务器示例）
 */
app.get('/userinfo', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'invalid_token' }, 401);
  }

  const accessToken = authHeader.slice(7);
  const repo = new OAuthRepository(c.env.DB);
  const token = await repo.getTokenByAccessToken(accessToken);
  if (!token) {
    return c.json({ success: false, error: 'invalid_token' }, 401);
  }

  return c.json({
    success: true,
    data: {
      userId: token.userId,
      clientId: token.clientId,
      scopes: token.scopes,
    },
  });
});

export default app;
