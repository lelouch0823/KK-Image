import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';

describe('useModalStack', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // 清空全局 openModals 状态
    const { useModalStack } = await import('../useModalStack');
    const stack = useModalStack();
    // 通过 unregister 清空全局状态
    void stack;
  });

  async function getCleanStack() {
    // 每次调用都获取新的引用，但由于是全局状态，需要手动清理
    const { useModalStack } = await import('../useModalStack');
    return useModalStack();
  }

  async function cleanGlobalState() {
    const { useModalStack } = await import('../useModalStack');
    const stack = useModalStack();
    // 尝试清理所有可能残留的 modal
    for (const id of [
      'modal-1', 'modal-2', 'modal-3', 'modal-a', 'modal-b',
      'modal-x', 'modal-y', 'unknown',
    ]) {
      stack.unregister(id);
    }
    await nextTick();
  }

  it('应导出所有预期的方法和属性', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    expect(stack.register).toBeInstanceOf(Function);
    expect(stack.unregister).toBeInstanceOf(Function);
    expect(stack.isTopModal).toBeInstanceOf(Function);
    expect(stack.shouldShowBlur).toBeInstanceOf(Function);
    expect(stack.getZIndex).toBeInstanceOf(Function);
    expect(stack.getStackIndex).toBeInstanceOf(Function);
    expect(stack.generateModalId).toBeInstanceOf(Function);
    expect(stack.modalCount).toBeDefined();
    expect(stack.hasOpenModals).toBeDefined();
  });

  it('register 应将 Modal 添加到栈中', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    stack.register('modal-a');
    await nextTick();

    expect(stack.hasOpenModals.value).toBe(true);
    expect(stack.modalCount.value).toBe(1);
    expect(stack.getStackIndex('modal-a')).toBe(0);
  });

  it('register 重复 ID 不应重复添加', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    stack.register('modal-a');
    stack.register('modal-a');
    await nextTick();

    expect(stack.modalCount.value).toBe(1);
  });

  it('unregister 应从栈中移除 Modal', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    stack.register('modal-a');
    stack.register('modal-b');
    await nextTick();
    expect(stack.modalCount.value).toBe(2);

    stack.unregister('modal-a');
    await nextTick();
    expect(stack.modalCount.value).toBe(1);
    expect(stack.getStackIndex('modal-a')).toBe(-1);
  });

  it('unregister 不存在的 ID 不应报错', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    expect(() => stack.unregister('nonexistent')).not.toThrow();
  });

  it('getZIndex 应返回递增的 z-index 值', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    stack.register('modal-1');
    stack.register('modal-2');
    stack.register('modal-3');
    await nextTick();

    const z1 = stack.getZIndex('modal-1');
    const z2 = stack.getZIndex('modal-2');
    const z3 = stack.getZIndex('modal-3');

    expect(z1).toBeLessThan(z2);
    expect(z2).toBeLessThan(z3);
    // 每层递增 10
    expect(z2 - z1).toBe(10);
    expect(z3 - z2).toBe(10);
  });

  it('getZIndex 对未注册的 Modal 应返回下一个可用层级', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    // 当前栈为空，未注册的 Modal 应返回 BASE_Z_INDEX + 0 * STEP = 100
    const z = stack.getZIndex('unknown');
    expect(z).toBe(100 + 0 * 10);
  });

  it('isTopModal 应正确判断最顶层 Modal', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    stack.register('modal-1');
    stack.register('modal-2');
    await nextTick();

    expect(stack.isTopModal('modal-2')).toBe(true);
    expect(stack.isTopModal('modal-1')).toBe(false);
  });

  it('isTopModal 在空栈时应返回 false', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    expect(stack.isTopModal('any')).toBe(false);
  });

  it('shouldShowBlur 应与 isTopModal 行为一致', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    stack.register('modal-1');
    stack.register('modal-2');
    await nextTick();

    expect(stack.shouldShowBlur('modal-2')).toBe(true);
    expect(stack.shouldShowBlur('modal-1')).toBe(false);
  });

  it('hasOpenModals 在有 Modal 时应为 true', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    expect(stack.hasOpenModals.value).toBe(false);

    stack.register('modal-x');
    await nextTick();
    expect(stack.hasOpenModals.value).toBe(true);
  });

  it('generateModalId 应生成唯一 ID', async () => {
    await cleanGlobalState();
    const stack = await getCleanStack();
    const id1 = stack.generateModalId();
    const id2 = stack.generateModalId();

    expect(id1).toMatch(/^modal-/);
    expect(id2).toMatch(/^modal-/);
    expect(id1).not.toBe(id2);
  });
});
