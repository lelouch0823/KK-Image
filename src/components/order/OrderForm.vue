<template>
  <div class="space-y-6">
    <!-- 标题 (仅销售端显示) -->
    <div v-if="mode !== 'admin'" class="text-center">
      <h2 class="text-primary text-xl font-bold">{{ title || t('order.portal.newOrder') }}</h2>
      <p v-if="subtitle" class="mt-1 text-sm text-(--text-secondary)">{{ subtitle }}</p>
      <p v-else-if="mode === 'sales'" class="mt-1 text-sm text-(--text-secondary)">
        {{ t('order.portal.subtitle') }}
      </p>
    </div>

    <form class="space-y-4" data-testid="submit-order-form" @submit.prevent="handleSubmit">
      <!-- 草稿恢复提示 -->
      <div
        v-if="hasFormDraft"
        class="flex items-center justify-between gap-3 rounded-xl border border-(--color-info-text)/20 bg-(--color-info-bg)/40 px-3 py-2"
        data-testid="form-draft-banner"
      >
        <p class="text-sm text-(--text-main)">
          {{ t('formDraft.found', '发现未保存的草稿') }}
          <span v-if="getFormDraftAgeText()" class="text-(--text-secondary)">
            ({{ getFormDraftAgeText() }})
          </span>
        </p>
        <div class="flex items-center gap-2">
          <AppButton variant="ghost" size="sm" data-testid="form-draft-restore" @click="handleRestoreFormDraft">
            {{ t('formDraft.restore', '恢复') }}
          </AppButton>
          <AppButton variant="ghost" size="sm" data-testid="form-draft-discard" @click="clearFormDraft">
            {{ t('formDraft.discard', '丢弃') }}
          </AppButton>
        </div>
      </div>

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
      <div class="space-y-4 rounded-2xl border border-(--border-color) bg-(--bg-card) p-3 sm:p-5">
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
          <div v-if="mode === 'admin'" :class="{ 'md:col-span-1': mode === 'admin' }">
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.status') }}
            </label>
            <StatusSelector v-model="adminForm.status" :options="statuses" class="w-full" />
          </div>
        </div>

        <template v-if="showLineEditor && !boundProductVariant">
          <OrderLinesSummaryBar :summary="summaryMetrics" />
          <OrderLinesEditor
            :model-value="lines"
            :line-states="lineStates"
            @add-line="addLineAfter(lines.length - 1)"
            @add-line-after="addLineAfter"
            @copy-line="copyLine"
            @remove-line="removeLine"
            @update-line="updateLine"
          />
        </template>

        <template v-else>
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

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div :class="{ 'md:col-span-2': mode !== 'admin' }">
              <AppInput
                v-model="form.sku"
                :label="t('order.form.sku')"
                type="text"
                :placeholder="t('order.form.skuPlaceholder')"
                :disabled="isDisabled('sku')"
                size="lg"
              />
            </div>
          </div>

          <template v-if="boundProductVariant">
            <div class="border-primary/20 bg-primary/5 mt-4 space-y-3 rounded-lg border p-4">
              <h5 class="text-primary text-sm font-medium">
                {{ t('product.variant.title') || '商品规格' }}
              </h5>
              <div class="grid [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
                <div
                  v-for="(value, key) in boundProductVariant"
                  :key="key"
                  class="min-w-0 rounded-md bg-(--bg-card)/70 p-2"
                >
                  <span
                    class="block truncate text-xs text-(--text-secondary)"
                    :title="String(key)"
                  >
                    {{ key }}
                  </span>
                  <span
                    class="mt-1 block text-sm font-medium break-all text-(--text-main)"
                    :title="String(value ?? '')"
                  >
                    {{ value }}
                  </span>
                </div>
                <div
                  v-if="Object.keys(boundProductVariant).length === 0"
                  class="[grid-column:1/-1] text-sm text-(--text-muted)"
                >
                  {{ t('product.variant.noSpecs') || '无规格信息' }}
                </div>
              </div>
            </div>
            <div>
              <AppInput
                :model-value="form.quantity"
                :label="`${t('order.form.quantity')} *`"
                type="number"
                inputmode="numeric"
                min="1"
                required
                size="lg"
                @update:model-value="form.quantity = Number($event || 0)"
              />
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <AppInput
                  v-model="form.size"
                  :label="t('order.form.size')"
                  type="text"
                  :placeholder="t('order.form.sizePlaceholder')"
                  size="lg"
                />
              </div>
              <div>
                <AppInput
                  :model-value="form.quantity"
                  :label="`${t('order.form.quantity')} *`"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  required
                  size="lg"
                  @update:model-value="form.quantity = Number($event || 0)"
                />
              </div>
            </div>

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
        </template>

        <div>
          <AppInput
            v-model="form.remark"
            :label="t('order.form.remark')"
            textarea
            rows="3"
            :placeholder="t('order.form.remarkPlaceholder')"
            size="lg"
          />
        </div>

        <div :class="{ 'md:col-span-2': mode !== 'admin' }">
          <AppInput
            v-model="form.deadline"
            :label="t('order.form.expectedArrival')"
            type="date"
            :min="minDate"
            size="lg"
            :class="{ 'text-muted': !form.deadline }"
          />
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
        <AppButton
          type="button"
          variant="secondary"
          size="lg"
          class="flex-1"
          @click="$emit('cancel')"
        >
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          :disabled="isSubmitting"
          class="flex-1"
        >
          <template v-if="isSubmitting" #icon-left>
            <AppIcon name="spinner" class="size-5 animate-spin" />
          </template>
          {{ progressText }}
        </AppButton>
      </div>
    </form>
  </div>
