/**
 * 通知文本渲染工具
 *
 * 处理可能的 JSON 格式翻译包，支持两种格式：
 * 1. JSON 字符串包含 `key` 字段 → 用 t(key, data) 翻译
 * 2. 普通字符串 → 尝试作为翻译 key，翻译不到则返回原值
 */

type TranslateFn = (key: string, params?: Record<string, unknown> | string) => string;

export function renderNotificationText(t: TranslateFn, val: unknown): string {
  if (!val) return '';
  const str = String(val);
  if (str.startsWith('{')) {
    try {
      const data = JSON.parse(str);
      if (data.key) {
        return t(data.key, data);
      }
    } catch {
      return str;
    }
  }
  const translated = t(str);
  return translated === str ? str : translated;
}
