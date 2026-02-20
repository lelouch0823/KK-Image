<template>
  <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <!-- 基本信息 -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- 客户名称 -->
      <div class="col-span-2 sm:col-span-1">
        <AppInput
          v-model="form.name"
          :label="t('customer.form.name')"
          :placeholder="t('customer.form.namePlaceholder')"
          required
        />
      </div>

      <!-- 电话 -->
      <div class="col-span-2 sm:col-span-1">
        <AppInput
          v-model="form.phone"
          type="tel"
          :label="t('customer.form.phone')"
        />
      </div>

      <!-- 公司 -->
      <div class="col-span-2 sm:col-span-1">
        <AppInput
          v-model="form.company"
          :label="t('customer.form.company')"
        />
      </div>

      <!-- 邮箱 -->
      <div class="col-span-2 sm:col-span-1">
        <AppInput
          v-model="form.email"
          type="email"
          :label="t('customer.form.email')"
        />
      </div>

      <!-- 标签 -->
      <div class="col-span-2">
        <label class="mb-1 block text-sm font-medium text-(--text-secondary)">
          {{ t('customer.form.tags') }}
        </label>
        <div
          class="focus-within:border-primary focus-within:ring-primary/20 focus-within:ring-1 mb-2 flex flex-wrap gap-2 rounded-lg border border-(--border-color) bg-(--bg-muted) p-2 transition-colors"
        >
          <span
            v-for="(tag, index) in form.tags"
            :key="index"
            class="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          >
            {{ tag }}
            <button
              type="button"
              class="text-primary ml-1 transition-colors hover:text-primary-hover"
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
            class="min-w-[100px] flex-1 border-none bg-transparent p-0 text-sm text-(--text-main) placeholder:text-(--text-secondary)/50 focus:ring-0 focus:outline-none"
            @keydown.enter.prevent="addTag"
            @keydown.backspace="handleBackspace"
          />
        </div>
      </div>

      <!-- 地址 -->
      <div class="col-span-2">
        <AppInput
          v-model="form.address"
          :label="t('customer.form.address')"
        />
      </div>

      <!-- 备注 -->
      <div class="col-span-2">
        <AppInput
          v-model="form.remark"
          :label="t('customer.form.remark')"
          textarea
          :rows="3"
        />
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="mt-4 flex justify-end gap-3 border-t border-(--border-color) pt-4">
      <AppButton
        variant="secondary"
        :text="t('common.cancel')"
        @click="$emit('cancel')"
      />
      <AppButton
        type="submit"
        variant="primary"
        :text="t('common.save')"
        :loading="submitting"
      />
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';

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
