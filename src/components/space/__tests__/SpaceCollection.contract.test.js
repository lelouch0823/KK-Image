import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SpaceCollection from '../SpaceCollection.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('SpaceCollection contract', () => {
  it('supports authenticated sales subspace links and coverUrl fallback', () => {
    const wrapper = mount(SpaceCollection, {
      props: {
        space: {
          id: 'space-parent-1',
          name: '合集空间',
          description: '',
          subspaces: [
            {
              id: 'sub-1',
              name: '子空间 1',
              fileCount: 3,
              coverUrl: '/file/sub-1.jpg',
            },
          ],
        },
        getSubspaceHref: (subspace) => `/sales/token-1/spaces/${subspace.id}`,
      },
      global: {
        stubs: {
          AppImage: {
            props: ['src'],
            template: '<img data-testid="sub-cover" :src="src" />',
          },
          AppIcon: true,
        },
      },
    });

    expect(wrapper.get('a').attributes('href')).toBe('/sales/token-1/spaces/sub-1');
    expect(wrapper.get('[data-testid="sub-cover"]').attributes('src')).toBe('/file/sub-1.jpg');
  });
});
