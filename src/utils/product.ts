import { hasEntries } from '@/utils/object-utils';

/**
 * 格式化变体名称：将 options_values 对象转为可读字符串。
 * 键排序后取值，用 " · " 拼接；空对象返回 "Default"。
 */
export const formatVariantName = (optionsValues) => {
  if (!hasEntries(optionsValues)) return 'Default';
  return Object.keys(optionsValues)
    .sort()
    .map((key) => optionsValues[key])
    .join(' · ');
};
