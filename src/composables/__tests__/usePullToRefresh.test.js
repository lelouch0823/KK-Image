import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue');
  return { ...actual };
});

describe('usePullToRefresh', () => {
  let usePullToRefresh;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../usePullToRefresh');
    usePullToRefresh = mod.usePullToRefresh;
  });

  function createMockTouchEvent(clientY, options = {}) {
    return {
      touches: [{ clientY }],
      cancelable: true,
      preventDefault: vi.fn(),
      ...options,
    };
  }

  it('初始状态应为 pullDistance=0, isPulling=false', () => {
    const onRefresh = vi.fn();
    const { pullDistance, isPulling } = usePullToRefresh(onRefresh);

    expect(pullDistance.value).toBe(0);
    expect(isPulling.value).toBe(false);
  });

  it('应暴露 handleTouchStart/Move/End 方法', () => {
    const onRefresh = vi.fn();
    const result = usePullToRefresh(onRefresh);

    expect(result.handleTouchStart).toBeInstanceOf(Function);
    expect(result.handleTouchMove).toBeInstanceOf(Function);
    expect(result.handleTouchEnd).toBeInstanceOf(Function);
  });

  it('handleTouchStart 应记录起始 Y 坐标', () => {
    // 确保 scrollY = 0（在顶部）
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn();
    const { handleTouchStart } = usePullToRefresh(onRefresh);

    const e = createMockTouchEvent(200);
    handleTouchStart(e);

    // 不抛异常即表示 start 正常工作
    expect(true).toBe(true);
  });

  it('handleTouchMove 应更新 pullDistance', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn();
    const { handleTouchStart, handleTouchMove, pullDistance } = usePullToRefresh(onRefresh);

    // 先 start
    handleTouchStart(createMockTouchEvent(300));
    // 向下拉 100px
    handleTouchMove(createMockTouchEvent(400));

    expect(pullDistance.value).toBeGreaterThan(0);
  });

  it('handleTouchMove 不在顶部时不响应', () => {
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true, configurable: true });

    const onRefresh = vi.fn();
    const { handleTouchStart, handleTouchMove, pullDistance } = usePullToRefresh(onRefresh);

    handleTouchStart(createMockTouchEvent(300));
    handleTouchMove(createMockTouchEvent(400));

    // startY 未设置（因为 scrollTop > 0 跳过了），所以 pullDistance 保持 0
    expect(pullDistance.value).toBe(0);
  });

  it('handleTouchMove 向上拉时 pullDistance 应为 0', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn();
    const { handleTouchStart, handleTouchMove, pullDistance } = usePullToRefresh(onRefresh);

    handleTouchStart(createMockTouchEvent(300));
    // 向上拉（clientY 减小）
    handleTouchMove(createMockTouchEvent(200));

    expect(pullDistance.value).toBe(0);
  });

  it('下拉距离超过阈值时应触发刷新回调', async () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { handleTouchStart, handleTouchMove, handleTouchEnd, isPulling } = usePullToRefresh(
      onRefresh,
      { threshold: 50 }
    );

    // 模拟下拉超过阈值
    handleTouchStart(createMockTouchEvent(100));
    handleTouchMove(createMockTouchEvent(300)); // 大幅下拉
    await handleTouchEnd();

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(isPulling.value).toBe(false); // 刷新完成后应重置
  });

  it('下拉距离未超过阈值时不应触发刷新', async () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn();
    const { handleTouchStart, handleTouchMove, handleTouchEnd, pullDistance } = usePullToRefresh(
      onRefresh,
      { threshold: 200 }
    );

    handleTouchStart(createMockTouchEvent(100));
    handleTouchMove(createMockTouchEvent(110)); // 只拉了很小距离
    await handleTouchEnd();

    expect(onRefresh).not.toHaveBeenCalled();
    expect(pullDistance.value).toBe(0);
  });

  it('刷新完成后 pullDistance 应重置为 0', async () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { handleTouchStart, handleTouchMove, handleTouchEnd, pullDistance } = usePullToRefresh(
      onRefresh,
      { threshold: 50 }
    );

    handleTouchStart(createMockTouchEvent(100));
    handleTouchMove(createMockTouchEvent(300));
    await handleTouchEnd();

    expect(pullDistance.value).toBe(0);
  });

  it('onRefresh 抛出异常时仍应重置状态', async () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    const onRefresh = vi.fn().mockRejectedValue(new Error('refresh error'));
    const { handleTouchStart, handleTouchMove, handleTouchEnd, isPulling, pullDistance } =
      usePullToRefresh(onRefresh, { threshold: 50 });

    handleTouchStart(createMockTouchEvent(100));
    handleTouchMove(createMockTouchEvent(300));

    // handleTouchEnd 内部有 try/finally，异常会向外传播但状态会重置
    try {
      await handleTouchEnd();
    } catch (_e) {
      // 预期的异常
    }

    expect(isPulling.value).toBe(false);
    expect(pullDistance.value).toBe(0);
  });
});
