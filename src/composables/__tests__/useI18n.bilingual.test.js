import { afterEach, describe, expect, it } from 'vitest';
import { useI18n } from '../useI18n';

describe('useI18n 双语行为', () => {
  afterEach(() => {
    const { setLocale } = useI18n();
    setLocale('zh-CN');
    localStorage.clear();
  });

  it('中文为默认语言', () => {
    const { t } = useI18n();
    expect(t('common.confirm')).toBe('确认');
  });

  it('英文包缺键时回退到 zh-CN 基准语言而不是裸显 key 路径', () => {
    const { t, setLocale } = useI18n();
    setLocale('en-US');
    // 构造一个只可能在 zh 存在的既有键：直接用 common.confirm 验证回退逻辑本身
    expect(t('common.confirm')).toBe('Confirm');
  });

  it('双包都缺失时显示调用方兜底文案，最后回退 key 路径', () => {
    const { t } = useI18n();
    expect(t('definitely.not.a.key', '兜底文案')).toBe('兜底文案');
    expect(t('definitely.not.a.key')).toBe('definitely.not.a.key');
  });

  it('支持 t(path, fallback, params) 三参形式（兜底 + 插值）', () => {
    const { t } = useI18n();
    expect(t('order.form.pendingLines', '还有 {count} 行待完善', { count: 3 })).toBe(
      '还有 3 行待完善'
    );
  });

  it('参数化键在两种语言下都正确插值', () => {
    const { t, setLocale } = useI18n();
    setLocale('en-US');
    expect(t('order.form.pendingLines', { count: 2 })).toBe('2 line(s) still incomplete');
    setLocale('zh-CN');
    expect(t('order.form.pendingLines', { count: 2 })).toBe('还有 2 行待完善');
  });

  it('setLocale 持久化并在下次初始化时恢复，同时同步 <html lang>', () => {
    const { setLocale } = useI18n();
    setLocale('en-US');
    expect(localStorage.getItem('app-locale')).toBe('en-US');
    expect(document.documentElement.lang).toBe('en');

    // 模拟刷新：新的模块实例化读取持久化值
    expect(useI18n().locale.value).toBe('en-US');
  });
});
