<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <div class="text-center">
      <h2 class="text-xl font-bold text-primary">{{ t('order.portal.newOrder') }}</h2>
      <p class="text-sm text-secondary mt-1">{{ t('order.portal.subtitle') }}</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- 图片上传 -->
      <ImageUploader
        v-model="uploadedFiles"
        :label="t('order.form.uploadImages')"
        :hint="t('order.form.uploadHint')"
        :upload-endpoint="uploadEndpoint"
        :deferred="true"
      />

      <!-- 商品信息 -->
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-4 space-y-4">
        <!-- 商品名称 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.productName') }} <span class="text-danger">*</span>
          </label>
          <input 
            v-model="form.name"
            type="text"
            :placeholder="t('order.form.productNamePlaceholder')"
            class="input h-11"
            required
          >
        </div>

        <!-- 品牌和系列 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.brand') }}
            </label>
            <input 
              v-model="form.brand"
              type="text"
              :placeholder="t('order.form.brandPlaceholder')"
              class="input h-11"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.series') }}
            </label>
            <input 
              v-model="form.series"
              type="text"
              :placeholder="t('order.form.seriesPlaceholder')"
              class="input h-11"
            >
          </div>
        </div>

        <!-- 规格尺寸 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.size') }}
          </label>
          <input 
            v-model="form.size"
            type="text"
            :placeholder="t('order.form.sizePlaceholder')"
            class="input h-11"
          >
        </div>

        <!-- 颜色材质 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.color') }}
            </label>
            <input 
              v-model="form.color"
              type="text"
              :placeholder="t('order.form.colorPlaceholder')"
              class="input h-11"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.material') }}
            </label>
            <input 
              v-model="form.material"
              type="text"
              :placeholder="t('order.form.materialPlaceholder')"
              class="input h-11"
            >
          </div>
        </div>

        <!-- 备注 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.remark') }}
          </label>
          <textarea 
            v-model="form.remark"
            rows="3"
            :placeholder="t('order.form.remarkPlaceholder')"
            class="input h-auto py-3 resize-none"
          ></textarea>
        </div>

        <!-- 期望到货时间 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.expectedArrival') }}
          </label>
          <input 
            v-model="form.deadline"
            type="date"
            :min="minDate"
            class="input h-11 appearance-none bg-white"
            :class="{ 'text-muted': !form.deadline }"
          >
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <button 
          type="button"
          @click="$emit('cancel')"
          class="flex-1 h-12 border border-[var(--border-color)] text-secondary font-medium rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
        >
          {{ t('common.cancel') }}
        </button>
        <button 
          type="submit"
          :disabled="!form.name || uploadedFiles.length === 0 || isSubmitting"
          class="flex-1 h-12 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <svg v-if="isSubmitting" class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ isSubmitting ? t('order.form.submitting') : t('order.form.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import { getTodayISOString } from '@/utils/common';
import ImageUploader from '../common/ImageUploader.vue';

const minDate = computed(() => getTodayISOString());

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();
const { addToast } = useToast();

const form = reactive({
  name: '',
  brand: '',
  series: '',
  size: '',
  color: '',
  material: '',
  remark: '',
  deadline: ''
});

const uploadedFiles = ref([]);
const isSubmitting = ref(false);

// 计算上传地址
const uploadEndpoint = computed(() => {
  const match = window.location.pathname.match(/\/sales\/([^\/]+)/);
  const accessToken = match ? match[1] : '';
  return API.SALES_UPLOAD(accessToken);
});

// 提交表单
const handleSubmit = async () => {
  if (!form.name || uploadedFiles.value.length === 0 || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    // 提取本地文件对象用于上传
    const files = uploadedFiles.value
      .filter(f => f.isLocal && f.file)
      .map(f => f.file);
    
    await emit('submit', {
      ...form,
      files // 传递文件对象而非 fileIds
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>
