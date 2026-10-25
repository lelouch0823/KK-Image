import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useLightbox } from '../useLightbox';

function mountHarness(files, options = {}) {
  let api;
  const Harness = defineComponent({
    setup() {
      api = useLightbox(files, options);
      return () => null;
    },
  });

  const wrapper = mount(Harness);
  return { wrapper, api };
}

// 键盘交互（Esc/←/→）与 body 滚动锁已统一由 Lightbox 组件负责（经弹窗栈引用计数管理），
// composable 只维护打开状态与当前文件，避免与组件内的 document 监听重复触发。

describe('useLightbox', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  it('opens and closes the lightbox while firing callbacks', () => {
    const files = ref([
      { id: '1', url: '/a.jpg', name: 'a.jpg' },
      { id: '2', url: '/b.jpg', name: 'b.jpg' },
    ]);
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { api } = mountHarness(files, { onOpen, onClose });

    api.open(files.value[1], 1);

    expect(api.visible.value).toBe(true);
    expect(api.currentIndex.value).toBe(1);
    expect(api.currentFile.value).toEqual(files.value[1]);
    expect(onOpen).toHaveBeenCalledWith(files.value[1], 1);

    api.close();

    expect(api.visible.value).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates with prev next goTo and derived state', () => {
    const files = ref([
      { id: '1', url: '/a.jpg', name: 'a.jpg' },
      { id: '2', url: '/b.jpg', name: 'b.jpg' },
      { id: '3', url: '/c.jpg', name: 'c.jpg' },
    ]);
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const { api } = mountHarness(files, { onPrev, onNext });

    api.open(files.value[1], 1);

    expect(api.hasPrev.value).toBe(true);
    expect(api.hasNext.value).toBe(true);
    expect(api.total.value).toBe(3);

    api.prev();
    expect(api.currentIndex.value).toBe(0);
    expect(api.currentFile.value).toEqual(files.value[0]);
    expect(onPrev).toHaveBeenCalledWith(files.value[0], 0);

    api.next();
    expect(api.currentIndex.value).toBe(1);
    expect(api.currentFile.value).toEqual(files.value[1]);
    expect(onNext).toHaveBeenCalledWith(files.value[1], 1);

    api.goTo(2);
    expect(api.currentIndex.value).toBe(2);
    expect(api.currentFile.value).toEqual(files.value[2]);

    api.goTo(99);
    expect(api.currentIndex.value).toBe(2);
  });

  it('does not register duplicate document listeners or touch body scroll', () => {
    const files = ref([
      { id: '1', url: '/a.jpg', name: 'a.jpg' },
      { id: '2', url: '/b.jpg', name: 'b.jpg' },
    ]);
    const { api } = mountHarness(files);

    // 滚动锁由 Lightbox 组件（弹窗栈）管理，composable 不直接操作 overflow
    api.open(files.value[0], 0);
    expect(api.visible.value).toBe(true);

    // composable 不再监听 document 键盘事件（由 Lightbox 组件统一处理），
    // 因此这里的按键不应被消费
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(api.currentIndex.value).toBe(0);

    api.close();
    expect(api.visible.value).toBe(false);
  });

  it('downloads files through a temporary anchor and cleans up on unmount', () => {
    const files = ref([{ id: '1', url: '/a.jpg', name: 'a.jpg' }]);
    const click = vi.fn();
    const anchor = { href: '', download: '', click };
    const { api, wrapper } = mountHarness(files);
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor);

    api.open(files.value[0], 0);
    api.download(files.value[0]);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('/a.jpg');
    expect(anchor.download).toBe('a.jpg');
    expect(click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    wrapper.unmount();
  });
});
