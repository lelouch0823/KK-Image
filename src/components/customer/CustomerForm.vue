<template>
  <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
    <!-- 基本信息 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- 客户名称 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.name') }} <span class="text-red-500">*</span>
        </label>
        <input 
          v-model="form.name" 
          type="text" 
          required
          :placeholder="t('customer.form.namePlaceholder')"
          class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary sm:text-sm"
        >
      </div>

      <!-- 电话 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.phone') }}
        </label>
        <input 
          v-model="form.phone" 
          type="tel" 
          class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary sm:text-sm"
        >
      </div>

      <!-- 公司 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.company') }}
        </label>
        <input 
          v-model="form.company" 
          type="text" 
          class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary sm:text-sm"
        >
      </div>

      <!-- 邮箱 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.email') }}
        </label>
        <input 
          v-model="form.email" 
          type="email" 
          class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary sm:text-sm"
        >
      </div>

      <!-- 标签 -->
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.tags') }}
        </label>
        <div class="flex flex-wrap gap-2 mb-2 p-2 bg-[var(--bg-muted)] rounded-lg border border-[var(--border-color)]">
          <span 
            v-for="(tag, index) in form.tags" 
            :key="index"
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
          >
            {{ tag }}
            <button type="button" @click="removeTag(index)" class="ml-1 text-primary hover:text-primary-hover">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </span>
          <input 
            v-model="tagInput"
            @keydown.enter.prevent="addTag"
            @keydown.backspace="handleBackspace"
            type="text"
            :placeholder="t('customer.form.tagInputPlaceholder')"
            class="flex-1 min-w-[100px] bg-transparent border-none p-0 focus:ring-0 text-sm"
          >
        </div>
      </div>

      <!-- 地址 -->
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.address') }}
        </label>
        <input 
          v-model="form.address" 
          type="text" 
          class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary sm:text-sm"
        >
      </div>

      <!-- 备注 -->
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t('customer.form.remark') }}
        </label>
        <textarea 
          v-model="form.remark" 
          rows="3"
          class="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary sm:text-sm"
        ></textarea>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
      <button 
        type="button" 
        @click="$emit('cancel')"
        class="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        {{ t('common.cancel') }}
      </button>
      <button 
        type="submit" 
        :disabled="submitting"
        class="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg v-if="submitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {{ t('common.save') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  initialData: {
    type: Object,
    default: null
  },
  submitting: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'cancel']);
const { t } = useI18n();

const form = reactive({
  name: '',
  phone: '',
  company: '',
  email: '',
  address: '',
  tags: [],
  remark: ''
});

const tagInput = ref('');

// 初始化数据
watch(() => props.initialData, (data) => {
  if (data) {
    Object.keys(form).forEach(key => {
      // 特殊处理 tags，确保是数组
      if (key === 'tags') {
        form.tags = Array.isArray(data.tags) ? [...data.tags] : [];
      } else if (data[key] !== undefined) {
        form[key] = data[key];
      }
    });
  } else {
    // 重置表单
    Object.keys(form).forEach(key => {
      form[key] = key === 'tags' ? [] : '';
    });
  }
}, { immediate: true });

const addTag = () => {
  const tag = tagInput.value.trim();
  if (tag && !form.tags.includes(tag)) {
    form.tags.push(tag);
  }
  tagInput.value = '';
};

const removeTag = (index) => {
  form.tags.splice(index, 1);
};

const handleBackspace = () => {
  if (!tagInput.value && form.tags.length > 0) {
    form.tags.pop();
  }
};

const handleSubmit = () => {
  // 确保输入框中的标签也被添加
  addTag();
  emit('submit', { ...form });
};
</script>
