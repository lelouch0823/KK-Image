import { ref, computed, type Ref, type ComputedRef } from 'vue';
// 使用模块化的翻译文件
import zhCN from '@/locales/zh-CN/index';
import enUS from '@/locales/en/index';

const LOCALE_STORAGE_KEY = 'app-locale';
const DEFAULT_LOCALE = 'zh-CN';

const messages: Record<string, Record<string, unknown>> = {
  'zh-CN': zhCN as Record<string, unknown>,
  'en-US': enUS as Record<string, unknown>,
};

const SUPPORTED_LOCALES = Object.keys(messages);
const HTML_LANG: Record<string, string> = {
  'zh-CN': 'zh',
  'en-US': 'en',
};

/** 读取持久化的语言选择（SSR/测试环境无 localStorage 时回退默认值） */
const readPersistedLocale = (): string => {
  try {
    const saved = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return DEFAULT_LOCALE;
};

const currentLocale: Ref<string> = ref(readPersistedLocale());

const applyDocumentLang = (locale: string): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = HTML_LANG[locale] || 'zh';
};

// 启动时同步 <html lang>（index.html 默认 zh）
applyDocumentLang(currentLocale.value);

/**
 * 按路径解析 locale 树中的字符串；任何一级缺失都返回 undefined
 */
const resolve = (
  locale: Record<string, unknown> | undefined,
  path: string
): string | undefined => {
  if (!locale) return undefined;
  const keys = path.split('.');
  let value: unknown = locale;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : undefined;
};

export function useI18n() {
  /**
   * 翻译函数，支持三种调用形式：
   * - t(path)                         无参
   * - t(path, { count: 1 })           带插值参数
   * - t(path, '兜底文案')              带兜底文案
   * - t(path, '兜底 {n}', { n: 1 })    兜底 + 插值参数（三参形式）
   */
  const t = (
    path: string,
    paramsOrFallback: Record<string, unknown> | string = {},
    extraParams: Record<string, unknown> = {}
  ): string => {
    const hasFallback = typeof paramsOrFallback === 'string';
    const fallback: string | undefined = hasFallback ? paramsOrFallback : undefined;
    const params: Record<string, unknown> = hasFallback
      ? extraParams
      : paramsOrFallback && typeof paramsOrFallback === 'object'
        ? paramsOrFallback
        : {};

    // 当前语言 → zh-CN（基准语言兜底）→ 调用方兜底文案 → 原始路径。
    // 回退链保证英文包缺键时用户看到中文而不是 "settings.xxx.yyy"
    const value = resolve(messages[currentLocale.value], path) ?? resolve(messages['zh-CN'], path);

    if (value === undefined) {
      return fallback ?? path;
    }

    // Simple interpolation: {count} -> 10
    if (Object.keys(params).length > 0) {
      return value.replace(/{(\w+)}/g, (_, key: string) => {
        const paramValue = params[key];
        return paramValue !== undefined ? String(paramValue) : `{${key}}`;
      });
    }

    return value;
  };

  return {
    t,
    locale: computed((): string => currentLocale.value) as ComputedRef<string>,
    supportedLocales: SUPPORTED_LOCALES,
    setLocale: (lang: string): void => {
      if (messages[lang]) {
        currentLocale.value = lang;
        try {
          globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, lang);
        } catch {
          /* 持久化失败不影响本次切换 */
        }
        applyDocumentLang(lang);
      }
    },
  };
}
