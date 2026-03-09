<template>
  <div class="space-y-6">
    <!-- 标题 (仅销售端显示) -->
    <div v-if="mode !== 'admin'" class="text-center">
      <h2 class="text-primary text-xl font-bold">{{ title || t('order.portal.newOrder') }}</h2>
      <p v-if="subtitle" class="mt-1 text-sm text-(--text-secondary)">{{ subtitle }}</p>
      <p v-else-if="mode === 'sales'" class="mt-1 text-sm text-(--text-secondary)">{{ t('order.portal.subtitle') }}</p>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- 图片上传 -->
      <ImageUploader
        ref="uploaderRef"
        v-model="uploadedFiles"
        :label="t('order.form.uploadImages')"
        :hint="t('order.form.uploadHint')"
        :upload-endpoint="uploadEndpoint"
        :deferred="true"
      />

      <!-- 商品信息 -->
      <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-card) p-3 sm:p-5">
        <!-- 商品名称 -->
        <div>
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.productName') }} <span class="text-(--color-danger-text)">*</span>
          </label>
          <AutocompleteInput
            v-model="form.name"
            :suggestions="nameSuggestions"
            :placeholder="t('order.form.productNamePlaceholder')"
            :label="t('order.form.recentInputs')"
            :filter-mode="false"
            input-class="input h-11"
            :disabled="isDisabled('name')"
          />
        </div>

        <!-- 品牌和系列 -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.brand') }}
            </label>
            <AutocompleteInput
              v-model="form.brand"
              :suggestions="brandSuggestions"
              :placeholder="t('order.form.brandPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
              :disabled="isDisabled('brand')"
            />
          </div>
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.series') }}
            </label>
            <AutocompleteInput
              v-model="form.series"
              :suggestions="seriesSuggestions"
              :placeholder="t('order.form.seriesPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
              :disabled="isDisabled('series')"
            />
          </div>
        </div>

        <!-- Admin: 销售员 | SKU -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div v-if="mode === 'admin'">
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('common.salesperson') }} <span class="text-(--color-danger-text)">*</span>
            </label>
          <Select
            v-model="adminForm.salespersonId"
            :options="salespersonOptions"
            :placeholder="t('salesperson.selectPlaceholder')"
          />
        </div>
        <div :class="{ 'md:col-span-2': mode !== 'admin' }">
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.sku') }}
          </label>
          <input
            v-model="form.sku"
            type="text"
            :placeholder="t('order.form.skuPlaceholder')"
            class="input h-11"
            :disabled="isDisabled('sku')"
          />
        </div>
      </div>

      <!-- 如果已绑定商品，显示只读的规格属性列表，否则显示原有的输入框 -->
      <template v-if="boundProductVariant">
        <div class="border-primary/20 bg-primary/5 mt-4 space-y-3 rounded-lg border p-4">
          <h5 class="text-primary text-sm font-medium">{{ t('product.variant.title') || '商品规格' }}</h5>
          <div class="grid [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
            <div v-for="(value, key) in boundProductVariant" :key="key" class="min-w-0 rounded-md bg-(--bg-card)/70 p-2">
              <span class="block truncate text-xs text-(--text-secondary)" :title="String(key)">
                {{ key }}
              </span>
              <span
                class="mt-1 block text-sm font-medium break-all text-(--text-main)"
                :title="String(value ?? '')"
              >
                {{ value }}
              </span>
            </div>
            <!-- 如果没有规格内容，显示占位符 -->
            <div v-if="Object.keys(boundProductVariant).length === 0" class="[grid-column:1/-1] text-sm text-(--text-muted)">
              {{ t('product.variant.noSpecs') || '无规格信息' }}
            </div>
          </div>
        </div>
        <!-- 数量 (绑定的情况下仍需数量字段) -->
        <div>
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.quantity') }} <span class="text-(--color-danger-text)">*</span>
          </label>
          <input
            v-model.number="form.quantity"
            type="number"
            inputmode="numeric"
            min="1"
            required
            class="input h-11"
          />
        </div>
      </template>

      <!-- 未绑定商品时，允许手动输入颜色、材质、规格尺寸 -->
      <template v-else>
        <!-- 规格尺寸 & 数量 -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.size') }}
            </label>
            <input
              v-model="form.size"
              type="text"
              :placeholder="t('order.form.sizePlaceholder')"
              class="input h-11"
            />
          </div>
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.quantity') }} <span class="text-(--color-danger-text)">*</span>
            </label>
          <input
            v-model.number="form.quantity"
            type="number"
            inputmode="numeric"
            min="1"
            required
            class="input h-11"
          />
          </div>
        </div>

        <!-- 颜色材质 -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
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
            <label class="text-primary mb-2 block text-sm font-medium">
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
      </template>

      <!-- 备注 -->
      <div>
        <label class="text-primary mb-2 block text-sm font-medium">
          {{ t('order.form.remark') }}
        </label>
        <textarea
          v-model="form.remark"
          rows="3"
          :placeholder="t('order.form.remarkPlaceholder')"
          class="input h-auto resize-none py-3"
        ></textarea>
      </div>

      <!-- Admin: 状态 | 到货时间 -->
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div v-if="mode === 'admin'">
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.status') }}
          </label>
          <StatusSelector
            v-model="adminForm.status"
            :options="statuses"
            class="w-full"
          />
        </div>
        <div :class="{ 'md:col-span-2': mode !== 'admin' }">
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.expectedArrival') }}
          </label>
          <input
            v-model="form.deadline"
            type="date"
            :min="minDate"
            class="input h-11 appearance-none bg-(--bg-card)"
            :class="{ 'text-muted': !form.deadline }"
          />
        </div>
      </div>
    </div>

    <div
      v-if="submitError"
      class="rounded-xl border border-(--color-danger-text)/20 bg-(--color-danger-bg)/40 px-3 py-2 text-sm text-(--text-main)"
      role="alert"
      data-testid="submit-error"
    >
      {{ submitError }}
    </div>

    <!-- 操作按钮 -->
    <div :class="actionBarClass">
      <button
        type="button"
        class="focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none h-12 flex-1 rounded-xl border border-(--border-color) bg-(--bg-card) font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
        @click="$emit('cancel')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="bg-primary shadow-primary/20 flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-medium text-(--text-inverse) shadow-lg transition-all focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <AppIcon
          v-if="isSubmitting"
          name="spinner"
          class="size-5 animate-spin"
        />
        {{ progressText }}
      </button>
    </div>
  </form>
