<template>
  <div class="w-full">
    <!-- Label -->
    <label v-if="label" :for="inputId" class="mb-1.5 block text-xs font-medium text-(--text-secondary)">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>

    <div class="relative">
      <!-- Prepend Icon -->
      <div v-if="$slots.prepend && !textarea" class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-(--text-muted)">
        <slot name="prepend" />
      </div>

      <!-- Input -->
      <component
        :is="textarea ? 'textarea' : 'input'"
        :id="inputId"
        ref="inputEl"
        v-bind="$attrs"
        :value="modelValue"
        :type="!textarea ? type : undefined"
        :disabled="disabled"
        :required="required"
        :aria-invalid="hasError ? 'true' : 'false'"
        class="block w-full rounded-lg border bg-(--bg-card) text-(--text-main) placeholder-(--text-muted) transition-all duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        :class="[
          inputClasses,
          stateClasses,
          textarea ? 'resize-y' : ''
        ]"
        @input="handleInput"
        @blur="handleBlur"
        @focus="$emit('focus', $event)"
      />

      <!-- Status Icon (success/error) -->
      <div
        v-if="showStatusIcon && !textarea"
        class="absolute inset-y-0 right-0 flex items-center pr-3"
      >
        <svg
          v-if="validationState === 'success'"
          class="size-4 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg
          v-else-if="validationState === 'error'"
          class="size-4 text-danger"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <!-- Append Icon -->
      <div v-if="$slots.append && !textarea" class="absolute inset-y-0 right-0 flex items-center pr-3 text-(--text-muted)">
        <slot name="append" />
      </div>
    </div>

    <!-- Error Message -->
    <p v-if="hasError" role="alert" class="text-danger mt-1 text-xs">{{ displayError }}</p>
    <!-- Helper Text -->
    <p v-else-if="hint" class="mt-1 text-xs text-(--text-muted)">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch, useSlots, useId, useTemplateRef } from 'vue';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  label: { type: String, default: '' },
  id: { type: String, default: undefined },
  type: { type: String, default: 'text' },
  /** 外部传入的错误信息（优先级最高） */
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  textarea: { type: Boolean, default: false },
  /**
   * 内联验证函数
   * 接收当前值，返回错误信息字符串或 null（表示有效）
   * 在 blur 时触发验证；如需 change 时验证，使用 onInput 事件
   *
   * @example
   * ```vue
   * <AppInput
   *   v-model="form.name"
   *   :validation="(v) => !v ? '请输入名称' : null"
   * />
   * ```
   */
  validation: { type: Function, default: null },
  /** 是否在 change 时也触发验证（默认仅 blur） */
  validateOnChange: { type: Boolean, default: false },
  /** 验证防抖毫秒数（仅 validateOnChange 时生效） */
  debounceMs: { type: Number, default: 300 },
});

const emit = defineEmits(['update:modelValue', 'blur', 'focus', 'validation-change']);

const uid = useId();
const inputId = computed(() => props.id || uid);

const inputEl = useTemplateRef('inputEl');
const slots = useSlots();

// 验证状态
const internalError = ref('');
const hasValidated = ref(false);
let debounceTimer = null;

// 计算显示的错误信息（外部 error 优先）
const displayError = computed(() => {
  if (props.error) return props.error;
  if (hasValidated.value) return internalError.value;
  return '';
});

// 是否有错误
const hasError = computed(() => !!displayError.value);

// 验证状态：'idle' | 'success' | 'error'
const validationState = computed(() => {
  if (!hasValidated.value) return 'idle';
  if (displayError.value) return 'error';
  if (props.validation) return 'success';
  return 'idle';
});

// 是否显示状态图标
const showStatusIcon = computed(() => {
  // 有 append slot 时不显示状态图标（避免冲突）
  if (slots.append) return false;
  // 有验证函数且已验证过才显示
  return props.validation && hasValidated.value;
});

// 输入框状态样式
const stateClasses = computed(() => {
  // 外部 error 优先
  if (props.error) {
    return 'border-danger focus-visible:border-danger focus-visible:ring-danger/15';
  }
  // 验证后的内部错误
  if (hasValidated.value && internalError.value) {
    return 'border-danger focus-visible:border-danger focus-visible:ring-danger/15';
  }
  // 验证成功
  if (validationState.value === 'success') {
    return 'border-success focus-visible:border-success focus-visible:ring-success/15';
  }
  // 默认
  return 'border-(--border-color)';
});

// 执行验证
function runValidation(value) {
  if (!props.validation) return;
  const result = props.validation(value);
  internalError.value = result || '';
  emit('validation-change', { valid: !result, error: result || null });
}

// 输入事件处理
function handleInput(event) {
  const value = event.target.value;
  emit('update:modelValue', value);

  // validateOnChange 模式下防抖验证
  if (props.validateOnChange && hasValidated.value) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runValidation(value);
    }, props.debounceMs);
  }
}

// Blur 事件处理
function handleBlur(event) {
  hasValidated.value = true;
  runValidation(props.modelValue);
  emit('blur', event);
}

// 外部 error 变化时同步验证状态
watch(
  () => props.error,
  (newError) => {
    if (newError) {
      hasValidated.value = true;
    }
  }
);

// 清理定时器
watch(
  () => props.validation,
  () => {
    // 验证函数变化时重置状态
    hasValidated.value = false;
    internalError.value = '';
  }
);

// Expose input element for external focus control
defineExpose({
  focus: () => inputEl.value?.focus(),
  blur: () => inputEl.value?.blur(),
  el: inputEl,
  /** 手动触发验证 */
  validate: () => {
    hasValidated.value = true;
    runValidation(props.modelValue);
    return !internalError.value;
  },
  /** 重置验证状态 */
  resetValidation: () => {
    hasValidated.value = false;
    internalError.value = '';
  },
});

const inputClasses = computed(() => {
  const sizes = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  if (props.textarea) {
      return [sizes[props.size], 'px-3'];
  }

  const heightSizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  };

  const paddingLeft = slots.prepend ? 'pl-10' : 'pl-3';
  // 有状态图标时留出空间
  const paddingRight = slots.append ? 'pr-10' : (showStatusIcon.value ? 'pr-10' : 'pr-3');

  return [heightSizes[props.size], sizes[props.size], paddingLeft, paddingRight];
});
</script>
