<template>
  <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <!-- 基本信息 -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- 客户名称 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="text-secondary mb-1 block text-sm font-medium">
          {{ t('customer.form.name') }} <span class="text-[var(--color-danger)]">*</span>
        </label>
        <input
          v-model="form.name"
          type="text"
          required
          :placeholder="t('customer.form.namePlaceholder')"
          class="w-full rounded-lg border-[var(--border-color)] text-sm transition-colors outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <!-- 电话 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="mb-1 block text-sm font-medium text-gray-700">
          {{ t('customer.form.phone') }}
        </label>
        <input
          v-model="form.phone"
          type="tel"
          class="w-full rounded-lg border-[var(--border-color)] text-sm transition-colors outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <!-- 公司 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="mb-1 block text-sm font-medium text-gray-700">
          {{ t('customer.form.company') }}
        </label>
        <input
          v-model="form.company"
          type="text"
          class="w-full rounded-lg border-[var(--border-color)] text-sm transition-colors outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <!-- 邮箱 -->
      <div class="col-span-2 sm:col-span-1">
        <label class="mb-1 block text-sm font-medium text-gray-700">
          {{ t('customer.form.email') }}
        </label>
        <input
          v-model="form.email"
          type="email"
          class="w-full rounded-lg border-[var(--border-color)] text-sm transition-colors outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <!-- 标签 -->
      <div class="col-span-2">
        <label class="mb-1 block text-sm font-medium text-gray-700">
          {{ t('customer.form.tags') }}
        </label>
        <div
          class="mb-2 flex flex-wrap gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-2"
        >
          <span
            v-for="(tag, index) in form.tags"
            :key="index"
            class="bg-primary/10 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]"
          >
            {{ tag }}
            <button
              type="button"
              class="ml-1 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
              @click="removeTag(index)"
            >
              <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
          <input
            v-model="tagInput"
            type="text"
            :placeholder="t('customer.form.tagInputPlaceholder')"
            class="min-w-[100px] flex-1 border-none bg-transparent p-0 text-sm focus:ring-0"
            @keydown.enter.prevent="addTag"
            @keydown.backspace="handleBackspace"
          />
        </div>
      </div>

      <!-- 地址 -->
      <div class="col-span-2">
        <label class="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
          {{ t('customer.form.address') }}
        </label>
        <input
          v-model="form.address"
          type="text"
          class="w-full rounded-lg border-[var(--border-color)] text-sm transition-colors outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <!-- 备注 -->
      <div class="col-span-2">
        <label class="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
          {{ t('customer.form.remark') }}
        </label>
        <textarea
          v-model="form.remark"
          rows="3"
          class="w-full rounded-lg border-[var(--border-color)] text-sm transition-colors outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        ></textarea>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="mt-4 flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
      <button
        type="button"
        class="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none"
        @click="$emit('cancel')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        type="submit"
        :disabled="submitting"
        class="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:bg-[var(--color-primary-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          v-if="submitting"
          class="mr-2 -ml-1 size-4 animate-spin text-white"
          fill="none"
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
    default: null,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
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
  remark: '',
});

const tagInput = ref('');

// 初始化数据
watch(
  () => props.initialData,
  (data) => {
    if (data) {
      Object.keys(form).forEach((key) => {
        // 特殊处理 tags，确保是数组
        if (key === 'tags') {
          form.tags = Array.isArray(data.tags) ? [...data.tags] : [];
        } else if (data[key] !== undefined) {
          form[key] = data[key];
        }
      });
    } else {
      // 重置表单
      Object.keys(form).forEach((key) => {
        form[key] = key === 'tags' ? [] : '';
      });
    }
  },
  { immediate: true }
);

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
