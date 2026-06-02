import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { z } from 'zod';
import { useFormValidation, useFieldValidation } from '../useFormValidation';

// 模拟 useI18n
vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

describe('useFormValidation', () => {
  describe('基础功能', () => {
    it('返回正确的初始状态', () => {
      const { errors, touched, isValid, hasErrors } = useFormValidation();

      expect(Object.keys(errors)).toHaveLength(0);
      expect(isValid.value).toBe(true);
      expect(hasErrors.value).toBe(false);
    });

    it('validateField 使用自定义规则验证', () => {
      const { validateField, errors } = useFormValidation({
        rules: {
          name: (v) => (!v ? '名称不能为空' : null),
        },
      });

      // 空值应返回错误
      const result1 = validateField('name', '');
      expect(result1).toBe(false);
      expect(errors.name).toBe('名称不能为空');

      // 有效值应通过
      const result2 = validateField('name', '测试');
      expect(result2).toBe(true);
      expect(errors.name).toBeNull();
    });

    it('validateField 使用 Zod schema 验证', () => {
      const schema = z.object({
        email: z.string().email('请输入有效的邮箱'),
      });

      const { validateField, errors } = useFormValidation({ schema });

      // 无效邮箱
      const result1 = validateField('email', 'not-email');
      expect(result1).toBe(false);
      expect(errors.email).toBeTruthy();

      // 有效邮箱
      const result2 = validateField('email', 'test@example.com');
      expect(result2).toBe(true);
      expect(errors.email).toBeNull();
    });

    it('自定义规则优先于 schema 验证', () => {
      const schema = z.object({
        name: z.string().min(1),
      });

      const { validateField, errors } = useFormValidation({
        schema,
        rules: {
          name: (v) => (!v ? '自定义错误' : null),
        },
      });

      validateField('name', '');
      expect(errors.name).toBe('自定义错误');
    });
  });

  describe('validateAll', () => {
    it('验证所有字段并返回正确结果', () => {
      const { validateAll, errors } = useFormValidation({
        rules: {
          name: (v) => (!v ? '名称必填' : null),
          email: (v) => (!v ? '邮箱必填' : null),
        },
      });

      const result = validateAll({ name: '', email: '' });
      expect(result).toBe(false);
      expect(errors.name).toBe('名称必填');
      expect(errors.email).toBe('邮箱必填');
    });

    it('所有字段有效时返回 true', () => {
      const { validateAll, errors } = useFormValidation({
        rules: {
          name: (v) => (!v ? '名称必填' : null),
        },
      });

      const result = validateAll({ name: '测试' });
      expect(result).toBe(true);
      expect(errors.name).toBeNull();
    });

    it('使用整体 schema 验证', () => {
      const schema = z.object({
        name: z.string().min(1, '名称必填'),
        quantity: z.number().min(1, '数量至少为1'),
      });

      const { validateAll, errors } = useFormValidation({ schema });

      const result = validateAll({ name: '', quantity: 0 });
      expect(result).toBe(false);
    });
  });

  describe('touch 和 reset', () => {
    it('touch 标记字段为已触碰', () => {
      const { touch, touched } = useFormValidation();

      touch('name');
      expect(touched.name).toBe(true);
    });

    it('reset 重置所有状态', () => {
      const { validateField, touch, reset, errors, touched } = useFormValidation({
        rules: {
          name: (v) => (!v ? '错误' : null),
        },
      });

      validateField('name', '');
      touch('name');
      expect(errors.name).toBe('错误');
      expect(touched.name).toBe(true);

      reset();
      expect(errors.name).toBeNull();
      expect(touched.name).toBe(false);
    });
  });

  describe('setFieldError', () => {
    it('设置外部错误', () => {
      const { setFieldError, errors, touched } = useFormValidation();

      setFieldError('name', '服务端错误');
      expect(errors.name).toBe('服务端错误');
      expect(touched.name).toBe(true);
    });

    it('清除外部错误', () => {
      const { setFieldError, errors } = useFormValidation();

      setFieldError('name', '错误');
      setFieldError('name', null);
      expect(errors.name).toBeNull();
    });
  });

  describe('getFieldBindings', () => {
    it('返回 error 和 onBlur', () => {
      const { getFieldBindings } = useFormValidation();

      const bindings = getFieldBindings('name');
      expect(bindings).toHaveProperty('error');
      expect(bindings).toHaveProperty('onBlur');
      expect(typeof bindings.onBlur).toBe('function');
    });

    it('onBlur 触发验证', () => {
      const { getFieldBindings, errors, touched } = useFormValidation({
        rules: {
          name: (v) => (!v ? '不能为空' : null),
        },
      });

      const bindings = getFieldBindings('name');
      bindings.onBlur();

      expect(touched.name).toBe(true);
    });
  });

  describe('Zod 错误消息格式化', () => {
    it('正确格式化 too_small 错误', () => {
      const schema = z.object({
        name: z.string().min(1, '名称必填'),
      });

      const { validateField, errors } = useFormValidation({ schema });
      validateField('name', '');

      expect(errors.name).toBeTruthy();
      expect(typeof errors.name).toBe('string');
    });

    it('正确格式化 too_big 错误', () => {
      const schema = z.object({
        name: z.string().max(5),
      });

      const { validateField, errors } = useFormValidation({ schema });
      validateField('name', '这是一个超过五个字符的字符串');

      expect(errors.name).toBeTruthy();
    });

    it('正确格式化 invalid_type 错误', () => {
      const schema = z.object({
        age: z.number(),
      });

      const { validateField, errors } = useFormValidation({ schema });
      validateField('age', '不是数字');

      expect(errors.age).toBeTruthy();
    });
  });
});

describe('useFieldValidation', () => {
  it('返回 error、onBlur 和 onInput', () => {
    const field = useFieldValidation((v) => (!v ? '错误' : null));

    expect(field).toHaveProperty('error');
    expect(field).toHaveProperty('onBlur');
    expect(field).toHaveProperty('onInput');
  });

  it('onBlur 后 onInput 开始验证', () => {
    const field = useFieldValidation((v) => (!v ? '不能为空' : null));

    // 未 touch 时不验证
    field.onInput('');
    expect(field.error).toBeNull();

    // touch 后验证
    field.onBlur();
    field.onInput('');
    expect(field.error).toBe('不能为空');
  });

  it('debounce 模式下延迟验证', async () => {
    vi.useFakeTimers();

    const field = useFieldValidation((v) => (String(v).length < 3 ? '太短' : null), {
      debounce: true,
      debounceMs: 300,
    });

    field.onBlur();

    // 快速输入
    field.onInput('a');
    expect(field.error).toBeNull();

    // 等待防抖
    vi.advanceTimersByTime(300);
    expect(field.error).toBe('太短');

    // 有效值
    field.onInput('abc');
    vi.advanceTimersByTime(300);
    expect(field.error).toBeNull();

    vi.useRealTimers();
  });
});
