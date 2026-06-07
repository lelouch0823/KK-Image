import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAsyncState, useAsyncStateWithRace } from '../useAsyncState';
import { ErrorCode } from '@/utils/error-codes';

describe('useAsyncState', () => {
  let state;

  beforeEach(() => {
    state = useAsyncState();
  });

  describe('初始状态', () => {
    it('loading 应为 false', () => {
      expect(state.loading.value).toBe(false);
    });

    it('error 应为 null', () => {
      expect(state.error.value).toBe(null);
    });

    it('errorCode 应为 null', () => {
      expect(state.errorCode.value).toBe(null);
    });
  });

  describe('execute() 成功', () => {
    it('loading 应先 true 后 false', async () => {
      await state.execute(() => Promise.resolve('数据'));
      expect(state.loading.value).toBe(false);
    });

    it('应调用 onSuccess 回调并传入结果', async () => {
      const onSuccess = vi.fn();
      const result = await state.execute(() => Promise.resolve({ id: 1 }), { onSuccess });

      expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({ id: 1 });
    });

    it('成功时不应设置 error', async () => {
      await state.execute(() => Promise.resolve('ok'));
      expect(state.error.value).toBe(null);
      expect(state.errorCode.value).toBe(null);
    });
  });

  describe('execute() 失败', () => {
    it('应设置 error 和 errorCode', async () => {
      const error = new Error('服务器错误');
      error.status = 500;

      await state.execute(() => Promise.reject(error));

      expect(state.errorCode.value).toBe(ErrorCode.SERVER_ERROR);
      expect(state.error.value).toBe('服务器错误');
      expect(state.loading.value).toBe(false);
    });

    it('应调用 onError 回调', async () => {
      const onError = vi.fn();
      const error = new Error('网络异常');

      await state.execute(() => Promise.reject(error), { onError });

      expect(onError).toHaveBeenCalledWith({
        code: ErrorCode.NETWORK_ERROR,
        message: '网络异常',
      });
    });

    it('失败时应返回 undefined', async () => {
      const error = new Error('失败');
      const result = await state.execute(() => Promise.reject(error));
      expect(result).toBeUndefined();
    });
  });

  describe('execute() AbortError', () => {
    it('AbortError 应静默处理，不设置 error', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const result = await state.execute(() => Promise.reject(abortError));

      expect(result).toBeUndefined();
      expect(state.error.value).toBe(null);
      expect(state.errorCode.value).toBe(null);
      expect(state.loading.value).toBe(false);
    });
  });

  describe('execute() shouldAbort', () => {
    it('shouldAbort 返回 true 时应跳过 onSuccess', async () => {
      const onSuccess = vi.fn();
      const shouldAbort = vi.fn().mockReturnValue(true);

      const result = await state.execute(() => Promise.resolve('数据'), { onSuccess, shouldAbort });

      expect(result).toBeUndefined();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('shouldAbort 在 catch 中也应生效', async () => {
      const onError = vi.fn();
      const shouldAbort = vi.fn().mockReturnValue(true);
      const error = new Error('失败');

      const result = await state.execute(() => Promise.reject(error), { onError, shouldAbort });

      expect(result).toBeUndefined();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('clearError()', () => {
    it('应清除 error 和 errorCode', async () => {
      const error = new Error('错误');
      error.status = 500;
      await state.execute(() => Promise.reject(error));

      expect(state.error.value).not.toBe(null);
      expect(state.errorCode.value).not.toBe(null);

      state.clearError();

      expect(state.error.value).toBe(null);
      expect(state.errorCode.value).toBe(null);
    });
  });

  describe('reset()', () => {
    it('应重置所有状态', async () => {
      await state.execute(() => Promise.reject(new Error('错误')));

      state.reset();

      expect(state.loading.value).toBe(false);
      expect(state.error.value).toBe(null);
      expect(state.errorCode.value).toBe(null);
    });
  });

  describe('silent 模式', () => {
    it('silent=true 时不应弹 toast', async () => {
      const addToast = vi.fn();
      const s = useAsyncState({ addToast, showToast: true });
      const error = new Error('网络错误');

      await s.execute(() => Promise.reject(error), { silent: true });

      expect(addToast).not.toHaveBeenCalled();
    });
  });
});

describe('useAsyncStateWithRace', () => {
  it('竞态保护：旧请求结果应被丢弃', async () => {
    const state = useAsyncStateWithRace();

    // 第一个请求（慢）
    const promise1 = state.execute(
      () => new Promise((resolve) => setTimeout(() => resolve('结果1'), 100))
    );

    // 第二个请求（快）
    const promise2 = state.execute(() => Promise.resolve('结果2'));

    const [r1, r2] = await Promise.all([promise1, promise2]);

    // 第一个请求的结果应被丢弃（返回 undefined）
    expect(r1).toBeUndefined();
    // 第二个请求的结果应正常返回
    expect(r2).toBe('结果2');
  });

  it('应暴露 requestId 方法', () => {
    const state = useAsyncStateWithRace();
    expect(typeof state.requestId).toBe('function');
    expect(state.requestId()).toBe(0);
  });

  it('每次 execute 后 requestId 应递增', async () => {
    const state = useAsyncStateWithRace();

    await state.execute(() => Promise.resolve('a'));
    expect(state.requestId()).toBe(1);

    await state.execute(() => Promise.resolve('b'));
    expect(state.requestId()).toBe(2);
  });

  it('应继承 useAsyncState 的所有状态和方法', () => {
    const state = useAsyncStateWithRace();

    expect(state.loading).toBeDefined();
    expect(state.error).toBeDefined();
    expect(state.errorCode).toBeDefined();
    expect(typeof state.clearError).toBe('function');
    expect(typeof state.reset).toBe('function');
    expect(typeof state.execute).toBe('function');
    expect(typeof state.setError).toBe('function');
  });
});
