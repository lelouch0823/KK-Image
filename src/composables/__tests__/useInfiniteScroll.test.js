import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInfiniteScroll } from '../useInfiniteScroll';

const observerRecords = [];

class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    observerRecords.push(this);
  }
}

function mountComposable(loadMoreFn = vi.fn(async () => undefined), options = {}) {
  const Host = defineComponent({
    setup() {
      return useInfiniteScroll(loadMoreFn, options);
    },
    template: '<div><div ref="triggerRef"></div></div>',
  });

  const wrapper = mount(Host);
  return { wrapper, loadMoreFn, observer: observerRecords.at(-1) };
}

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observerRecords.length = 0;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates an observer on mount and reacts to trigger element changes', async () => {
    const { wrapper, observer } = mountComposable(vi.fn(async () => undefined), {
      threshold: 0.5,
      rootMargin: '40px',
    });

    expect(observer.options).toEqual({ threshold: 0.5, rootMargin: '40px' });
    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.observe.mock.calls[0]?.[0]).toBeInstanceOf(HTMLElement);
    expect(wrapper.vm.canLoadMore).toBe(true);
  });

  it('debounces observer-triggered loading and supports manual loadMore', async () => {
    const loadMoreFn = vi.fn(async () => undefined);
    const { wrapper, observer } = mountComposable(loadMoreFn, { debounceMs: 25 });

    observer.callback([{ isIntersecting: true }]);
    observer.callback([{ isIntersecting: true }]);
    expect(loadMoreFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(25);
    expect(loadMoreFn).toHaveBeenCalledTimes(1);

    wrapper.vm.loadMore();
    await nextTick();
    expect(loadMoreFn).toHaveBeenCalledTimes(2);
  });

  it('pauses, resumes, and resets scrolling state', async () => {
    const failing = vi.fn(async () => {
      throw new Error('load failed');
    });
    const { wrapper, observer } = mountComposable(failing, {
      debounceMs: 10,
      retryCount: 0,
    });

    wrapper.vm.pause();
    observer.callback([{ isIntersecting: true }]);
    await vi.advanceTimersByTimeAsync(10);
    expect(failing).not.toHaveBeenCalled();

    wrapper.vm.resume();
    observer.callback([{ isIntersecting: true }]);
    await vi.advanceTimersByTimeAsync(10);
    await nextTick();

    expect(failing).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.error).toEqual(expect.any(Error));

    wrapper.vm.setCanLoadMore(false);
    wrapper.vm.loadMore();
    expect(failing).toHaveBeenCalledTimes(1);

    wrapper.vm.reset();
    expect(wrapper.vm.canLoadMore).toBe(true);
    expect(wrapper.vm.isPaused).toBe(false);
    expect(wrapper.vm.error).toBeNull();
  });

  it('retries failed loads with backoff until success', async () => {
    const loadMoreFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce(undefined);
    const { wrapper, observer } = mountComposable(loadMoreFn, {
      debounceMs: 10,
      retryCount: 1,
      retryDelay: 20,
    });

    observer.callback([{ isIntersecting: true }]);
    await vi.advanceTimersByTimeAsync(10);
    expect(loadMoreFn).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.error).toEqual(expect.any(Error));

    await vi.advanceTimersByTimeAsync(20);
    await nextTick();
    expect(loadMoreFn).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.isLoading).toBe(false);
  });

  it('disconnects observer and clears pending debounce timers on unmount', async () => {
    const loadMoreFn = vi.fn(async () => undefined);
    const { wrapper, observer } = mountComposable(loadMoreFn, { debounceMs: 50 });

    observer.callback([{ isIntersecting: true }]);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(50);

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(loadMoreFn).not.toHaveBeenCalled();
  });
});
