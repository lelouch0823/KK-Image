/**
 * 功能开关 Composable
 * @module composables/useFeatureFlag
 *
 * 提供全局功能开关管理：
 * - useFeatureFlag(key) - 单个开关状态
 * - useFeatureFlags() - 获取所有开关
 *
 * 使用全局单例模式，带 TTL 缓存，避免重复请求。
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { useAuth } from '@/composables/useAuth';

/** 功能开关数据结构 */
interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
}

/** API 响应结构 */
interface FeatureFlagsResponse {
  success: boolean;
  data: FeatureFlag[];
}

// ==================== 全局单例状态 ====================

/** 所有功能开关（key -> enabled） */
const flagsMap: Ref<Map<string, FeatureFlag>> = ref(new Map());

/** 加载状态 */
const isLoading: Ref<boolean> = ref(false);

/** 是否已加载 */
const isLoaded: Ref<boolean> = ref(false);

/** 上次加载时间戳 */
const lastFetchedAt: Ref<number> = ref(0);

/** 缓存 TTL（毫秒），默认 5 分钟 */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ==================== 工具函数 ====================

/**
 * 检查缓存是否有效
 */
function isCacheValid(): boolean {
  if (!isLoaded.value) return false;
  return Date.now() - lastFetchedAt.value < CACHE_TTL_MS;
}

/**
 * 获取所有功能开关
 */
async function fetchFlags(): Promise<void> {
  if (isLoading.value) return;

  const { authFetch } = useAuth();
  try {
    isLoading.value = true;
    const res = await authFetch('/api/manage/feature-flags');
    const json: FeatureFlagsResponse = await res.json();

    if (json.success && Array.isArray(json.data)) {
      const newMap = new Map<string, FeatureFlag>();
      for (const flag of json.data) {
        newMap.set(flag.key, flag);
      }
      flagsMap.value = newMap;
      isLoaded.value = true;
      lastFetchedAt.value = Date.now();
    }
  } catch (e) {
    console.warn('加载功能开关失败:', e);
  } finally {
    isLoading.value = false;
  }
}

/**
 * 确保数据已加载（带缓存检查）
 */
async function ensureLoaded(force = false): Promise<void> {
  if (!force && isCacheValid()) return;
  await fetchFlags();
}

// ==================== Composable 导出 ====================

/**
 * 获取单个功能开关状态
 * @param flagKey - 功能开关的 key
 * @returns { isEnabled, loading }
 */
export function useFeatureFlag(flagKey: string): {
  isEnabled: ComputedRef<boolean>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  // 触发加载（首次使用时）
  ensureLoaded();

  const isEnabled = computed(() => {
    const flag = flagsMap.value.get(flagKey);
    return flag?.enabled ?? false;
  });

  const refresh = async () => {
    await ensureLoaded(true);
  };

  return { isEnabled, loading: isLoading, refresh };
}

/**
 * 获取所有功能开关
 * @returns { flags, loading, refresh }
 */
export function useFeatureFlags(): {
  flags: Ref<Map<string, FeatureFlag>>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
  isEnabled: (key: string) => boolean;
} {
  // 触发加载
  ensureLoaded();

  const isEnabled = (key: string): boolean => {
    const flag = flagsMap.value.get(key);
    return flag?.enabled ?? false;
  };

  const refresh = async () => {
    await ensureLoaded(true);
  };

  return { flags: flagsMap, loading: isLoading, refresh, isEnabled };
}

/**
 * 清除缓存（用于测试或强制刷新）
 */
export function clearFeatureFlagCache(): void {
  flagsMap.value = new Map();
  isLoaded.value = false;
  lastFetchedAt.value = 0;
}