</div>
</template>

<script setup>
import { watch, toRef, reactive, computed, ref, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useOrderForm } from '@/composables/useOrderForm';
import ImageUploader from '../common/ImageUploader.vue';
import AutocompleteInput from '../ui/AutocompleteInput.vue';
import StatusSelector from '@/components/ui/StatusSelector.vue';
import Select from '@/components/ui/Select.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
prefill: { type: Object, default: null },
submitProgress: { type: Object, default: () => ({ step: '', current: 0, total: 0 }) },
mode: { type: String, default: 'sales' }, // 'sales', 'admin'
title: { type: String, default: '' },
subtitle: { type: String, default: '' },
salespersons: { type: Array, default: () => [] },
statuses: { type: Array, default: () => [] },
disabledFields: { type: Array, default: () => [] },
boundProductVariant: { type: Object, default: null }, // NEW
submitError: { type: String, default: '' },
});

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();
const { addToast } = useToast();

const salespersonOptions = computed(() =>
  props.salespersons.map((sp) => ({
    label: `${sp.name}${sp.store ? ` (${sp.store})` : ''}`,
    value: sp.id,
  }))
);

// Helper to check if field is disabled
const isDisabled = (field) => props.disabledFields.includes(field);

// Admin fields
const adminForm = reactive({
  salespersonId: '',
  status: 'pending',
});

// 使用 composable 管理表单逻辑
const {
  form,
  uploadedFiles,
  isSubmitting,
  minDate,
  isValid: isFormValid,
  progressText,
  uploadEndpoint,
  nameSuggestions,
  brandSuggestions,
  seriesSuggestions,
  colorSuggestions,
  materialSuggestions,
  fillForm,
  getSubmitData,
  saveHistory,
  setSubmitting,
} = useOrderForm({
  submitProgress: toRef(props, 'submitProgress'),
  isSalesMode: props.mode === 'sales', // Pass mode hint if needed
});

const isValid = computed(() => {
  if (!isFormValid.value) return false;
  if (props.mode === 'admin') {
    if (!adminForm.salespersonId) return false;
  }
  return true;
});

const actionBarClass = computed(() => (
  props.mode === 'sales'
    ? 'sticky bottom-0 z-20 -mx-3 flex gap-3 border-t border-(--border-color) bg-(--bg-card)/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur'
    : 'flex gap-3'
));

// 监听预填充数据变化
watch(
  () => props.prefill,
  (data) => {
    fillForm(data);
    if (data && props.mode === 'admin') {
      if (data.salespersonId) adminForm.salespersonId = data.salespersonId;
      if (data.status) adminForm.status = data.status;
    }
  },
  { immediate: true }
);

// 提交表单
const uploaderRef = ref(null);

const handleSubmit = async () => {
  if (!isValid.value) {
    if (uploadedFiles.value.length === 0) {
      addToast({ message: t('order.form.pleaseUploadImage', '请至少上传一张商品图片'), type: 'warning' });
    } else if (!form.name) {
      addToast({ message: t('order.form.pleaseEnterName', '请填写商品名称'), type: 'warning' });
    } else if (props.mode === 'admin' && !adminForm.salespersonId) {
      addToast({ message: t('order.form.pleaseSelectSalesperson', '请选择销售人员'), type: 'warning' });
    } else {
      addToast({ message: t('order.form.pleaseComplete', '请完善必填信息'), type: 'warning' });
    }
    // 平滑滚动到顶部方便用户修正信息
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  
  if (isSubmitting.value) return;

  setSubmitting(true);
  try {
    // 1. 先上传已有图片
    if (uploaderRef.value) {

      const success = await uploaderRef.value.uploadPendingFiles();
      if (!success) {
        setSubmitting(false);
        return;
      }
      await nextTick(); // 等待 Vue 处理响应式更新

    }

    // 2. 获取提交数据 (此时 uploadedFiles 已包含服务器 ID)
    const data = getSubmitData();

    if (props.mode === 'admin') {
      data.salespersonId = adminForm.salespersonId;
      data.status = adminForm.status;
    }
    
    await emit('submit', data);
    saveHistory();
  } finally {
    setSubmitting(false);
  }
};
</script>
