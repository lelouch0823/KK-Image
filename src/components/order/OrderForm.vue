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
          <AutocompleteInput
            v-model="form.name"
            :suggestions="nameSuggestions"
            :placeholder="t('order.form.productNamePlaceholder')"
            :label="t('order.form.recentInputs')"
            :filter-mode="false"
            input-class="input h-11"
          />
        </div>

        <!-- 品牌和系列 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.brand') }}
            </label>
            <AutocompleteInput
              v-model="form.brand"
              :suggestions="brandSuggestions"
              :placeholder="t('order.form.brandPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.series') }}
            </label>
            <AutocompleteInput
              v-model="form.series"
              :suggestions="seriesSuggestions"
              :placeholder="t('order.form.seriesPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
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
            <AutocompleteInput
              v-model="form.color"
              :suggestions="colorSuggestions"
              :placeholder="t('order.form.colorPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.material') }}
            </label>
            <AutocompleteInput
              v-model="form.material"
              :suggestions="materialSuggestions"
              :placeholder="t('order.form.materialPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
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
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useRecentInputs } from '@/composables/useRecentInputs';
import { API } from '@/utils/constants';
import { getTodayISOString } from '@/utils/common';
import ImageUploader from '../common/ImageUploader.vue';
import AutocompleteInput from '../ui/AutocompleteInput.vue';

const minDate = computed(() => getTodayISOString());

const props = defineProps({
  prefill: { type: Object, default: null }
});

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

// 监听预填充数据变化 (用于复制订单)
watch(() => props.prefill, (data) => {
  if (data) {
    Object.keys(form).forEach(key => {
      if (data[key] !== undefined) {
        form[key] = data[key];
      }
    });
  }
}, { immediate: true });

const uploadedFiles = ref([]);
const isSubmitting = ref(false);

// 最近输入历史
const { getRecent, saveMultiple } = useRecentInputs('order');

// 各字段的建议列表
const nameSuggestions = computed(() => getRecent('name'));
const brandSuggestions = computed(() => getRecent('brand'));
const seriesSuggestions = computed(() => getRecent('series'));
const colorSuggestions = computed(() => getRecent('color'));
const materialSuggestions = computed(() => getRecent('material'));

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

    // 提交成功后保存历史
    saveMultiple({
      name: form.name,
      brand: form.brand,
      series: form.series,
      color: form.color,
      material: form.material
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>
