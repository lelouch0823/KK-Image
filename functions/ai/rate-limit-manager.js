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
      const minuteWindow = 60000;
      const minuteKey = toWindowKey(ts, minuteWindow);
      const dayKey = toDateKey(ts);

      const rpmKey = `ai_quota:rpm:${identity}:${minuteKey}`;
      const tpdKey = `ai_quota:tpd:${identity}:${dayKey}`;
      const imageRpmKey = `ai_quota:image_rpm:${identity}:${minuteKey}`;

      const [rpmRaw, tpdRaw, imageRpmRaw] = await Promise.all([
        kv.get(rpmKey),
        kv.get(tpdKey),
        imageBearing && imageRequestsPerMinute ? kv.get(imageRpmKey) : Promise.resolve('0'),
      ]);

      const currentRequests = parseCount(rpmRaw);
      const currentTokens = parseCount(tpdRaw);
      const currentImageRequests = parseCount(imageRpmRaw);

      if (currentRequests >= Number(requestsPerMinute || 0)) {
        return {
          allowed: false,
          reason: 'rpm_exceeded',
          remaining: { requests: 0, tokens: Math.max(0, Number(tokensPerDay || 0) - currentTokens) },
        };
      }

      if (Number(tokensPerDay || 0) > 0 && currentTokens + Number(estimatedTokens || 0) > Number(tokensPerDay || 0)) {
        return {
          allowed: false,
          reason: 'tpd_exceeded',
          remaining: { requests: Math.max(0, Number(requestsPerMinute || 0) - currentRequests), tokens: 0 },
        };
      }

      if (imageBearing && Number(imageRequestsPerMinute || 0) > 0 && currentImageRequests >= Number(imageRequestsPerMinute || 0)) {
        return {
          allowed: false,
          reason: 'image_rpm_exceeded',
          remaining: { requests: Math.max(0, Number(requestsPerMinute || 0) - currentRequests), tokens: Math.max(0, Number(tokensPerDay || 0) - currentTokens) },
        };
      }

      await Promise.all([
        kv.put(rpmKey, String(currentRequests + 1), { expirationTtl: 120 }),
        kv.put(tpdKey, String(currentTokens + Number(estimatedTokens || 0)), { expirationTtl: 172800 }),
        imageBearing && Number(imageRequestsPerMinute || 0) > 0
          ? kv.put(imageRpmKey, String(currentImageRequests + 1), { expirationTtl: 120 })
          : Promise.resolve(),
      ]);

      return {
        allowed: true,
        reason: null,
        remaining: {
          requests: Math.max(0, Number(requestsPerMinute || 0) - currentRequests - 1),
          tokens: Math.max(0, Number(tokensPerDay || 0) - currentTokens - Number(estimatedTokens || 0)),
        },
      };
    },
  };
}
