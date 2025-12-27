// Webhook 日志查看 API
import { hasPermission } from '../../utils/auth.js';

// 获取 Webhook 执行日志
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    if (!env.WEBHOOK_LOGS_KV) {
      return new Response(JSON.stringify({
        success: true,
        data: [],
        message: 'Webhook logs KV namespace not configured'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取查询参数
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const eventType = url.searchParams.get('event');
    const webhookId = url.searchParams.get('webhook_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // 获取所有日志键
    const logKeys = await env.WEBHOOK_LOGS_KV.list({
      prefix: 'webhook_log_',
      limit: limit * 2 // 获取更多以便过滤
    });

    const logs = [];

    // 批量获取日志内容
    for (const key of logKeys.keys) {
      try {
        const logData = await env.WEBHOOK_LOGS_KV.get(key.name, 'json');
        if (logData) {
          // 应用过滤条件
          let includeLog = true;

          if (eventType && logData.event !== eventType) {
            includeLog = false;
          }

          if (webhookId && !logData.results.some(r => r.webhookId === webhookId)) {
            includeLog = false;
          }

          if (startDate) {
            const logTime = new Date(logData.timestamp);
            const filterStartTime = new Date(startDate);
            if (logTime < filterStartTime) {
              includeLog = false;
            }
          }

          if (endDate) {
            const logTime = new Date(logData.timestamp);
            const filterEndTime = new Date(endDate);
            if (logTime > filterEndTime) {
              includeLog = false;
            }
          }

          if (includeLog) {
            logs.push({
              ...logData,
              key: key.name
            });
          }
        }
      } catch (error) {
        console.error(`Error reading log ${key.name}:`, error);
      }

      // 达到限制数量就停止
      if (logs.length >= limit) {
        break;
      }
    }

    // 按时间戳降序排序
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 限制返回数量
    const limitedLogs = logs.slice(0, limit);

    // 计算统计信息
    const stats = {
      total: limitedLogs.length,
      successful: limitedLogs.filter(log =>
        log.results.some(r => r.success)
      ).length,
      failed: limitedLogs.filter(log =>
        log.results.every(r => !r.success)
      ).length,
      events: [...new Set(limitedLogs.map(log => log.event))],
      dateRange: limitedLogs.length > 0 ? {
        earliest: limitedLogs[limitedLogs.length - 1].timestamp,
        latest: limitedLogs[0].timestamp
      } : null
    };

    return new Response(JSON.stringify({
      success: true,
      data: limitedLogs,
      stats: stats,
      pagination: {
        limit: limit,
        hasMore: logKeys.keys.length > limit
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    throw error;
  }
}

// 清理旧的 Webhook 日志
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    if (!env.WEBHOOK_LOGS_KV) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Webhook logs KV namespace not configured'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取清理参数
    const daysOld = parseInt(url.searchParams.get('days_old') || '30');
    const eventType = url.searchParams.get('event');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // 获取所有日志键
    const logKeys = await env.WEBHOOK_LOGS_KV.list({
      prefix: 'webhook_log_'
    });

    let deletedCount = 0;
    const deletePromises = [];

    for (const key of logKeys.keys) {
      try {
        // 从键名中提取时间戳
        const keyParts = key.name.split('_');
        if (keyParts.length >= 3) {
          const timestamp = parseInt(keyParts[2]);
          const logDate = new Date(timestamp);

          if (logDate < cutoffDate) {
            // 如果指定了事件类型，需要检查日志内容
            if (eventType) {
              const logData = await env.WEBHOOK_LOGS_KV.get(key.name, 'json');
              if (logData && logData.event === eventType) {
                deletePromises.push(env.WEBHOOK_LOGS_KV.delete(key.name));
                deletedCount++;
              }
            } else {
              deletePromises.push(env.WEBHOOK_LOGS_KV.delete(key.name));
              deletedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing log key ${key.name}:`, error);
      }
    }

    // 执行删除操作
    await Promise.all(deletePromises);

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${deletedCount} webhook logs older than ${daysOld} days`,
      deletedCount: deletedCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error cleaning webhook logs:', error);
    throw error;
  }
}
