import { ref, computed } from 'vue';
// 使用模块化的翻译文件
import zhCN from '@/locales/zh-CN/index';
import enUS from '@/locales/en/index';

const currentLocale = ref('zh-CN');
const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export function useI18n() {
  const t = (path, paramsOrFallback = {}) => {
    const hasFallback = typeof paramsOrFallback === 'string';
    const fallback = hasFallback ? paramsOrFallback : undefined;
    const params = !hasFallback && paramsOrFallback && typeof paramsOrFallback === 'object'
      ? paramsOrFallback
      : {};

    const keys = path.split('.');
    let value = messages[currentLocale.value];

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
    locale: computed(() => currentLocale.value),
    setLocale: (lang) => {
      if (messages[lang]) {
        currentLocale.value = lang;
      }
    },
  };
}
