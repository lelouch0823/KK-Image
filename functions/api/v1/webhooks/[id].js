// Webhook 单个操作 API - 处理特定 Webhook ID 的操作
import { hasPermission } from '../../utils/auth.js';
import { deleteWebhook, getWebhooks } from '../../utils/webhook.js';

// 获取单个 Webhook 信息
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const webhookId = params.id;

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

    return new Response(JSON.stringify({
      success: true,
      data: webhook
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching webhook:', error);
    throw error;
  }
}

// 删除特定 Webhook
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const webhookId = params.id;

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

// 更新 Webhook 配置
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const webhookId = params.id;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const updateData = await request.json();

    // 获取现有 Webhooks
    const webhooks = await getWebhooks(env);
    const webhookIndex = webhooks.findIndex(w => w.id === webhookId);

    if (webhookIndex === -1) {
      const error = new Error('Webhook not found');
      error.name = 'NotFoundError';
      throw error;
    }

    // 更新 Webhook 配置
    const webhook = webhooks[webhookIndex];

    if (updateData.url !== undefined) {
      webhook.url = updateData.url;
    }

    if (updateData.events !== undefined) {
      webhook.events = updateData.events;
    }

    if (updateData.secret !== undefined) {
      webhook.secret = updateData.secret;
    }

    if (updateData.headers !== undefined) {
      webhook.headers = updateData.headers;
    }

    if (updateData.enabled !== undefined) {
      webhook.enabled = updateData.enabled;
    }

    webhook.updatedAt = new Date().toISOString();
    webhook.updatedBy = user.name || user.id;

    // 保存更新
    await env.WEBHOOKS_KV.put('webhooks', JSON.stringify(webhooks));

    return new Response(JSON.stringify({
      success: true,
      data: webhook
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating webhook:', error);
    throw error;
  }
}
