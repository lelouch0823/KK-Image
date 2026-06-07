/** 一分钟的毫秒数 */
const MINUTE_MS = 60_000;

/** KV 限流数据 TTL：2 天（秒） */
const RATE_LIMIT_KV_TTL = 2 * 24 * 60 * 60;

function toDateKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function toWindowKey(timestamp, windowMs) {
  return Math.floor(timestamp / windowMs);
}

function parseCount(value) {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createAIRateLimitManager({ kv, now = () => Date.now() } = {}) {
  if (!kv) {
    throw new Error('KV binding is required for AI rate limit manager');
  }

  return {
    async checkAndConsume({
      userId,
      requestsPerMinute,
      estimatedTokens = 0,
      tokensPerDay,
      imageRequestsPerMinute = null,
      imageBearing = false,
    } = {}) {
      const ts = now();
      const identity = String(userId || 'anonymous');
      const minuteWindow = MINUTE_MS;
      const minuteKey = toWindowKey(ts, minuteWindow);
      const dayKey = toDateKey(ts);

      // 合并为单个 KV key，减少 3 次读取为 1 次
      const consolidatedKey = `ai_quota:${identity}`;
      const raw = await kv.get(consolidatedKey, 'json');
      const data = raw && typeof raw === 'object' ? raw : {};

      // RPM: 如果窗口已过期，重置计数
      const currentRequests = data.rpmWindow === minuteKey ? parseCount(data.rpm) : 0;
      // TPD: 如果日期已过期，重置计数
      const currentTokens = data.tpdDay === dayKey ? parseCount(data.tpd) : 0;
      // Image RPM: 同一分钟窗口
      const currentImageRequests = data.imgWindow === minuteKey ? parseCount(data.imgRpm) : 0;

      if (currentRequests >= Number(requestsPerMinute || 0)) {
        return {
          allowed: false,
          reason: 'rpm_exceeded',
          remaining: {
            requests: 0,
            tokens: Math.max(0, Number(tokensPerDay || 0) - currentTokens),
          },
        };
      }

      if (
        Number(tokensPerDay || 0) > 0 &&
        currentTokens + Number(estimatedTokens || 0) > Number(tokensPerDay || 0)
      ) {
        return {
          allowed: false,
          reason: 'tpd_exceeded',
          remaining: {
            requests: Math.max(0, Number(requestsPerMinute || 0) - currentRequests),
            tokens: 0,
          },
        };
      }

      if (
        imageBearing &&
        Number(imageRequestsPerMinute || 0) > 0 &&
        currentImageRequests >= Number(imageRequestsPerMinute || 0)
      ) {
        return {
          allowed: false,
          reason: 'image_rpm_exceeded',
          remaining: {
            requests: Math.max(0, Number(requestsPerMinute || 0) - currentRequests),
            tokens: Math.max(0, Number(tokensPerDay || 0) - currentTokens),
          },
        };
      }

      // 更新合并数据，单次 KV 写入
      const updated = {
        rpm: currentRequests + 1,
        rpmWindow: minuteKey,
        tpd: currentTokens + Number(estimatedTokens || 0),
        tpdDay: dayKey,
        imgRpm:
          imageBearing && Number(imageRequestsPerMinute || 0) > 0
            ? currentImageRequests + 1
            : currentImageRequests,
        imgWindow: minuteKey,
      };
      await kv.put(consolidatedKey, JSON.stringify(updated), { expirationTtl: RATE_LIMIT_KV_TTL });

      return {
        allowed: true,
        reason: null,
        remaining: {
          requests: Math.max(0, Number(requestsPerMinute || 0) - currentRequests - 1),
          tokens: Math.max(
            0,
            Number(tokensPerDay || 0) - currentTokens - Number(estimatedTokens || 0)
          ),
        },
      };
    },
  };
}
