/**
 * 表单草稿自动保存 Composable
 * 将表单数据防抖写入 localStorage，页面重访时提供恢复能力
 *
 * @file src/composables/useFormDraft.ts
 */

import { ref, watch, onUnmounted, toRaw, type Ref } from 'vue';

/** 草稿快照结构 */
interface DraftSnapshot<T> {
  /** 快照版本，用于识别过期草稿 */
  version: number;
  /** 保存时间戳 (ms) */
  timestamp: number;
  /** 表单数据 */
  data: T;
}

/** useFormDraft 选项 */
interface FormDraftOptions<T extends Record<string, unknown>> {
  /** 草稿唯一标识，如 'order-create', 'purchase-order-create' */
  key: string;
  /** 需要监听的表单数据 (Ref 或 reactive) */
  data: Ref<T> | T;
  /** 防抖延迟 (ms)，默认 2000 */
  debounce?: number;
  /** 需要排除的字段名列表（如文件上传等不可序列化数据） */
  exclude?: string[];
  /** 快照版本号，变更后旧草稿自动失效，默认 1 */
  version?: number;
}

/** useFormDraft 返回值 */
interface FormDraftResult {
  /** 是否检测到可恢复的草稿 */
  hasDraft: Ref<boolean>;
  /** 草稿保存时间戳 */
  draftTimestamp: Ref<number | null>;
  /** 草稿数据（原始 JSON） */
  draftData: Ref<Record<string, unknown> | null>;
  /** 恢复草稿到表单 */
  restoreDraft: () => void;
  /** 清除草稿 */
  clearDraft: () => void;
  /** 获取格式化的相对时间文本 */
  getDraftAgeText: () => string;
}

const DRAFT_VERSION = 1;

/**
 * 将 Ref 或 reactive 对象解包为普通对象
 */
function unwrapData<T>(data: Ref<T> | T): T {
  if (data && typeof data === 'object' && 'value' in (data as Record<string, unknown>)) {
    return toRaw((data as Ref<T>).value) as T;
  }
  return toRaw(data as T) as T;
}

/**
 * 表单草稿自动保存 Composable
 *
 * @example
 * ```ts
 * const form = reactive({ name: '', remark: '' });
 * const { hasDraft, restoreDraft, clearDraft, getDraftAgeText } = useFormDraft({
 *   key: 'order-create',
 *   data: form,
 *   debounce: 2000,
 *   exclude: ['uploadedFiles'],
 * });
 * ```
 */
export function useFormDraft<T extends Record<string, unknown>>(
  options: FormDraftOptions<T>
): FormDraftResult {
  const storageKey = `kk-draft:${options.key}`;
  const debounceMs = options.debounce ?? 2000;
  const excludeKeys = new Set(options.exclude ?? []);
  const schemaVersion = options.version ?? DRAFT_VERSION;

  const hasDraft = ref(false) as Ref<boolean>;
  const draftTimestamp = ref<number | null>(null) as Ref<number | null>;
  const draftData = ref<Record<string, unknown> | null>(null) as Ref<Record<string, unknown> | null>;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRestoring = false;

  /**
   * 从当前表单数据构建快照，排除指定字段
   */
  function buildSnapshot(): DraftSnapshot<Record<string, unknown>> {
    const raw = unwrapData(options.data) || {};
    const filtered: Record<string, unknown> = {};

    for (const key of Object.keys(raw)) {
      if (!excludeKeys.has(key)) {
        const value = raw[key];
        // 跳过 undefined 和函数，它们无法被 JSON 序列化
        if (value === undefined || typeof value === 'function') continue;
        filtered[key] = value;
      }
    }

    return {
      version: schemaVersion,
      timestamp: Date.now(),
      data: filtered,
    };
  }

  /**
   * 将快照写入 localStorage
   */
  function saveDraft(): void {
    try {
      const snapshot = buildSnapshot();
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // QuotaExceededError 或其他存储错误，静默处理
    }
  }

  /**
   * 防抖保存
   */
  function debouncedSave(): void {
    if (isRestoring) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveDraft, debounceMs);
  }

  /**
   * 从 localStorage 读取草稿
   */
  function loadSnapshot(): DraftSnapshot<Record<string, unknown>> | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftSnapshot<Record<string, unknown>>;
      // 验证基本结构
      if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        return null;
      }
      return parsed;
    } catch {
      // JSON 解析失败，清除损坏的草稿
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      return null;
    }
  }

  /**
   * 恢复草稿数据到表单
   */
  function restoreDraft(): void {
    const snapshot = draftData.value;
    if (!snapshot) return;

    isRestoring = true;
    try {
      const current = unwrapData(options.data) || {};
      // 逐字段赋值，避免整体替换导致响应式丢失
      for (const key of Object.keys(snapshot)) {
        if (excludeKeys.has(key)) continue;
        if (key in current || typeof current === 'object') {
          (current as Record<string, unknown>)[key] = snapshot[key];
        }
      }
    } finally {
      isRestoring = false;
    }

    hasDraft.value = false;
    draftData.value = null;
  }

  /**
   * 清除 localStorage 中的草稿
   */
  function clearDraft(): void {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    hasDraft.value = false;
    draftTimestamp.value = null;
    draftData.value = null;
  }

  /**
   * 格式化草稿相对时间
   */
  function getDraftAgeText(): string {
    const ts = draftTimestamp.value;
    if (!ts) return '';

    const diffMs = Date.now() - ts;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    return `${diffDay}天前`;
  }

  /**
   * 清理定时器（供 onUnmounted 或手动调用）
   */
  function cleanup(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  // ---------- 初始化 ----------

  // 立即检查草稿（不依赖 onMounted，兼容组件内外使用）
  const snapshot = loadSnapshot();
  if (snapshot) {
    // 版本不匹配，清除旧草稿
    if (snapshot.version !== schemaVersion) {
      clearDraft();
    } else {
      // 检查数据是否有效（至少有一个非空字段）
      const hasContent = Object.values(snapshot.data).some(
        (v) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== false
      );
      if (hasContent) {
        hasDraft.value = true;
        draftTimestamp.value = snapshot.timestamp;
        draftData.value = snapshot.data;
      }
    }
  }

  // 监听数据变化，防抖自动保存
  // 使用 deep: true 监听深层变化，避免 JSON.stringify 开销
  watch(
    () => (options.data && 'value' in (options.data as Record<string, unknown>))
      ? (options.data as Ref<T>).value
      : options.data,
    () => {
      debouncedSave();
    },
    { deep: true }
  );

  // 组件卸载时清理定时器
  try {
    onUnmounted(cleanup);
  } catch {
    // 在组件外调用时 onUnmounted 会抛出，忽略即可
  }

  return {
    hasDraft,
    draftTimestamp,
    draftData,
    restoreDraft,
    clearDraft,
    getDraftAgeText,
  };
}
