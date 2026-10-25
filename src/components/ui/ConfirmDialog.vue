<template>
  <Modal
    :model-value="modelValue"
    size="sm"
    :closable="!loading"
    :close-on-backdrop="!loading"
    :labelled-by="titleId"
    body-class="!p-0"
    @update:model-value="handleModalUpdate"
  >
    <div class="w-full transform overflow-hidden transition-all">
      <!-- 图标/背景装饰 -->
      <div
        :class="['relative flex h-20 items-center justify-center overflow-hidden', typeClasses.bg]"
      >
        <div
          class="absolute inset-0 scale-150 rotate-12 transform opacity-10 blur-2xl"
          :class="typeClasses.accent"
        ></div>

        <div
          :class="[
            'relative z-10 flex size-12 items-center justify-center rounded-full',
            typeClasses.iconBg,
            typeClasses.iconText,
          ]"
        >
          <!-- Success -->
          <AppIcon v-if="type === 'success'" name="check" class="size-6" />
          <!-- Danger -->
          <AppIcon v-else-if="type === 'danger'" name="exclamation-triangle" class="size-6" />
          <!-- Warning -->
          <AppIcon v-else-if="type === 'warning'" name="exclamation-circle" class="size-6" />
          <!-- Info / Primary (default) -->
          <AppIcon v-else name="information-circle" class="size-6" />
        </div>
      </div>

      <!-- 内容 -->
      <div class="px-6 pt-4 pb-2 text-center">
        <h3 :id="titleId" class="mb-1.5 text-base font-semibold text-(--text-main)">
          {{ title || t('common.confirmTitle') }}
        </h3>
        <p class="text-sm leading-relaxed text-(--text-secondary)">
          <slot>{{ message || t('common.confirmMessageDefault') }}</slot>
        </p>

        <!-- Input verification -->
        <div v-if="showInput" class="mt-4">
          <p v-if="inputLabel" class="mb-2 text-left text-xs font-medium text-(--text-muted)">
            {{ inputLabel }}
          </p>
          <AppInput
            ref="inputField"
            v-model="inputValue"
            :placeholder="inputPlaceholder"
            class="mt-2"
            @keyup.enter="!isConfirmDisabled && handleConfirm()"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-3 px-6 pb-5 pt-2">
        <AppButton
          ref="cancelButton"
          variant="secondary"
          :text="cancelText || t('common.cancel')"
          :disabled="loading"
          @click="handleCancel"
        />
        <AppButton
          :variant="confirmButtonVariant"
          :text="confirmText || t('common.confirm')"
          :loading="loading"
          :disabled="isConfirmDisabled"
          @click="handleConfirm"
        />
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, nextTick, useId, useTemplateRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();
const inputValue = ref('');
const inputField = useTemplateRef('inputField');
const titleId = useId();

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  type: {
    type: String, // 'primary' | 'danger' | 'warning' | 'success' | 'info'
    default: 'primary',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  // Input verification
  showInput: Boolean,
  inputPlaceholder: { type: String, default: '' },
  inputLabel: { type: String, default: '' },
  inputType: {
    type: String,
    default: 'text',
  },
  verifyText: { type: String, default: '' }, // If provided, confirm button disabled until input matches
  inputRequired: Boolean, // New: Require non-empty input
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

// 基于 Modal 实现：焦点陷阱、焦点归还、role="dialog"/aria-modal、
// 弹窗栈（Esc 只关最顶层、滚动锁）全部由 Modal 统一提供

// Confirm button disabled state
const isConfirmDisabled = computed(() => {
  if (props.loading) return true;
  if (props.showInput) {
    if (props.verifyText && inputValue.value !== props.verifyText) return true;
    if (props.inputRequired && !inputValue.value.trim()) return true;
  }
  return false;
});

const confirmButtonVariant = computed(() => {
  if (props.type === 'danger') return 'danger';
  if (props.type === 'warning') return 'outline';
  if (props.type === 'success') return 'primary';
  if (props.type === 'info') return 'outline';
  return 'primary';
});

// Type-based styling using CSS variables
const typeClasses = computed(() => {
  const types = {
    primary: {
      bg: 'bg-(--color-primary-bg)',
      accent: 'bg-primary',
      iconBg: 'bg-(--color-primary-bg)',
      iconText: 'text-primary',
    },
    danger: {
      bg: 'bg-(--color-danger-bg)',
      accent: 'bg-danger',
      iconBg: 'bg-(--color-danger-bg)',
      iconText: 'text-danger',
    },
    warning: {
      bg: 'bg-(--color-warning-bg)',
      accent: 'bg-warning',
      iconBg: 'bg-(--color-warning-bg)',
      iconText: 'text-(--color-warning-text)',
    },
    success: {
      bg: 'bg-(--color-success-bg)',
      accent: 'bg-success',
      iconBg: 'bg-(--color-success-bg)',
      iconText: 'text-(--color-success-text)',
    },
    info: {
      bg: 'bg-(--color-info-bg)',
      accent: 'bg-info',
      iconBg: 'bg-(--color-info-bg)',
      iconText: 'text-(--color-info-text)',
    },
  };
  return types[props.type] || types.primary;
});

const handleCancel = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
  emit('cancel');
};

const handleConfirm = () => {
  if (isConfirmDisabled.value) return;
  emit('confirm', inputValue.value);
};

// Modal 的 Esc / 遮罩关闭统一走 cancel 语义（loading 期间 Modal 已不可关闭）
const handleModalUpdate = (val) => {
  if (!val) handleCancel();
};

// 打开时清空输入并聚焦校验输入框（覆盖 Modal 默认聚焦第一个可聚焦元素的行为）
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      inputValue.value = '';
      if (props.showInput) {
        nextTick(() => inputField.value?.focus());
      }
    }
  },
  { immediate: true }
);
</script>
