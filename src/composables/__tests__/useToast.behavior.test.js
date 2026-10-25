import { describe, expect, it, beforeEach } from 'vitest';
import { useToast } from '../useToast';

describe('useToast 行为契约', () => {
  beforeEach(() => {
    const { toasts, removeToast } = useToast();
    toasts.value.forEach((t) => removeToast(t.id));
  });

  it('将遗留 danger 类型归一化为 error（保证图标与语义色命中）', () => {
    const { addToast, toasts } = useToast();
    addToast({ message: 'boom', type: 'danger' });
    expect(toasts.value[0].type).toBe('error');
  });

  it('未知类型归一化为 info', () => {
    const { addToast, toasts } = useToast();
    addToast({ message: '???', type: 'something-weird' });
    expect(toasts.value[0].type).toBe('info');
  });

  it('合法类型原样保留', () => {
    const { addToast, toasts } = useToast();
    addToast({ message: 'ok', type: 'warning' });
    expect(toasts.value[0].type).toBe('warning');
  });

  it('堆叠上限为 5 条，超出时丢弃最旧的', () => {
    const { addToast, toasts } = useToast();
    for (let i = 0; i < 8; i++) {
      addToast({ message: `m${i}`, type: 'success', duration: 0 });
    }
    expect(toasts.value).toHaveLength(5);
    expect(toasts.value[0].message).toBe('m3');
    expect(toasts.value[4].message).toBe('m7');
  });
});
