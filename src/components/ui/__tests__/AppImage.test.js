import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppImage from '@/components/ui/AppImage.vue';

describe('AppImage', () => {
  it('switches to fallback src after primary load error', async () => {
    const wrapper = mount(AppImage, {
      props: {
        src: 'broken-image.jpg',
        fallback: 'fallback-image.jpg',
        lazy: false,
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    });

    const img = wrapper.get('img[alt=""]');
    expect(img.attributes('src')).toBe('broken-image.jpg');

    await img.trigger('error');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('img[alt=""]').attributes('src')).toBe('fallback-image.jpg');
  });

  it('sets native loading and decoding attributes for image element', async () => {
    const wrapper = mount(AppImage, {
      props: {
        src: '/file/img-1',
        lazy: true,
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    });

    await nextTick();
    const img = wrapper.get('img[alt=""]');
    expect(img.attributes('loading')).toBe('lazy');
    expect(img.attributes('decoding')).toBe('async');
  });
});
