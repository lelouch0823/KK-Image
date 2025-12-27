// Webhook 管理 API
import { hasPermission } from '../utils/auth.js';
import { registerWebhook, deleteWebhook, getWebhooks, WEBHOOK_EVENTS } from '../utils/webhook.js';

// 获取 Webhook 列表
export async function onRequestGet(context) {
  const { request, env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const webhooks = await getWebhooks(env);

    return new Response(JSON.stringify({
      success: true,
      data: webhooks,
      supportedEvents: Object.values(WEBHOOK_EVENTS)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching webhooks:', error);
    throw error;
  }
}

// 导出 POST 请求处理器
export async function onRequestPost(context) {
  return await handlePostRequest(context);
}

// 删除 Webhook
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const webhookId = url.pathname.split('/').pop();

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    await deleteWebhook(env, webhookId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting webhook:', error);
    throw error;
  }
}

// 处理 POST 请求路由
async function handlePostRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 检查是否是测试端点
  if (url.pathname.includes('/test')) {
    return await testWebhook(context);
  } else {
    return await createWebhook(context);
  }
}

// 创建新的 Webhook
async function createWebhook(context) {
  const { request, env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const webhookConfig = await request.json();

    // 验证必需字段
    if (!webhookConfig.url) {
      const error = new Error('Webhook URL is required');
      error.name = 'ValidationError';
      throw error;
    }

    // 验证事件类型
    if (webhookConfig.events && webhookConfig.events.length > 0) {
      const validEvents = Object.values(WEBHOOK_EVENTS);
      const invalidEvents = webhookConfig.events.filter(event => !validEvents.includes(event));

      if (invalidEvents.length > 0) {
        const error = new Error(`Invalid events: ${invalidEvents.join(', ')}`);
        error.name = 'ValidationError';
        throw error;
      }
    }

    // 添加创建者信息
    webhookConfig.createdBy = user.name || user.id;

    const webhook = await registerWebhook(env, webhookConfig);

    return new Response(JSON.stringify({
      success: true,
      data: webhook
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating webhook:', error);
    throw error;
  }
}

// 测试 Webhook
async function testWebhook(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const webhookId = url.pathname.split('/')[4]; // /api/v1/webhooks/{id}/test

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const webhooks = await getWebhooks(env);
    const webhook = webhooks.find(w => w.id === webhookId);

    if (!webhook) {
      const error = new Error('Webhook not found');
      error.name = 'NotFoundError';
      throw error;
    }

    // 发送测试载荷
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Telegraph-Image',
        webhook: {
          id: webhook.id,
          url: webhook.url
        },
        user: {
          id: user.id,
          name: user.name
        }
      },
      id: 'test_' + Date.now()
    };

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Telegraph-Image-Webhook/1.0',
      'X-Webhook-Event': testPayload.event,
      'X-Webhook-ID': testPayload.id,
      'X-Webhook-Timestamp': testPayload.timestamp
    };

    // 添加签名（如果配置了密钥）
    if (webhook.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhook.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(testPayload)));
      headers['X-Webhook-Signature'] = 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(signature)));
    }

    // 添加自定义头部
    if (webhook.headers) {
      Object.assign(headers, webhook.headers);
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000) // 10秒超时
    });

    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    };

    if (!response.ok) {
      result.error = await response.text().catch(() => 'Unable to read response body');
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error testing webhook:', error);

    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
