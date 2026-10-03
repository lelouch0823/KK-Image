/**
 * 缓存代际失效（审查 P-H1/S-L6）
 * ============================================
 *
 * 取代"按 URL 笛卡尔积逐个 cache.delete"的失效模式：
 * - 失效方：对受影响的 resource scope 做一次 KV 代际递增（单次写）；
 * - 服务方：withCache 把代际号并入缓存键，代际一变，旧条目自然失活；
 * - 身份摘要并入键（S-L6）：Cache API 为 colo 级跨用户共享，
 *   `Cache-Control: private` 不约束 cache.put/match，键不含身份时
 *   任何"按用户过滤的 GET"上 withCache 即成跨用户泄露。
 *
 * KV 最终一致（跨 colo 传播 ≤60s），未传播期间旧代际继续命中——
 * 与现状（cache.delete 仅作用本地 colo、跨 colo 靠 TTL）等价或更好，
 * 但成本从 O(URL 数) 个 subrequest 降为每 scope 一次 KV 写。
 *
 * env.KV 缺失时（部分本地环境）：代际退化为进程内计数器，
 * 单 isolate 内仍可失效；键结构与 KV 路径完全一致。
 */

const MEMO_TTL_MS = 5000;
const GENERATION_KEY_PREFIX = 'cache:gen:';

// isolate 内代际备忘：避免每个缓存请求都打 KV
const generationMemo = new Map(); // scope -> { value: string, at: number }
// 无 KV 环境的进程内代际计数
const localGenerations = new Map(); // scope -> number

/**
 * 从 URL 推导 resource scope（前 3 段路径，如 api/manage/orders）。
 * scope 粒度刻意偏粗：同资源的列表/详情/筛选共享 scope，
 * 失效一次全部失活（与原 URL 枚举的覆盖面一致）。
 */
export function scopeFromUrl(url) {
  try {
    const path = String(url || '');
    const segments = path
      .replace(/^https?:\/\/[^/]+/, '')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    return segments.slice(0, 3).join(':') || 'api';
  } catch {
    return 'api';
  }
}

export function cacheGenerationKey(scope) {
  return `${GENERATION_KEY_PREFIX}${scope}`;
}

async function kvGet(env, scope) {
  const memo = generationMemo.get(scope);
  const now = Date.now();
  if (memo && now - memo.at < MEMO_TTL_MS) return memo.value;

  let value = null;
  try {
    value = await env.KV.get(cacheGenerationKey(scope));
  } catch {
    value = null;
  }

  const resolved = value || String(localGenerations.get(scope) || 0);
  generationMemo.set(scope, { value: resolved, at: now });
  return resolved;
}

/** 读取 scope 当前代际号（用于缓存键） */
export async function getCacheGeneration(env, scope) {
  if (!env?.KV) return String(localGenerations.get(scope) || 0);
  return kvGet(env, scope);
}

/**
 * 递增一个或多个 scope 的代际号。
 * 失效方调用；每次调用将对应 scope 的全部缓存键立即作废。
 */
export async function bumpCacheGeneration(env, scopes) {
  const scopeList = [...new Set((Array.isArray(scopes) ? scopes : [scopes]).filter(Boolean))];
  const timestamp = String(Date.now());

  for (const scope of scopeList) {
    generationMemo.delete(scope);
    localGenerations.set(scope, (localGenerations.get(scope) || 0) + 1);
    if (env?.KV) {
      try {
        await env.KV.put(cacheGenerationKey(scope), timestamp);
      } catch (error) {
        console.error('[cache-generation] KV put failed:', scope, error);
      }
    }
  }
}

/** URL 列表 → scope 集合（失效入口的便捷转换） */
export function scopesFromUrls(urls) {
  return [...new Set((Array.isArray(urls) ? urls : [urls]).map((url) => scopeFromUrl(url)))];
}

/** 测试隔离：清空 isolate 内备忘 */
export function resetCacheGenerationMemo() {
  generationMemo.clear();
  localGenerations.clear();
}
