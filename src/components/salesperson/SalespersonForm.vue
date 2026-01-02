<template>
  <Modal v-model="visible" :title="isEditing ? t('salesperson.edit') : t('salesperson.create')" size="md">
    <form @submit.prevent="handleSubmit" class="space-y-5">
      <!-- 姓名 -->
      <div>
        <label class="block text-sm font-medium text-[var(--text-main)] mb-1.5">
          {{ t('salesperson.name') }} <span class="text-[var(--color-danger)]">*</span>
        </label>
        <input 
          v-model="form.name"
          type="text"
          :placeholder="t('salesperson.namePlaceholder')"
          class="input h-11 bg-[var(--bg-muted)] border-[var(--border-color)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 text-[var(--text-main)] placeholder-[var(--text-secondary)]/50"
          required
        >
      </div>

      <!-- 门店 -->
      <div>
        <label class="block text-sm font-medium text-[var(--text-main)] mb-1.5">
          {{ t('salesperson.store') }}
        </label>
        <input 
          v-model="form.store"
          type="text"
          :placeholder="t('salesperson.storePlaceholder')"
          class="input h-11 bg-[var(--bg-muted)] border-[var(--border-color)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 text-[var(--text-main)] placeholder-[var(--text-secondary)]/50"
        >
      </div>

      <!-- 电话 -->
      <div>
        <label class="block text-sm font-medium text-[var(--text-main)] mb-1.5">
          {{ t('salesperson.phone') }}
        </label>
        <input 
          v-model="form.phone"
          type="tel"
          :placeholder="t('salesperson.phonePlaceholder')"
          class="input h-11 bg-[var(--bg-muted)] border-[var(--border-color)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 text-[var(--text-main)] placeholder-[var(--text-secondary)]/50"
        >
      </div>

      <!-- 密码 -->
      <div>
        <label class="block text-sm font-medium text-[var(--text-main)] mb-1.5">
          {{ t('salesperson.password') }}
          <span v-if="!isEditing" class="text-[var(--color-danger)]">*</span>
        </label>
        <input 
          v-model="form.password"
          type="text"
          :placeholder="isEditing ? t('salesperson.leaveBlankToKeep') : t('salesperson.passwordPlaceholder')"
          class="input h-11 bg-[var(--bg-muted)] border-[var(--border-color)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 text-[var(--text-main)] placeholder-[var(--text-secondary)]/50"
          :required="!isEditing"
        >
        <p class="text-xs text-[var(--text-secondary)] mt-1.5">{{ t('salesperson.passwordHint') }}</p>
      </div>

      <!-- 状态 & 重置链接 (编辑模式) -->
      <div v-if="isEditing" class="pt-5 border-t border-[var(--border-color)] space-y-5">
        <label class="flex items-center justify-between cursor-pointer group">
          <span class="text-sm font-medium text-[var(--text-main)] group-hover:text-[var(--color-primary)] transition-colors">{{ t('salesperson.activeStatus') }}</span>
          <div class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.isActive" class="sr-only peer">
            <div class="w-11 h-6 bg-[var(--bg-muted)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
          </div>
        </label>

        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.uuid') }}</span>
          <div class="flex items-center gap-2">
            <code class="text-xs bg-[var(--bg-muted)] px-2 py-1.5 rounded-lg text-[var(--color-primary)] font-mono border border-[var(--border-color)]">{{ salesperson.uuid }}</code>
            <button 
              type="button"
              @click="$emit('resetToken', salesperson.uuid)"
              class="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline px-2 py-1"
            >
              {{ t('salesperson.resetLink') }}
            </button>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <button 
        @click="visible = false"
        class="px-5 py-2.5 bg-[var(--bg-muted)] text-[var(--text-secondary)] font-semibold rounded-xl hover:bg-[var(--bg-hover)] transition-all active:scale-95 text-sm"
      >
        {{ t('common.cancel') }}
      </button>
      <button 
        @click="handleSubmit"
        :disabled="submitting"
        class="px-6 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-[var(--color-primary)]/20 flex items-center text-sm"
      >
        <svg v-if="submitting" class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
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
    default: false
  },
  salesperson: {
    type: Object,
    default: null
  },
  submitting: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'submit', 'resetToken']);

const { t } = useI18n();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const isEditing = computed(() => !!props.salesperson);

const form = ref({
  name: '',
  store: '',
  phone: '',
  password: '',
  isActive: true
});

// 监听 salesperson 变化，填充表单
watch(() => props.salesperson, (person) => {
  if (person) {
    form.value = {
      name: person.name || '',
      store: person.store || '',
      phone: person.phone || '',
      password: '',
      isActive: person.isActive !== false
    };
  } else {
    form.value = {
      name: '',
      store: '',
      phone: '',
      password: '',
      isActive: true
    };
  }
}, { immediate: true });

const handleSubmit = () => {
  emit('submit', {
    ...form.value,
    id: props.salesperson?.id
  });
};
</script>
