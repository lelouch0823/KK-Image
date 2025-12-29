<template>
  <Modal v-model="visible" :title="isEditing ? t('salesperson.edit') : t('salesperson.create')" size="md">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- 姓名 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('salesperson.name') }} <span class="text-red-500">*</span>
        </label>
        <input 
          v-model="form.name"
          type="text"
          :placeholder="t('salesperson.namePlaceholder')"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
          required
        >
      </div>

      <!-- 门店 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('salesperson.store') }}
        </label>
        <input 
          v-model="form.store"
          type="text"
          :placeholder="t('salesperson.storePlaceholder')"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
        >
      </div>

      <!-- 电话 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('salesperson.phone') }}
        </label>
        <input 
          v-model="form.phone"
          type="tel"
          :placeholder="t('salesperson.phonePlaceholder')"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
        >
      </div>

      <!-- 密码 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('salesperson.password') }}
          <span v-if="!isEditing" class="text-red-500">*</span>
        </label>
        <input 
          v-model="form.password"
          type="text"
          :placeholder="isEditing ? t('salesperson.leaveBlankToKeep') : t('salesperson.passwordPlaceholder')"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
          :required="!isEditing"
        >
        <p class="text-xs text-gray-500 mt-1">{{ t('salesperson.passwordHint') }}</p>
      </div>

      <!-- 状态 & 重置链接 (编辑模式) -->
      <div v-if="isEditing" class="pt-4 border-t border-gray-100 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700">{{ t('salesperson.status') }}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.isActive" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700">{{ t('salesperson.accessLink') }}</span>
          <button 
            type="button"
            @click="$emit('resetToken')"
            class="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            {{ t('salesperson.resetLink') }}
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <button 
        type="button" 
        @click="visible = false"
        class="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
      >
        {{ t('common.cancel') }}
      </button>
      <button 
        @click="handleSubmit"
        :disabled="submitting"
        class="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center shadow-lg shadow-primary/20"
      >
        <svg v-if="submitting" class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {{ t('common.confirm') }}
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
