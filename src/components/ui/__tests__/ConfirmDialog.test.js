import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import ConfirmDialog from '../ConfirmDialog.vue';

const openModals = [];
const stackSpies = {
  register: vi.fn(),
  unregister: vi.fn(),
};

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useModalStack', () => ({
  useModalStack: () => ({
    generateModalId: () => `confirm-${openModals.length + 1}`,
    register: vi.fn((id) => {
      stackSpies.register(id);
      if (!openModals.includes(id)) openModals.push(id);
    }),
    unregister: vi.fn((id) => {
      stackSpies.unregister(id);
      const index = openModals.indexOf(id);
      if (index >= 0) openModals.splice(index, 1);
    }),
    getZIndex: vi.fn((id) => 1000 + Math.max(openModals.indexOf(id), 0) * 10),
    isTopModal: vi.fn((id) => openModals.at(-1) === id),
  }),
}));

const AppButtonStub = defineComponent({
  props: ['variant', 'text', 'disabled', 'loading'],
  emits: ['click'],
  template:
    '<button :data-variant="variant" :disabled="disabled || loading" @click="$emit(\'click\')">{{ text }}</button>',
});

const AppInputStub = defineComponent({
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue', 'keyup'],
  methods: {
    focus() {
      this.$el?.focus?.();
    },
  },
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup="$emit(\'keyup\', $event)" />',
});

function mountDialog(props = {}) {
  return mount(ConfirmDialog, {
    attachTo: document.body,
    props: {
      modelValue: true,
      title: 'Delete',
      message: 'Confirm removal',
      ...props,
    },
    global: {
      stubs: {
        Teleport: {
          template: '<div><slot /></div>',
        },
        AppButton: AppButtonStub,
        AppInput: AppInputStub,
        AppIcon: true,
      },
    },
  });
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    openModals.splice(0, openModals.length);
    stackSpies.register.mockClear();
    stackSpies.unregister.mockClear();
  });

  afterEach(() => {
    openModals.splice(0, openModals.length);
  });

  it('registers with the modal stack and unregisters when closed', async () => {
    const wrapper = mountDialog();

    expect(stackSpies.register).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.backdrop-blur-sm').exists()).toBe(true);

    await wrapper.setProps({ modelValue: false });
    await nextTick();

    expect(stackSpies.unregister).toHaveBeenCalledTimes(1);
  });

  it('emits cancel and update when clicking the backdrop or pressing escape', async () => {
    const wrapper = mountDialog();

    await wrapper.get('.fixed').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);

    await wrapper.setProps({ modelValue: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(wrapper.emitted('cancel')).toHaveLength(2);
  });

  it('does not cancel while loading and blocks confirm until verification passes', async () => {
    const wrapper = mountDialog({
      showInput: true,
      inputRequired: true,
      verifyText: 'DELETE',
      loading: true,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('cancel')).toBeUndefined();

    const buttons = wrapper.findAll('button');
    expect(buttons.at(-1)?.attributes('disabled')).toBeDefined();

    await wrapper.setProps({ loading: false });
    const input = wrapper.get('input');
    await input.setValue('DELETE');

    expect(wrapper.findAll('button').at(-1)?.attributes('disabled')).toBeUndefined();
  });

  it('emits confirm with the input value and uses type-specific button variants', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
    const wrapper = mountDialog({
      type: 'warning',
      showInput: true,
      inputLabel: 'Type DELETE',
      confirmText: 'Proceed',
    });

    await nextTick();
    await nextTick();
    expect(focusSpy).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Type DELETE');

    const input = wrapper.get('input');
    await input.setValue('approved');
    await wrapper.findAll('button').at(-1)?.trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual(['approved']);
    expect(wrapper.findAll('button').at(-1)?.attributes('data-variant')).toBe('outline');

    focusSpy.mockRestore();
  });

  it('falls back to primary variants for unknown types', () => {
    const wrapper = mountDialog({ type: 'custom-tone' });
    expect(wrapper.findAll('button').at(-1)?.attributes('data-variant')).toBe('primary');
  });
});
