import { ref, computed, type Ref, type ComputedRef } from 'vue';
// 使用模块化的翻译文件
import zhCN from '@/locales/zh-CN/index';
import enUS from '@/locales/en/index';

const currentLocale: Ref<string> = ref('zh-CN');
const messages: Record<string, any> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export function useI18n() {
  const t = (path: string, paramsOrFallback: Record<string, any> | string = {}): string => {
    const hasFallback = typeof paramsOrFallback === 'string';
    const fallback: string | undefined = hasFallback ? paramsOrFallback : undefined;
    const params: Record<string, any> = !hasFallback && paramsOrFallback && typeof paramsOrFallback === 'object'
      ? paramsOrFallback
      : {};

    const keys = path.split('.');
    let value: any = messages[currentLocale.value];

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return fallback ?? path;
      }
    }

    // Simple interpolation: {count} -> 10
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/{(\w+)}/g, (_, key) => {
        return params[key] !== undefined ? params[key] : `{${key}}`;
      });
    }

    if (value !== undefined) {
      return value;
    }
    return fallback ?? path;
  };

  return {
    t,
    locale: computed((): string => currentLocale.value) as ComputedRef<string>,
    setLocale: (lang: string): void => {
      if (messages[lang]) {
        currentLocale.value = lang;
      }
    },
  };
}
