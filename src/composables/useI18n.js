import { ref, computed } from 'vue';
import zhCN from '@/locales/zh-CN';

const currentLocale = ref('zh-CN');
const messages = {
  'zh-CN': zhCN,
};

export function useI18n() {
  const t = (path, params = {}) => {
    const keys = path.split('.');
    let value = messages[currentLocale.value];

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return path; // Fallback to key if not found
      }
    }

    // Simple interpolation: {count} -> 10
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/{(\w+)}/g, (_, key) => {
        return params[key] !== undefined ? params[key] : `{${key}}`;
      });
    }

    return value;
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
