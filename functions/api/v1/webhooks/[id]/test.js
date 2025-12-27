// Webhook 测试端点 - 发送测试载荷到指定 Webhook
import { hasPermission } from '../../../utils/auth.js';
import { getWebhooks } from '../../../utils/webhook.js';

// 测试特定 Webhook
export async function onRequestPost(context) {
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

    // 获取自定义测试数据（如果提供）
    let customData = {};
    try {
      const requestBody = await request.text();
      if (requestBody) {
        customData = JSON.parse(requestBody);
      }
    } catch (error) {
      // 忽略解析错误，使用默认测试数据
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
        },
        ...customData // 合并自定义测试数据
      },
      id: 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15)
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

    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(15000) // 15秒超时
      });

      const duration = Date.now() - startTime;

      const result = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        duration: duration,
        timestamp: new Date().toISOString()
      };

      // 尝试读取响应体
      try {
        const responseText = await response.text();
        if (responseText) {
          result.responseBody = responseText;

          // 尝试解析为 JSON
          try {
            result.responseJson = JSON.parse(responseText);
          } catch (e) {
            // 不是 JSON，保持文本格式
          }
        }
      } catch (e) {
        result.responseBodyError = 'Unable to read response body';
      }

      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          webhook: {
            id: webhook.id,
            url: webhook.url
          },
          test: result,
          payload: testPayload
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (fetchError) {
      const duration = Date.now() - startTime;

      return new Response(JSON.stringify({
        success: false,
        error: {
          message: fetchError.message,
          type: fetchError.name,
          duration: duration,
          timestamp: new Date().toISOString()
        },
        data: {
          webhook: {
            id: webhook.id,
            url: webhook.url
          },
          payload: testPayload
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error testing webhook:', error);
    throw error;
  }
}