</template>

<script setup>
import { watch, toRef, reactive, computed, ref, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useOrderForm } from '@/composables/useOrderForm';
import { useFormDraft } from '@/composables/useFormDraft';
import ImageUploader from '../common/ImageUploader.vue';
import AutocompleteInput from '../ui/AutocompleteInput.vue';
import StatusSelector from '@/components/ui/StatusSelector.vue';
import Select from '@/components/ui/Select.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import OrderLinesEditor from '@/components/order/OrderLinesEditor.vue';
import OrderLinesSummaryBar from '@/components/order/OrderLinesSummaryBar.vue';
import { createEmptyOrderLine } from '@/composables/useOrderForm';

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
  lines,
  setLines,
  updateLine,
  addLineAfter,
  copyLine,
  removeLine,
  summaryMetrics,
  lineStates,
} = useOrderForm({
  submitProgress: toRef(props, 'submitProgress'),
  isSalesMode: props.mode === 'sales', // Pass mode hint if needed
});

const showLineEditor = computed(() => props.mode === 'admin');

// 表单草稿自动保存（仅 admin 模式）
const draftDataSource = reactive({
  get form() { return form; },
  get lines() { return lines.value; },
});

const {
  hasDraft: hasFormDraft,
  restoreDraft: restoreFormDraft,
  clearDraft: clearFormDraft,
  getDraftAgeText: getFormDraftAgeText,
} = useFormDraft({
  key: `order-${props.mode}`,
  data: draftDataSource,
  debounce: 2000,
  exclude: ['uploadedFiles'],
});

// 恢复草稿
const handleRestoreFormDraft = () => {
  restoreFormDraft();
  addToast({ message: t('formDraft.restored', '草稿已恢复'), type: 'success' });
};

const isValid = computed(() => {
  if (!isFormValid.value) return false;
  if (props.mode === 'admin') {
    if (!adminForm.salespersonId) return false;
  }
  return true;
});

const actionBarClass = computed(() =>
  'sticky bottom-0 z-20 -mx-3 flex gap-3 border-t border-(--border-color) bg-(--bg-card) px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
);

const applyDefaultAdminSalesperson = (salespersons = props.salespersons) => {
  if (props.mode !== 'admin' || adminForm.salespersonId) return;
  if (salespersons.length === 1) {
    adminForm.salespersonId = salespersons[0]?.id || '';
  }
};

// 监听预填充数据变化
watch(
  () => props.prefill,
  (data) => {
    fillForm(data);
    if (props.mode !== 'admin' && lines.value.length > 1) {
      collapseLinesToSingleLine();
    }
    if (data && props.mode === 'admin') {
      if (data.salespersonId) adminForm.salespersonId = data.salespersonId;
      if (data.status) adminForm.status = data.status;
    }
    applyDefaultAdminSalesperson();
  },
  { immediate: true }
);

watch(
  () => props.salespersons,
  (salespersons) => {
    applyDefaultAdminSalesperson(salespersons);
  },
  { immediate: true }
);

// 提交表单
const uploaderRef = ref(null);

function buildCurrentLineFromForm() {
  return createEmptyOrderLine({
    name: form.name,
    brand: form.brand,
    series: form.series,
    sku: form.sku,
    size: form.size,
    color: form.color,
    material: form.material,
    quantity: form.quantity,
  });
}

function applyLineToForm(line = {}) {
  form.name = line.name || '';
  form.brand = line.brand || '';
  form.series = line.series || '';
  form.sku = line.sku || '';
  form.size = line.size || '';
  form.color = line.color || '';
  form.material = line.material || '';
  form.quantity = Number(line.quantity || 1);
}

function collapseLinesToSingleLine() {
  const primaryLine = lines.value[0];
  if (primaryLine) {
    applyLineToForm(primaryLine);
    setLines([primaryLine]);
    return;
  }
  setLines([buildCurrentLineFromForm()]);
}

const handleSubmit = async () => {
  if (!isValid.value) {
    if (uploadedFiles.value.length === 0) {
      addToast({
        message: t('order.form.pleaseUploadImage', '请至少上传一张商品图片'),
        type: 'warning',
      });
    } else if (summaryMetrics.value.pendingLineCount > 0) {
      addToast({
        message: t('order.form.pendingLines', `还有 ${summaryMetrics.value.pendingLineCount} 行待完善`),
        type: 'warning',
      });
    } else if (!form.name && !lines.value.some((line) => String(line?.name || '').trim())) {
      addToast({ message: t('order.form.pleaseEnterName', '请填写商品名称'), type: 'warning' });
    } else if (props.mode === 'admin' && !adminForm.salespersonId) {
      addToast({
        message: t('order.form.pleaseSelectSalesperson', '请选择销售人员'),
        type: 'warning',
      });
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

    if (props.mode !== 'admin') {
      delete data.lines;
    }

    if (props.mode === 'admin') {
      data.salespersonId = adminForm.salespersonId;
      data.status = adminForm.status;
    }

    await emit('submit', data);
    saveHistory();
    clearFormDraft();
  } finally {
    setSubmitting(false);
  }
};
</script>
