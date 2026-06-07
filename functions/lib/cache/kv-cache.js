/**
 * KV 缓存工具
 * 用于缓存热点数据（品牌列表、品类列表、统计数据等）
 * 减少 D1 查询压力，提升响应速度
 *
 * SOTA: 使用 singleflight 模式防止缓存击穿
 */

/**
 * 创建 KV 缓存实例
 * @param {import('@cloudflare/workers-types').KVNamespace} kv
 * @param {Object} [options]
 * @param {number} [options.defaultTtl=300] 默认 TTL（秒）
 * @returns {KVCache}
 */
export function createKVCache(kv, { defaultTtl = 300 } = {}) {
  if (!kv) {
    // KV 不可用时返回空操作缓存（降级策略）
    return {
      async get(_key, fetcher) {
        return fetcher();
      },
      async invalidate() {},
      async set() {},
    };
  }

  // singleflight: 对同一 key 的并发 fetcher 调用合并为一次执行
  const inflightRequests = new Map();

  return {
    /**
     * 获取缓存数据，缓存未命中时调用 fetcher
     * @param {string} key 缓存 key
     * @param {() => Promise<T>} fetcher 缓存未命中时的数据获取函数
     * @param {Object} [options]
     * @param {number} [options.ttl] TTL（秒），覆盖默认值
     * @returns {Promise<T>}
     */
    async get(key, fetcher, { ttl = defaultTtl } = {}) {
      try {
        const cached = await kv.get(key, 'json');
        if (cached !== null) return cached;
      } catch (err) {
        console.warn(`[KVCache] Read error for key "${key}":`, err.message);
      }

      // singleflight: 如果同一 key 已有请求在飞行中，复用该 Promise
      if (inflightRequests.has(key)) {
        return inflightRequests.get(key);
      }

      const fetchPromise = fetcher().finally(() => {
        inflightRequests.delete(key);
      });
      inflightRequests.set(key, fetchPromise);

      const data = await fetchPromise;

      // 异步写入，不阻塞返回
      kv.put(key, JSON.stringify(data), { expirationTtl: ttl }).catch((err) => {
        console.warn(`[KVCache] Write error for key "${key}":`, err.message);
      });

      return data;
    },

    /**
     * 设置缓存
     * @param {string} key
     * @param {any} data
     * @param {Object} [options]
     * @param {number} [options.ttl]
     */
    async set(key, data, { ttl = defaultTtl } = {}) {
      try {
        await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
      } catch (err) {
        console.warn(`[KVCache] Write error for key "${key}":`, err.message);
      }
    },

    /**
     * 失效缓存
     * @param {string|string[]} keys
     */
    async invalidate(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      await Promise.allSettled(keyList.map((key) => kv.delete(key)));
    },
  };
}

/**
 * 常用缓存 key 前缀
 */
export const CACHE_KEYS = {
  /** 品牌+品类列表（变化极少，TTL 1小时） */
  FILTERS_BRANDS_CATEGORIES: 'cache:filters:brands_categories',
  /** 仪表盘统计（可接受短暂延迟，TTL 2分钟） */
  DASHBOARD_STATS: 'cache:dashboard:stats',
  /** 活跃销售员列表（TTL 10分钟） */
  SALES_ACTIVE_LIST: 'cache:sales:active_list',
  /** 上传趋势统计（TTL 2分钟） */
  STATS_UPLOADS: 'cache:stats:uploads',
};
