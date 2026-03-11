import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Modal from '../Modal.vue';

vi.mock('@/composables/useModalStack', () => ({
  useModalStack: () => ({
    generateModalId: () => 'modal-test',
    register: vi.fn(),
    unregister: vi.fn(),
    shouldShowBlur: vi.fn(() => true),
    isTopModal: vi.fn(() => true),
    getZIndex: vi.fn(() => 1000),
  }),
}));

describe('Modal design contract', () => {
  it('provides an accessible label for the close button', () => {
    const wrapper = mount(Modal, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: 'Example modal',
      },
      slots: {
        default: '<div>Body</div>',
      },
      global: {
        stubs: {
          Teleport: {
            template: '<div><slot /></div>',
          },
        },
      },
    });

    const closeButton = wrapper.get('button');
    expect(closeButton.attributes('aria-label')).toBeTruthy();
  });
});
