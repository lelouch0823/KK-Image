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
    expect(document.body.style.overflow).toBe('hidden');
    expect(onOpen).toHaveBeenCalledWith(files.value[1], 1);

    api.close();

    expect(api.visible.value).toBe(false);
    expect(document.body.style.overflow).toBe('');
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

  it('responds to keyboard and wheel events only when visible', () => {
    const files = ref([
      { id: '1', url: '/a.jpg', name: 'a.jpg' },
      { id: '2', url: '/b.jpg', name: 'b.jpg' },
    ]);
    const { api } = mountHarness(files);

    api.handleWheel({ deltaY: 100 });
    expect(api.currentIndex.value).toBe(0);

    api.open(files.value[0], 0);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(api.currentIndex.value).toBe(1);

    api.handleWheel({ deltaY: -100 });
    expect(api.currentIndex.value).toBe(0);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
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
    expect(document.body.style.overflow).toBe('');
  });
});
