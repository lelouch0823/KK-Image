/**
 * 表单验证 Composable
 * 将后端 Zod Schema 复用为前端实时验证，支持 blur/change 触发
 *
 * @file src/composables/useFormValidation.ts
 */

import { reactive, computed, watch, onUnmounted, type ComputedRef, type UnwrapNestedRefs } from 'vue';
import { z, type ZodSchema, type ZodError, type ZodIssue } from 'zod';
import { useI18n } from '@/composables/useI18n';

/** 单字段验证函数类型 */
type FieldValidator = (value: unknown) => string | null;

/** 验证规则配置 */
interface ValidationRule {
  /** 验证函数，返回错误信息或 null */
  validate: FieldValidator;
  /** 触发时机，默认 'blur' */
  on?: 'blur' | 'change';
}

/** useFormValidation 选项 */
interface UseFormValidationOptions {
  /** Zod schema（整体验证） */
  schema?: ZodSchema;
  /** 字段级验证规则 */
  rules?: Record<string, ValidationRule | FieldValidator>;
  /** 验证防抖毫秒数（change 时），默认 300 */
  debounceMs?: number;
}

/** 字段验证状态 */
interface FieldState {
  /** 是否已触发过验证（blur 后为 true） */
  touched: boolean;
  /** 是否正在验证中 */
  validating: boolean;
  /** 错误信息（null 表示无错误） */
  error: string | null;
  /** 是否已修改 */
  dirty: boolean;
}

/** 返回类型 */
interface UseFormValidationReturn {
  /** 字段错误信息（响应式，用于绑定 AppInput 的 error prop） */
  errors: UnwrapNestedRefs<Record<string, string | null>>;
  /** 字段是否已触碰 */
  touched: UnwrapNestedRefs<Record<string, boolean>>;
  /** 整体是否有效 */
  isValid: ComputedRef<boolean>;
  /** 是否有任何错误 */
  hasErrors: ComputedRef<boolean>;
  /** 触发单字段验证（通常在 blur 时调用） */
  validateField: (field: string, value: unknown) => boolean;
  /** 触发所有字段验证（通常在 submit 时调用） */
  validateAll: (values: Record<string, unknown>) => boolean;
  /** 重置验证状态 */
  reset: () => void;
  /** 标记字段为已触碰 */
  touch: (field: string) => void;
  /** 设置字段外部错误（如服务端返回） */
  setFieldError: (field: string, error: string | null) => void;
  /** 获取字段绑定（error + blur handler） */
  getFieldBindings: (field: string) => {
    error: string | null;
    onBlur: () => void;
  };
}

/** 默认防抖时间 */
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * 表单验证 Composable
 *
 * @example
 * ```ts
 * const { errors, validateField, validateAll, getFieldBindings } = useFormValidation({
 *   schema: CreateAdminOrderSchema,
 *   rules: {
 *     name: (v) => !v ? '请输入商品名称' : null,
 *     quantity: (v) => v < 1 ? '数量至少为 1' : null,
 *   },
 * });
 *
 * // 在模板中绑定
 * <AppInput v-model="form.name" v-bind="getFieldBindings('name')" />
 * ```
 */
