// API 健康检查端点
export async function onRequestGet(context) {
  const { env } = context;
  
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {}
  };
  
  // 检查 KV 存储服务
  try {
    await env.img_url.get('health_check_test');
    healthCheck.services.kv_storage = 'healthy';
  } catch (error) {
    healthCheck.services.kv_storage = 'unhealthy';
    healthCheck.status = 'degraded';
  }
  
  // 检查 API Keys KV
  if (env.API_KEYS_KV) {
    try {
      await env.API_KEYS_KV.get('health_check_test');
      healthCheck.services.api_keys_kv = 'healthy';
    } catch (error) {
      healthCheck.services.api_keys_kv = 'unhealthy';
      healthCheck.status = 'degraded';
    }
  } else {
    healthCheck.services.api_keys_kv = 'not_configured';
  }
  
  // 检查 Webhooks KV
  if (env.WEBHOOKS_KV) {
    try {
      await env.WEBHOOKS_KV.get('health_check_test');
      healthCheck.services.webhooks_kv = 'healthy';
    } catch (error) {
      healthCheck.services.webhooks_kv = 'unhealthy';
      healthCheck.status = 'degraded';
    }
  } else {
    healthCheck.services.webhooks_kv = 'not_configured';
  }
  
  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  
  return new Response(JSON.stringify(healthCheck), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}
