import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppInput from '../AppInput.vue';

describe('AppInput 实时验证', () => {
  describe('validation prop', () => {
    it('blur 时触发验证并显示错误', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');

      // blur 前不显示错误
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);

      // 触发 blur
      await input.trigger('blur');

      // 显示错误
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      expect(wrapper.find('[role="alert"]').text()).toBe('不能为空');
    });

    it('有效输入时显示成功状态', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: 'test',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      // 应该有成功图标（绿色勾）
      expect(wrapper.find('.text-success').exists()).toBe(true);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });

    it('无效输入时显示错误样式', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      // 应该有错误图标
      expect(wrapper.find('.text-danger').exists()).toBe(true);
      // 输入框应有错误边框样式
      expect(input.classes()).toContain('border-danger');
    });

    it('validateOnChange 时输入即验证', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (String(v).length < 3 ? '至少3个字符' : null),
          validateOnChange: true,
          debounceMs: 0, // 测试时禁用防抖
        },
      });

      // 先触发 blur 以启用验证
      const input = wrapper.get('input');
      await input.trigger('blur');

      // 使用 setValue 模拟输入
      await input.setValue('abc');

      // 等待防抖
      await new Promise((r) => setTimeout(r, 10));
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });

  describe('error prop 优先级', () => {
    it('外部 error 优先于 validation', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: 'valid',
          error: '外部错误',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      expect(wrapper.find('[role="alert"]').text()).toBe('外部错误');
    });
  });

  describe('validation-change 事件', () => {
    it('验证后触发 validation-change 事件', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      expect(wrapper.emitted('validation-change')).toBeTruthy();
      expect(wrapper.emitted('validation-change')[0][0]).toEqual({
        valid: false,
        error: '不能为空',
      });
    });

    it('有效值时触发正确的事件数据', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: 'test',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      expect(wrapper.emitted('validation-change')).toBeTruthy();
      expect(wrapper.emitted('validation-change')[0][0]).toEqual({
        valid: true,
        error: null,
      });
    });
  });

  describe('暴露方法', () => {
    it('validate 方法手动触发验证', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const result = wrapper.vm.validate();
      await wrapper.vm.$nextTick();
      expect(result).toBe(false);
      expect(wrapper.find('[role="alert"]').text()).toBe('不能为空');
    });

    it('resetValidation 重置验证状态', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      // 先验证
      const input = wrapper.get('input');
      await input.trigger('blur');
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);

      // 重置
      wrapper.vm.resetValidation();
      await wrapper.vm.$nextTick();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    });
  });

  describe('无障碍访问', () => {
    it('错误时设置 aria-invalid="true"', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      expect(input.attributes('aria-invalid')).toBe('true');
    });

    it('无错误时设置 aria-invalid="false"', () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: 'valid',
          validation: (v) => (!v ? '不能为空' : null),
        },
      });

      const input = wrapper.get('input');
      expect(input.attributes('aria-invalid')).toBe('false');
    });
  });

  describe('向后兼容', () => {
    it('无 validation prop 时行为不变', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: '',
          error: '外部错误',
        },
      });

      expect(wrapper.find('[role="alert"]').text()).toBe('外部错误');
      expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    });

    it('blur 事件仍然正常触发', async () => {
      const wrapper = mount(AppInput, {
        props: {
          modelValue: 'test',
        },
      });

      const input = wrapper.get('input');
      await input.trigger('blur');

      expect(wrapper.emitted('blur')).toBeTruthy();
    });
  });
});
