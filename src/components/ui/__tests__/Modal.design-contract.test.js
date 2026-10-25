import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Modal from '../Modal.vue';

const openModals = [];

vi.mock('@/composables/useModalStack', () => ({
  useModalStack: () => ({
    generateModalId: () => `modal-test-${openModals.length + 1}`,
    register: vi.fn((id) => {
      if (!openModals.includes(id)) openModals.push(id);
    }),
    unregister: vi.fn((id) => {
      const index = openModals.indexOf(id);
      if (index > -1) openModals.splice(index, 1);
    }),
    shouldShowBlur: vi.fn((id) => openModals.at(-1) === id),
    isTopModal: vi.fn((id) => openModals.at(-1) === id),
    getZIndex: vi.fn((id) => {
      const index = openModals.indexOf(id);
      return 1000 + Math.max(index, 0) * 10;
    }),
    hasOpenModals: {
      get value() {
        return openModals.length > 0;
      },
    },
  }),
}));

describe('Modal design contract', () => {
  beforeEach(() => {
    openModals.splice(0, openModals.length);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    openModals.splice(0, openModals.length);
    document.body.style.overflow = '';
  });

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
    expect(wrapper.get('[data-modal-surface="modal-test-1"]').exists()).toBe(true);
  });

  it('keeps body scroll locked while another stacked modal remains open', async () => {
    const first = mount(Modal, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: 'First modal',
      },
      slots: {
        default: '<div>First</div>',
      },
      global: {
        stubs: {
          Teleport: {
            template: '<div><slot /></div>',
          },
        },
      },
    });

    const second = mount(Modal, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: 'Second modal',
      },
      slots: {
        default: '<div>Second</div>',
      },
      global: {
        stubs: {
          Teleport: {
            template: '<div><slot /></div>',
          },
        },
      },
    });

    expect(document.body.style.overflow).toBe('hidden');

    await second.setProps({ modelValue: false });
    await nextTick();

    expect(document.body.style.overflow).toBe('hidden');

    first.unmount();
    second.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('ignores Escape already consumed by an inner overlay (defaultPrevented)', async () => {
    const wrapper = mount(Modal, {
      attachTo: document.body,
      props: { modelValue: true, title: 'Form modal' },
      slots: { default: '<div>Body</div>' },
      global: {
        stubs: { Teleport: { template: '<div><slot /></div>' } },
      },
    });
    const emitted = () => wrapper.emitted('update:modelValue');

    // 内层浮层（如 Select 下拉）已 preventDefault 的 Esc 不应关闭 Modal
    const consumed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    consumed.preventDefault();
    document.dispatchEvent(consumed);
    await nextTick();
    expect(emitted()).toBeUndefined();

    // 未消费的 Esc 正常关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await nextTick();
    expect(emitted()).toBeTruthy();
    expect(emitted()[0]).toEqual([false]);

    wrapper.unmount();
  });
});
