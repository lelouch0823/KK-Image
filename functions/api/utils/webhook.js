// Webhook 工具模块 - 处理事件通知

// 支持的事件类型
export const WEBHOOK_EVENTS = {
  FILE_UPLOADED: 'file.uploaded',
  FILE_UPDATED: 'file.updated',
  FILE_DELETED: 'file.deleted',
  USER_CREATED: 'user.created',
  API_KEY_CREATED: 'api_key.created',
  API_KEY_DELETED: 'api_key.deleted'
};

// 触发 Webhook
export async function triggerWebhook(env, eventType, data) {
  try {
    // 获取已注册的 Webhooks
    const webhooks = await getRegisteredWebhooks(env, eventType);
    
    if (webhooks.length === 0) {
      console.log(`No webhooks registered for event: ${eventType}`);
      return;
    }
    
    // 准备 Webhook 载荷
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: data,
      id: generateWebhookId()
    };
    
    // 并行发送所有 Webhooks
    const promises = webhooks.map(webhook => sendWebhook(webhook, payload));
    const results = await Promise.allSettled(promises);
    
    // 记录结果
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        console.log(`Webhook ${webhooks[index].id} sent successfully`);
      } else {
        failureCount++;
        console.error(`Webhook ${webhooks[index].id} failed:`, result.reason);
      }
    });
    
    console.log(`Webhook summary for ${eventType}: ${successCount} success, ${failureCount} failed`);
    
    // 记录 Webhook 执行历史
    await logWebhookExecution(env, eventType, payload, results);
    
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    throw error;
  }
}

// 发送单个 Webhook
async function sendWebhook(webhook, payload) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Telegraph-Image-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp
      };
      
      // 添加签名（如果配置了密钥）
      if (webhook.secret) {
        const signature = await generateWebhookSignature(JSON.stringify(payload), webhook.secret);
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
        signal: AbortSignal.timeout(30000) // 30秒超时
      });
      
      if (response.ok) {
        return {
          success: true,
          status: response.status,
          attempt: attempt + 1
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      attempt++;
      console.error(`Webhook attempt ${attempt} failed:`, error.message);
      
      if (attempt >= maxRetries) {
        throw error;
      }
      
      // 指数退避重试
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 生成 Webhook 签名
async function generateWebhookSignature(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 获取已注册的 Webhooks
async function getRegisteredWebhooks(env, eventType) {
  if (!env.WEBHOOKS_KV) {
    return [];
  }
  
  try {
    const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
    
    return webhooks.filter(webhook => {
      // 检查是否启用
      if (!webhook.enabled) return false;
      
      // 检查事件类型匹配
      if (webhook.events && webhook.events.length > 0) {
        return webhook.events.includes(eventType);
      }
      
      // 如果没有指定事件类型，默认接收所有事件
      return true;
    });
  } catch (error) {
    console.error('Error getting registered webhooks:', error);
    return [];
  }
}

// 记录 Webhook 执行历史
async function logWebhookExecution(env, eventType, payload, results) {
  if (!env.WEBHOOK_LOGS_KV) {
    return;
  }
  
  try {
    const logEntry = {
      id: payload.id,
      event: eventType,
      timestamp: payload.timestamp,
      results: results.map((result, index) => ({
        webhookIndex: index,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason.message : null
      })),
      payload: payload
    };
    
    // 使用时间戳作为 key，便于按时间查询
    const logKey = `webhook_log_${Date.now()}_${payload.id}`;
    
    await env.WEBHOOK_LOGS_KV.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 30 * 24 * 60 * 60 // 30天后过期
    });
  } catch (error) {
    console.error('Error logging webhook execution:', error);
  }
}

// 生成 Webhook ID
function generateWebhookId() {
  return 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

// 注册新的 Webhook
export async function registerWebhook(env, webhookConfig) {
  if (!env.WEBHOOKS_KV) {
    throw new Error('Webhooks KV namespace not configured');
  }
  
  // 验证配置
  if (!webhookConfig.url) {
    throw new Error('Webhook URL is required');
  }
  
  if (!isValidUrl(webhookConfig.url)) {
    throw new Error('Invalid webhook URL');
  }
  
  const webhook = {
    id: generateWebhookId(),
    url: webhookConfig.url,
    events: webhookConfig.events || [],
    secret: webhookConfig.secret || null,
    headers: webhookConfig.headers || {},
    enabled: webhookConfig.enabled !== false,
    createdAt: new Date().toISOString(),
    createdBy: webhookConfig.createdBy || 'system'
  };
  
  // 获取现有 Webhooks
  const existingWebhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
  
  // 检查是否已存在相同 URL
  const existingWebhook = existingWebhooks.find(w => w.url === webhook.url);
  if (existingWebhook) {
    throw new Error('Webhook with this URL already exists');
  }
  
  // 添加新 Webhook
  existingWebhooks.push(webhook);
  
  await env.WEBHOOKS_KV.put('webhooks', JSON.stringify(existingWebhooks));
  
  return webhook;
}

// 删除 Webhook
export async function deleteWebhook(env, webhookId) {
  if (!env.WEBHOOKS_KV) {
    throw new Error('Webhooks KV namespace not configured');
  }
  
  const existingWebhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
  const updatedWebhooks = existingWebhooks.filter(w => w.id !== webhookId);
  
  if (updatedWebhooks.length === existingWebhooks.length) {
    throw new Error('Webhook not found');
  }
  
  await env.WEBHOOKS_KV.put('webhooks', JSON.stringify(updatedWebhooks));
  
  return true;
}

// 获取所有 Webhooks
export async function getWebhooks(env) {
  if (!env.WEBHOOKS_KV) {
    return [];
  }
  
  return await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
}

// URL 验证
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}
