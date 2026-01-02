<template>
  <Modal v-model="visible" :title="isEditing ? t('salesperson.edit') : t('salesperson.create')" size="md">
    <form @submit.prevent="handleSubmit" class="space-y-5">
      <!-- 姓名 -->
      <div>
        <label class="block text-sm font-medium text-primary mb-1.5">
          {{ t('salesperson.name') }} <span class="text-danger">*</span>
        </label>
        <input 
          v-model="form.name"
          type="text"
          :placeholder="t('salesperson.namePlaceholder')"
          class="input h-11"
          required
        >
      </div>

      <!-- 门店 -->
      <div>
        <label class="block text-sm font-medium text-primary mb-1.5">
          {{ t('salesperson.store') }}
        </label>
        <input 
          v-model="form.store"
          type="text"
          :placeholder="t('salesperson.storePlaceholder')"
          class="input h-11"
        >
      </div>

      <!-- 电话 -->
      <div>
        <label class="block text-sm font-medium text-primary mb-1.5">
          {{ t('salesperson.phone') }}
        </label>
        <input 
          v-model="form.phone"
          type="tel"
          :placeholder="t('salesperson.phonePlaceholder')"
          class="input h-11"
        >
      </div>

      <!-- 密码 -->
      <div>
        <label class="block text-sm font-medium text-primary mb-1.5">
          {{ t('salesperson.password') }}
          <span v-if="!isEditing" class="text-danger">*</span>
        </label>
        <input 
          v-model="form.password"
          type="text"
          :placeholder="isEditing ? t('salesperson.leaveBlankToKeep') : t('salesperson.passwordPlaceholder')"
          class="input h-11"
          :required="!isEditing"
        >
        <p class="text-xs text-secondary mt-1.5">{{ t('salesperson.passwordHint') }}</p>
      </div>

      <!-- 状态 & 重置链接 (编辑模式) -->
      <div v-if="isEditing" class="pt-4 border-t border-[var(--border-color)] space-y-4">
        <label class="flex items-center justify-between cursor-pointer group">
          <span class="text-sm font-medium text-primary group-hover:text-primary-hover transition-colors">{{ t('salesperson.activeStatus') }}</span>
          <div class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.isActive" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </div>
        </label>

        <div class="flex items-center justify-between">
          <span class="text-sm text-secondary">{{ t('salesperson.uuid') }}</span>
          <div class="flex items-center gap-2">
            <code class="text-xs bg-[var(--bg-muted)] px-2 py-1 rounded text-primary font-mono">{{ salesperson.uuid }}</code>
            <button 
              type="button"
              @click="$emit('resetToken', salesperson.uuid)"
              class="text-xs text-primary hover:text-primary-hover hover:underline"
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
        class="px-5 py-2.5 border border-[var(--border-color)] text-secondary font-medium rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-sm"
      >
        {{ t('common.cancel') }}
      </button>
      <button 
        @click="handleSubmit"
        :disabled="submitting"
        class="px-5 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 flex items-center text-sm"
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
