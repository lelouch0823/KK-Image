// Webhook 工具模块 - 处理事件通知 (D1 版本)

import { generatePrefixedId, generateHmacSignature, isValidUrl } from './id.js';
import { MAX_WEBHOOK_RETRIES, WEBHOOK_TIMEOUT_MS } from './constants.js';

// 支持的事件类型
export const WEBHOOK_EVENTS = {
  FILE_UPLOADED: 'file.uploaded',
  FILE_UPDATED: 'file.updated',
  FILE_DELETED: 'file.deleted',
  USER_CREATED: 'user.created',
  API_KEY_CREATED: 'api_key.created',
  API_KEY_DELETED: 'api_key.deleted',
};

/**
 * 触发 Webhook
 * @param {Object} env - 环境变量
 * @param {string} eventType - 事件类型
 * @param {Object} data - 事件数据
 */
export async function triggerWebhook(env, eventType, data) {
  try {
    // 获取已注册的 Webhooks
    const webhooks = await getRegisteredWebhooks(env, eventType);

    if (webhooks.length === 0) {
      // No webhooks registered, skip silently
      return;
    }

    // 准备 Webhook 载荷
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: data,
      id: generatePrefixedId('wh_'),
    };

    // 并行发送所有 Webhooks
    const promises = webhooks.map((webhook) => sendWebhook(env, webhook, payload));
    const results = await Promise.allSettled(promises);

    // 记录结果
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        console.error(`Webhook ${webhooks[index].id} failed:`, result.reason);
      }
    });
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    throw error;
  }
}

/**
 * 发送单个 Webhook
 */
async function sendWebhook(env, webhook, payload) {
  const maxRetries = MAX_WEBHOOK_RETRIES;
  let attempt = 0;
  let lastError = null;
  const startTime = Date.now();

  while (attempt < maxRetries) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'kk-life-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp,
      };

      // 添加签名（如果配置了密钥）
      if (webhook.secret) {
        const signature = await generateHmacSignature(JSON.stringify(payload), webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // 添加自定义头部
      if (webhook.headers) {
        Object.assign(headers, webhook.headers);
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      const duration = Date.now() - startTime;

      // 记录日志
      await logWebhookExecution(
        env,
        webhook.id,
        payload,
        response.status,
        duration,
        response.ok,
        null
      );

      if (response.ok) {
        return {
          success: true,
          status: response.status,
          attempt: attempt + 1,
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      attempt++;
      lastError = error;
      console.error(`Webhook attempt ${attempt} failed:`, error.message);

      if (attempt >= maxRetries) {
        const duration = Date.now() - startTime;
        await logWebhookExecution(env, webhook.id, payload, 0, duration, false, error.message);
        throw error;
      }

      // 指数退避重试
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * 获取已注册的 Webhooks (D1)
 */
async function getRegisteredWebhooks(env, eventType) {
  if (!env.DB) {
    return [];
  }

  try {
    const { results } = await env.DB.prepare('SELECT * FROM webhooks WHERE enabled = 1').all();

    return results
      .filter((webhook) => {
        // 检查事件类型匹配
        if (webhook.events) {
          const events = JSON.parse(webhook.events);
          if (events.length > 0) {
            return events.includes(eventType);
          }
        }
        // 如果没有指定事件类型，默认接收所有事件
        return true;
      })
      .map((row) => ({
        id: row.id,
        url: row.url,
        events: row.events ? JSON.parse(row.events) : [],
        secret: row.secret,
        headers: row.headers ? JSON.parse(row.headers) : {},
        enabled: Boolean(row.enabled),
      }));
  } catch (error) {
    console.error('Error getting registered webhooks:', error);
    return [];
  }
}

/**
 * 记录 Webhook 执行历史 (D1)
 */
async function logWebhookExecution(
  env,
  webhookId,
  payload,
  statusCode,
  durationMs,
  success,
  errorMsg
) {
  if (!env.DB) {
    return;
  }

  try {
    const logId = generatePrefixedId('log_');

    await env.DB.prepare(
      `
      INSERT INTO webhook_logs (id, webhook_id, event, payload, status_code, duration_ms, success, response, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        logId,
        webhookId,
        payload.event,
        JSON.stringify(payload),
        statusCode,
        durationMs,
        success ? 1 : 0,
        errorMsg || null,
        Date.now()
      )
      .run();
  } catch (error) {
    console.error('Error logging webhook execution:', error);
  }
}

/**
 * 注册新的 Webhook (D1)
 */
export async function registerWebhook(env, webhookConfig) {
  if (!env.DB) {
    throw new Error('Database not configured');
  }

  // 验证配置
  if (!webhookConfig.url) {
    throw new Error('Webhook URL is required');
  }

  if (!isValidUrl(webhookConfig.url)) {
    throw new Error('Invalid webhook URL');
  }

  // 检查是否已存在相同 URL
  const existing = await env.DB.prepare('SELECT id FROM webhooks WHERE url = ?')
    .bind(webhookConfig.url)
    .first();

  if (existing) {
    throw new Error('Webhook with this URL already exists');
  }

  const id = generatePrefixedId('wh_');
  const now = Date.now();

  await env.DB.prepare(
    `
    INSERT INTO webhooks (id, url, events, secret, headers, enabled, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  )
    .bind(
      id,
      webhookConfig.url,
      JSON.stringify(webhookConfig.events || []),
      webhookConfig.secret || null,
      JSON.stringify(webhookConfig.headers || {}),
      webhookConfig.enabled !== false ? 1 : 0,
      webhookConfig.createdBy || 'system',
      now
    )
    .run();

  return {
    id,
    url: webhookConfig.url,
    events: webhookConfig.events || [],
    secret: webhookConfig.secret || null,
    headers: webhookConfig.headers || {},
    enabled: webhookConfig.enabled !== false,
    createdAt: now,
    createdBy: webhookConfig.createdBy || 'system',
  };
}

/**
 * 删除 Webhook (D1)
 */
export async function deleteWebhook(env, webhookId) {
  if (!env.DB) {
    throw new Error('Database not configured');
  }

  const existing = await env.DB.prepare('SELECT id FROM webhooks WHERE id = ?')
    .bind(webhookId)
    .first();

  if (!existing) {
    throw new Error('Webhook not found');
  }

  await env.DB.prepare('DELETE FROM webhooks WHERE id = ?').bind(webhookId).run();

  return true;
}

/**
 * 获取所有 Webhooks (D1)
 */
export async function getWebhooks(env) {
  if (!env.DB) {
    return [];
  }

  const { results } = await env.DB.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all();

  return results.map((row) => ({
    id: row.id,
    url: row.url,
    events: row.events ? JSON.parse(row.events) : [],
    secret: row.secret,
    headers: row.headers ? JSON.parse(row.headers) : {},
    enabled: Boolean(row.enabled),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }));
}
