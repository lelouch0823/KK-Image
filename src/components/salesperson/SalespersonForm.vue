<template>
  <Modal
    v-model="visible"
    :title="isEditing ? t('salesperson.edit') : t('salesperson.create')"
    size="md"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- 姓名 -->
      <div>
        <label class="text-main mb-1.5 block text-sm font-medium">
          {{ t('salesperson.name') }} <span class="text-danger">*</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          :placeholder="t('salesperson.namePlaceholder')"
          class="input border-border bg-surface-muted text-main placeholder-secondary-text/50 h-11 focus:border-primary focus:ring-primary/20"
          required
        />
      </div>

      <!-- 门店 -->
      <div>
        <label class="text-main mb-1.5 block text-sm font-medium">
          {{ t('salesperson.store') }}
        </label>
        <input
          v-model="form.store"
          type="text"
          :placeholder="t('salesperson.storePlaceholder')"
          class="input border-border bg-surface-muted text-main placeholder-secondary-text/50 h-11 focus:border-primary focus:ring-primary/20"
        />
      </div>

      <!-- 电话 -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-[var(--text-main)]">
          {{ t('salesperson.phone') }}
        </label>
        <input
          v-model="form.phone"
          type="tel"
          :placeholder="t('salesperson.phonePlaceholder')"
          class="input h-11 border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-main)] placeholder-[var(--text-secondary)]/50 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
        />
      </div>

      <!-- 密码 -->
      <div>
        <label class="text-main mb-1.5 block text-sm font-medium">
          {{ t('salesperson.password') }}
          <span v-if="!isEditing" class="text-danger">*</span>
        </label>
        <input
          v-model="form.password"
          type="text"
          :placeholder="
            isEditing ? t('salesperson.leaveBlankToKeep') : t('salesperson.passwordPlaceholder')
          "
          class="input border-border bg-surface-muted text-main placeholder-secondary-text/50 h-11 focus:border-primary focus:ring-primary/20"
          :required="!isEditing"
        />
        <p class="text-secondary-text mt-1.5 text-xs">
          {{ t('salesperson.passwordHint') }}
        </p>
      </div>

      <!-- 状态 & 重置链接 (编辑模式) -->
      <div v-if="isEditing" class="space-y-5 border-t border-[var(--border-color)] pt-5">
        <label class="group flex cursor-pointer items-center justify-between">
          <span
            class="text-main text-sm font-medium transition-colors group-hover:text-primary"
            >{{ t('salesperson.activeStatus') }}</span
          >
          <div class="relative inline-flex cursor-pointer items-center">
            <input v-model="form.isActive" type="checkbox" class="peer sr-only" />
            <div
              class="peer bg-surface-muted h-6 w-11 rounded-full peer-checked:bg-primary peer-focus:ring-primary/20 peer-focus:ring-2 peer-focus:outline-none after:border-border after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
            ></div>
          </div>
        </label>

        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.uuid') }}</span>
          <div class="flex items-center gap-2">
            <code
              class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] px-2 py-1.5 font-mono text-xs text-[var(--color-primary)]"
              >{{ salesperson.uuid }}</code
            >
            <button
              type="button"
              class="px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline"
              @click="$emit('resetToken', salesperson.uuid)"
            >
              {{ t('salesperson.resetLink') }}
            </button>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <button
        class="rounded-xl bg-[var(--bg-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] active:scale-95"
        @click="visible = false"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :disabled="submitting"
        class="bg-primary shadow-primary/20 flex items-center rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all dark:text-main-inverse hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleSubmit"
      >
        <svg
          v-if="submitting"
          class="mr-2 size-4 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
        {{ submitting ? t('common.saving') : t('common.save') }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  salesperson: {
    type: Object,
    default: null,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'submit', 'resetToken']);

const { t } = useI18n();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const isEditing = computed(() => !!props.salesperson);

const form = ref({
  name: '',
  store: '',
  phone: '',
  password: '',
  isActive: true,
});

// 监听 salesperson 变化，填充表单
watch(
  () => props.salesperson,
  (person) => {
    if (person) {
      form.value = {
        name: person.name || '',
        store: person.store || '',
        phone: person.phone || '',
        password: '',
        isActive: person.isActive !== false,
      };
    } else {
      form.value = {
        name: '',
        store: '',
        phone: '',
        password: '',
        isActive: true,
      };
    }
  },
  { immediate: true }
);

const handleSubmit = () => {
  emit('submit', {
    ...form.value,
    id: props.salesperson?.id,
  });
};
</script>
