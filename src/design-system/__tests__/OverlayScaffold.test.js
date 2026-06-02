import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OverlayScaffold from '../composed/OverlayScaffold.vue';

const openModals = [];

vi.mock('@/composables/useModalStack', () => ({
  useModalStack: () => ({
    generateModalId: () => 'overlay-scaffold-test',
    register: vi.fn((id) => {
      if (!openModals.includes(id)) openModals.push(id);
    }),
    unregister: vi.fn((id) => {
      const index = openModals.indexOf(id);
      if (index > -1) openModals.splice(index, 1);
    }),
    shouldShowBlur: vi.fn(() => true),
    isTopModal: vi.fn(() => true),
    getZIndex: vi.fn(() => 1000),
    hasOpenModals: {
      get value() {
        return openModals.length > 0;
      },
    },
  }),
}));

describe('OverlayScaffold', () => {
  it('renders a shared overlay scaffold inside Modal with stable header/body/footer regions', () => {
    const wrapper = mount(OverlayScaffold, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: '采购建议',
        description: '先看摘要，再决定是否执行。',
        eyebrow: '采购工作台',
      },
      slots: {
        default: '<div data-testid="overlay-body-content">Body</div>',
        footer: '<button>Confirm</button>',
      },
      global: {
        stubs: {
          Teleport: {
            template: '<div><slot /></div>',
          },
        },
      },
    });

    expect(wrapper.get('[data-modal-surface="overlay-scaffold-test"]').exists()).toBe(true);
    expect(wrapper.get('[data-overlay-scaffold]').attributes('data-overlay-layout')).toBe('dialog');
    const dialog = wrapper.get('[role="dialog"]');
    const title = wrapper.get('[data-overlay-header] h2');
    expect(dialog.attributes('aria-labelledby')).toBe(title.attributes('id'));
    expect(wrapper.get('[data-overlay-header]').text()).toContain('采购建议');
    expect(wrapper.get('[data-overlay-body]').text()).toContain('Body');
    expect(wrapper.get('[data-overlay-footer]').text()).toContain('Confirm');
  });
});