export function useFormValidation(options: UseFormValidationOptions = {}): UseFormValidationReturn {
  const { schema, rules = {}, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const { t } = useI18n();

  // 字段验证状态（响应式）
  const fieldStates = reactive<Record<string, FieldState>>({});

  // 错误信息（简化访问）
  const errors = reactive<Record<string, string | null>>({});

  // 已触碰状态
  const touched = reactive<Record<string, boolean>>({});

  // 防抖定时器
  const debounceTimers = reactive<Record<string, ReturnType<typeof setTimeout>>>({});

  // 初始化字段状态
  function ensureFieldState(field: string): void {
    if (!fieldStates[field]) {
      fieldStates[field] = {
        touched: false,
        validating: false,
        error: null,
        dirty: false,
      };
      errors[field] = null;
      touched[field] = false;
    }
  }

  /**
   * 将 Zod 错误转换为用户友好的中文消息
   */
  function formatZodError(zodError: ZodError): string {
    const issue = zodError.issues[0];
    if (!issue) return t('validation.error', '验证失败');
    return formatZodIssue(issue);
  }

  /**
   * 将单个 Zod issue 转换为中文
   */
  function formatZodIssue(issue: ZodIssue): string {
    const path = issue.path.join('.') || t('validation.thisField', '此字段');

    switch (issue.code) {
      case 'too_small':
        if (issue.type === 'string') {
          if (issue.minimum === 1) return t('validation.required', `${path}不能为空`);
          return t('validation.minLength', `${path}至少需要${issue.minimum}个字符`);
        }
        if (issue.type === 'number') {
          return t('validation.min', `${path}不能小于${issue.minimum}`);
        }
        if (issue.type === 'array') {
          return t('validation.minItems', `${path}至少需要${issue.minimum}项`);
        }
        break;
      case 'too_big':
        if (issue.type === 'string') {
          return t('validation.maxLength', `${path}不能超过${issue.maximum}个字符`);
        }
        if (issue.type === 'number') {
          return t('validation.max', `${path}不能大于${issue.maximum}`);
        }
        if (issue.type === 'array') {
          return t('validation.maxItems', `${path}不能超过${issue.maximum}项`);
        }
        break;
      case 'invalid_type':
        if (issue.received === 'undefined' || issue.received === 'null') {
          return t('validation.required', `${path}不能为空`);
        }
        return t('validation.invalidType', `${path}类型不正确`);
      case 'invalid_string':
        if (issue.validation === 'email') {
          return t('validation.email', '请输入有效的邮箱地址');
        }
        if (issue.validation === 'url') {
          return t('validation.url', '请输入有效的网址');
        }
        break;
      case 'invalid_enum_value':
        return t('validation.invalidEnum', `${path}的值不在允许范围内`);
      case 'custom':
        return issue.message || t('validation.error', '验证失败');
    }

    return issue.message || t('validation.error', '验证失败');
  }

  /**
   * 使用 Zod schema 验证单个字段
   */
  function validateWithSchema(field: string, value: unknown): string | null {
    if (!schema) return null;

    // 尝试从 schema 中提取字段级验证
    // 对于 ZodObject，我们单独验证该字段
    try {
      // 获取 schema 的 shape
      const shape = (schema as z.ZodObject<Record<string, ZodSchema>>)._def?.shape?.();
      if (shape && shape[field]) {
        const fieldSchema = shape[field];
        const result = fieldSchema.safeParse(value);
        if (!result.success) {
          return formatZodError(result.error);
        }
      }
    } catch {
      // schema 不是 ZodObject 或不支持 _def，忽略
    }

    return null;
  }

  /**
   * 使用自定义规则验证单个字段
   */
  function validateWithRule(field: string, value: unknown): string | null {
    const rule = rules[field];
    if (!rule) return null;

    const validator = typeof rule === 'function' ? rule : rule.validate;
    return validator(value);
  }

  /**
   * 验证单个字段（核心逻辑）
   */
  function validateField(field: string, value: unknown): boolean {
    ensureFieldState(field);

    // 优先使用自定义规则
    let error = validateWithRule(field, value);

    // 如果没有自定义规则，使用 schema 验证
    if (error === null && !rules[field]) {
      error = validateWithSchema(field, value);
    }

    fieldStates[field].error = error;
    errors[field] = error;
    fieldStates[field].validating = false;

    return error === null;
  }

  /**
   * 防抖验证（用于 change 事件）
   */
  function debouncedValidateField(field: string, value: unknown): void {
    // 清除之前的定时器
    if (debounceTimers[field]) {
      clearTimeout(debounceTimers[field]);
    }

    fieldStates[field].dirty = true;

    // 仅在已触碰时进行实时验证
    if (!fieldStates[field].touched) return;

    debounceTimers[field] = setTimeout(() => {
      validateField(field, value);
    }, debounceMs);
  }

  /**
   * 验证所有字段
   */
  function validateAll(values: Record<string, unknown>): boolean {
    let allValid = true;

    // 使用自定义规则验证
    const fieldsToValidate = new Set([
      ...Object.keys(rules),
      ...Object.keys(values),
    ]);

    for (const field of fieldsToValidate) {
      ensureFieldState(field);
      fieldStates[field].touched = true;
      touched[field] = true;

      const isValid = validateField(field, values[field]);
      if (!isValid) allValid = false;
    }

    // 如果有整体 schema，也做整体验证
    if (schema) {
      const result = schema.safeParse(values);
      if (!result.success) {
        // 映射 schema 错误到字段
        for (const issue of result.error.issues) {
          const path = issue.path[0];
          if (typeof path === 'string' && !errors[path]) {
            errors[path] = formatZodIssue(issue);
            fieldStates[path].error = errors[path];
            allValid = false;
          }
        }
      }
    }

    return allValid;
  }

  /**
   * 标记字段为已触碰
   */
  function touchField(field: string): void {
    ensureFieldState(field);
    fieldStates[field].touched = true;
    touched[field] = true;
  }

  /**
   * 重置所有验证状态
   */
  function reset(): void {
    for (const field of Object.keys(fieldStates)) {
      fieldStates[field].touched = false;
      fieldStates[field].validating = false;
      fieldStates[field].error = null;
      fieldStates[field].dirty = false;
      errors[field] = null;
      touched[field] = false;
    }
    // 清除所有防抖定时器
    for (const field of Object.keys(debounceTimers)) {
      clearTimeout(debounceTimers[field]);
    }
  }

  /**
   * 设置字段外部错误（如服务端返回的错误）
   */
  function setFieldError(field: string, error: string | null): void {
    ensureFieldState(field);
    fieldStates[field].error = error;
    errors[field] = error;
    if (error) {
      fieldStates[field].touched = true;
      touched[field] = true;
    }
  }

  /**
   * 获取字段绑定（用于 v-bind 绑定到 AppInput）
   */
  function getFieldBindings(field: string): {
    error: string | null;
    onBlur: () => void;
  } {
    ensureFieldState(field);

    return {
      get error() {
        return errors[field] ?? null;
      },
      onBlur: () => {
        touchField(field);
      },
    };
  }

  // 计算属性
  const isValid = computed(() => {
    const fields = Object.keys(fieldStates);
    if (fields.length === 0) return true;
    return fields.every((field) => fieldStates[field].error === null);
  });

  const hasErrors = computed(() => {
    return Object.keys(fieldStates).some((field) => fieldStates[field].error !== null);
  });

  // 组件卸载时清除所有防抖定时器
  try {
    onUnmounted(() => {
      for (const field of Object.keys(debounceTimers)) {
        clearTimeout(debounceTimers[field]);
      }
    });
  } catch {
    // 在组件外调用时 onUnmounted 会抛出，忽略即可
  }

  return {
    errors,
    touched,
    isValid,
    hasErrors,
    validateField,
    validateAll,
    reset,
    touch: touchField,
    setFieldError,
    getFieldBindings,
  };
}

/**
 * 创建带验证的字段绑定（快捷方法）
 *
 * @example
 * ```ts
 * const nameField = useFieldValidation(
 *   (v) => !v ? '请输入商品名称' : null,
 *   { debounce: true }
 * );
 *
 * <AppInput v-model="form.name" v-bind="nameField" />
 * ```
 */
export function useFieldValidation(
  validator: FieldValidator,
  options: { debounce?: boolean; debounceMs?: number } = {}
): {
  error: string | null;
  onBlur: () => void;
  onInput: (value: unknown) => void;
} {
  const { debounce = false, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  const state = reactive({
    touched: false,
    error: null as string | null,
  });

  let timer: ReturnType<typeof setTimeout> | null = null;

  function validate(value: unknown): void {
    state.error = validator(value);
  }

  function onInput(value: unknown): void {
    if (!state.touched) return;

    if (debounce) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => validate(value), debounceMs);
    } else {
      validate(value);
    }
  }

  function onBlur(): void {
    state.touched = true;
  }

  return {
    get error() {
      return state.error;
    },
    onBlur,
    onInput,
  };
}
