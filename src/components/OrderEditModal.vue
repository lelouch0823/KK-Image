<template>
  <Modal
    :model-value="true"
    size="6xl"
    :title="t('order.manage.editOrder')"
    body-class="flex-1 overflow-y-auto p-4 lg:p-6"
    :z-index="zIndex"
    @update:model-value="$emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div>
          <h3 class="text-primary text-lg font-semibold">{{ t('order.manage.editOrder') }}</h3>
          <p class="mt-0.5 text-sm text-(--text-secondary)">{{ order?.orderNo }}</p>
        </div>
        <!-- 状态徽章 (只读显示) -->
        <span
          v-if="form.status"
          class="rounded-full border px-2.5 py-0.5 text-xs font-medium"
          :class="getStatusBadgeClass(form.status)"
        >
          {{ t(`order.statuses.${form.status}`) }}
        </span>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <!-- 左侧：表单 -->
      <div class="space-y-5">
        <!-- 商品绑定区域 -->
        <ProductBindingSection
          v-if="showBindingSection"
          :bound-product="boundProduct"
          :mode="mode"
          :sales-token="salesTokenValue"
          :variant-select-policy="variantSelectPolicy"
          @select="handleProductSelect"
          @unbind="unbindProduct"
        />

        <div
          v-if="canShowLineModeToggle && !boundProduct"
          class="flex items-center justify-between rounded-xl border border-(--border-color) bg-(--bg-muted)/50 px-3 py-2"
        >
          <div>
            <div class="text-sm font-medium text-(--text-main)">
              {{
                showLineEditor
                  ? t('order.form.multilineEnabled', '当前为多商品订单模式')
                  : t('order.form.singleLineEnabled', '当前为单商品订单模式')
              }}
            </div>
            <div class="text-xs text-(--text-secondary)">
              {{
                showLineEditor
                  ? t('order.form.multilineHint', '保存时会按明细重写订单行与总数量。')
                  : t('order.form.singleLineHint', '需要多个商品时可切换到多行明细模式。')
              }}
            </div>
          </div>
          <AppButton type="button" variant="secondary" size="sm" @click="toggleLineEditor">
            {{
              showLineEditor
                ? t('order.form.backToSingleLine', '切回单行')
                : t('order.form.enableMultiline', '启用多行')
            }}
          </AppButton>
        </div>

        <OrderLinesEditor v-if="showLineEditor" v-model="lines" />

        <OrderFormFields
          :model-value="form"
          :show-status="mode === 'admin'"
          :statuses="statuses"
          :salespersons="salespersons"
          :disabled-fields="disabledFields"
          :bound-product-variant="boundProductVariant"
          :line-mode="effectiveLineMode"
          @update:model-value="updateForm"
        />
      </div>

      <!-- 右侧：原始信息 & 图片 -->
      <div class="space-y-6">
        <!-- 图片管理 -->
        <div>
          <h4 class="text-primary mb-3 border-b border-(--border-subtle) pb-2 text-sm font-medium">
            {{ t('order.detail.images') }}
          </h4>
          <ImageUploader
            ref="uploaderRef"
            v-model="uploadedFiles"
            :upload-endpoint="uploadEndpoint"
            :max-files="9"
            deferred
          />
        </div>

        <!-- 原始信息对比 -->
        <OrderOriginalInfo :data="originalData" />
      </div>
    </div>

    <!-- Danger Zone (Admin Only) -->
    <div
      v-if="mode === 'admin'"
      class="border-danger/30 bg-danger/5 mt-8 rounded-2xl border p-4 sm:p-5"
    >
      <h3 class="mb-2 flex items-center gap-2 text-base font-bold text-(--text-main)">
        <AppIcon name="exclamation-triangle" class="text-danger size-4" />
        {{ t('order.detail.dangerZone') || '危险区域 / Danger Zone' }}
      </h3>
      <div class="sm:flex sm:items-center sm:justify-between">
        <p class="mb-4 text-sm text-(--text-secondary) sm:mb-0 sm:max-w-xl">
          {{
            t('order.detail.dangerWarning') ||
            '此操作不可逆。订单及其关联的客户信息、图片文件、留言和所有历史记录将被永久擦除。建议优先使用“作废”功能。'
          }}
        </p>
        <AppButton
          variant="danger"
          class="w-full shrink-0 sm:w-auto"
          @click="$emit('delete-order')"
        >
          {{ t('order.detail.deletePermanently') || '彻底删除订单' }}
        </AppButton>
      </div>
    </div>

    <template #footer>
      <AppButton variant="outline" @click="$emit('close')">
        {{ t('common.cancel') }}
      </AppButton>
      <AppButton
        variant="primary"
        :disabled="!isValid || submitting"
        :loading="submitting"
        @click="handleSaveClick"
      >
        {{ t('common.save') }}
      </AppButton>
    </template>

    <!-- Reason Input Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      :confirm-text="t('common.save')"
      show-input
      input-required
      :input-label="t('order.manage.editReason')"
      :input-placeholder="t('order.manage.editReasonPlaceholder')"
      @confirm="handleConfirmSave"
    />
  </Modal>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import { getStatusBadgeClass } from '@/utils/status';
import { generateRandomId } from '@/utils/common';
import {
  resolveHistoricalOrderProductName,
  resolveOrderQuantity,
  resolveOrderSnapshotField,
} from '@/utils/order-display';
import { resolveSelectedVariantMainImageSrc } from '@/utils/product-image.js';
import { ORDER_BOUND_SNAPSHOT_FIELDS } from '@/utils/order-binding-fields.js';
import { useSalesToken } from '@/composables/useSalesToken';
import { parseJsonObject } from '@/utils/json.js';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import OrderFormFields from './order/OrderFormFields.vue';
import OrderOriginalInfo from './order/OrderOriginalInfo.vue';
import ImageUploader from '@/components/common/ImageUploader.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import OrderLinesEditor from '@/components/order/OrderLinesEditor.vue';
import { createEmptyOrderLine } from '@/composables/useOrderForm';

const props = defineProps({
  order: { type: Object, required: true },
  submitting: Boolean,
  mode: { type: String, default: 'admin' },
  statuses: {
    type: Array,
    default: () => [
      'pending',
      'confirmed',
      'production',
      'shipping',
      'arrived',
      'fulfilled',
      'rejected',
      'void',
    ],
  },
  salespersons: {
    type: Array,
    default: () => [],
  },
  zIndex: { type: [Number, String], default: 100 },
  variantSelectPolicy: { type: String, default: 'in_stock_only' },
});

const emit = defineEmits(['close', 'submit', 'delete-order']);

const { t } = useI18n();
const editReason = ref('');
const uploadedFiles = ref([]);
const lines = ref([createEmptyOrderLine()]);
const lineEditorEnabled = ref(false);

// 商品绑定状态
const boundProduct = ref(null);
const selectedProductId = ref(null);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'warning',
  loading: false,
});

// 表单数据
const form = reactive({
  status: '',
  name: '',
  brand: '',
  series: '',
  sku: '',
  size: '',
  color: '',
  material: '',
  quantity: 1,
  remark: '',
  deadline: '',
  salespersonId: '',
});

const STRUCTURAL_EDITABLE_STATUSES = new Set(['pending', 'rejected', 'void']);
const canEditBinding = computed(() =>
  STRUCTURAL_EDITABLE_STATUSES.has(
    String(props.order?.status || '')
      .trim()
      .toLowerCase()
  )
);
const supportsLineEditing = computed(() => props.mode === 'admin');
const canShowLineModeToggle = computed(() => supportsLineEditing.value && canEditBinding.value);
const QUANTITY_EDITABLE_STATUSES = new Set(['pending', 'confirmed', 'rejected', 'void']);
const canEditQuantity = computed(() =>
  QUANTITY_EDITABLE_STATUSES.has(
    String(props.order?.status || '')
      .trim()
      .toLowerCase()
  )
);

// 绑定商品后锁定的字段
const LOCKED_FIELDS = ORDER_BOUND_SNAPSHOT_FIELDS;
const disabledFields = computed(() => {
  const fields = boundProduct.value ? [...LOCKED_FIELDS] : [];
  if (!canEditQuantity.value) fields.push('quantity');
  return fields;
});

const boundProductVariant = ref(null);
const showLineEditor = computed(
  () => canShowLineModeToggle.value && !boundProduct.value && lineEditorEnabled.value
);

const updateForm = (newVal) => {
  Object.assign(form, newVal);
};

const normalizeEditableText = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const buildLineBoundProduct = (line = {}, fallback = {}) => {
  const source = line.boundProduct || fallback.boundProduct;
  if (source) return source;

  const productId = line.productId ?? fallback.productId ?? null;
  const variantId = line.variantId ?? fallback.variantId ?? null;
  if (!productId && !variantId) return null;

  return {
    id: productId,
    name: normalizeEditableText(
      line.name ?? line.snapshotName ?? line.productName,
      normalizeEditableText(fallback.name ?? fallback.snapshotName ?? fallback.productName)
    ),
    sku: normalizeEditableText(line.sku, normalizeEditableText(fallback.sku)),
    brand: normalizeEditableText(line.brand, normalizeEditableText(fallback.brand)),
    series: normalizeEditableText(line.series, normalizeEditableText(fallback.series)),
    variantId,
    mainImage: line.mainImage ?? fallback.mainImage ?? null,
  };
};

const normalizeEditableLine = (line = {}, fallback = {}) =>
  createEmptyOrderLine({
    clientId: line.clientId ?? fallback.clientId,
    name: normalizeEditableText(
      line.name ?? line.snapshotName ?? line.productName,
      normalizeEditableText(fallback.name ?? fallback.snapshotName ?? fallback.productName)
    ),
    brand: normalizeEditableText(line.brand, normalizeEditableText(fallback.brand)),
    category: normalizeEditableText(line.category, normalizeEditableText(fallback.category)),
    series: normalizeEditableText(line.series, normalizeEditableText(fallback.series)),
    sku: normalizeEditableText(line.sku, normalizeEditableText(fallback.sku)),
    size: normalizeEditableText(line.size, normalizeEditableText(fallback.size)),
    color: normalizeEditableText(line.color, normalizeEditableText(fallback.color)),
    material: normalizeEditableText(line.material, normalizeEditableText(fallback.material)),
    remark: normalizeEditableText(line.remark, normalizeEditableText(fallback.remark)),
    deadline: normalizeEditableText(line.deadline, normalizeEditableText(fallback.deadline)),
    quantity: Math.max(1, Math.trunc(Number(line.quantity ?? line.orderedQuantity ?? 1) || 1)),
    productId: line.productId ?? fallback.productId ?? null,
    variantId: line.variantId ?? fallback.variantId ?? null,
    boundProduct: buildLineBoundProduct(line, fallback),
    boundProductVariant: line.boundProductVariant ?? fallback.boundProductVariant ?? null,
  });

const serializeEditableLine = (line = {}) => {
  const normalized = normalizeEditableLine(line);
  return {
    name: normalized.name,
    brand: normalized.brand,
    category: normalizeEditableText(normalized.category),
    series: normalized.series,
    sku: normalized.sku,
    size: normalized.size,
    color: normalized.color,
    material: normalized.material,
    remark: normalizeEditableText(normalized.remark),
    deadline: normalizeEditableText(normalized.deadline),
    quantity: Math.max(1, Math.trunc(Number(normalized.quantity ?? 1) || 1)),
    productId: normalized.productId ?? null,
    variantId: normalized.variantId ?? null,
  };
};

const serializeEditableLineSignature = (value = []) =>
  JSON.stringify((Array.isArray(value) ? value : []).map((line) => serializeEditableLine(line)));

const buildEditableLinesFromOrder = (order = {}) => {
  const rawLines = Array.isArray(order.currentData?.lines)
    ? order.currentData.lines.filter(Boolean)
    : [];
  const persistedLines = Array.isArray(order.lines) ? order.lines.filter(Boolean) : [];
  if (rawLines.length > 0) {
    return rawLines.map((line, index) => normalizeEditableLine(line, persistedLines[index] || {}));
  }
  if (persistedLines.length > 0) {
    return persistedLines.map((line) => normalizeEditableLine(line));
  }
  return [
    normalizeEditableLine({
      name: resolveHistoricalOrderProductName(order),
      brand: resolveOrderSnapshotField(order, 'brand'),
      series: resolveOrderSnapshotField(order, 'series'),
      sku: resolveOrderSnapshotField(order, 'sku'),
      size: resolveOrderSnapshotField(order, 'size'),
      color: resolveOrderSnapshotField(order, 'color'),
      material: resolveOrderSnapshotField(order, 'material'),
      quantity: resolveOrderQuantity(order),
    }),
  ];
};

const buildNormalizedSubmitLines = (value = lines.value) =>
  (Array.isArray(value) ? value : [])
    .map((line) => serializeEditableLine(line))
    .filter((line) => Boolean(line.name || line.sku || line.brand || line.series));

const buildCurrentLineFromForm = () =>
  createEmptyOrderLine({
    name: form.name,
    brand: form.brand,
    series: form.series,
    sku: form.sku,
    size: form.size,
    color: form.color,
    material: form.material,
    quantity: form.quantity,
    productId: selectedProductId.value ?? null,
    variantId: selectedProductId.value ? (boundProduct.value?.variantId ?? null) : null,
    boundProduct: boundProduct.value ? { ...boundProduct.value } : null,
    boundProductVariant: boundProductVariant.value ?? null,
  });

const applyLineToForm = (line = {}) => {
  form.name = line.name || '';
  form.brand = line.brand || '';
  form.series = line.series || '';
  form.sku = line.sku || '';
  form.size = line.size || '';
  form.color = line.color || '';
  form.material = line.material || '';
  form.quantity = Number(line.quantity || 1);
};

const buildBoundVariantSnapshot = (currentData = {}) => {
  const snapshot = {};
  if (currentData.color) snapshot[t('order.form.color')] = currentData.color;
  if (currentData.material) snapshot[t('order.form.material')] = currentData.material;
  if (currentData.size) snapshot[t('order.form.size')] = currentData.size;
  return snapshot;
};

const handleProductSelect = (product) => {
  if (!canEditBinding.value) return;
  const variant = product.selectedVariant;
  if (!variant) return;
  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: variant.sku,
    brand: product.brand,
    series: product.series,
    variantId: variant.id,
    mainImage: getProductMainImage(product),
  };
  selectedProductId.value = product.id;

  // Extract variant specs
  let options = variant.options_values || {};
  options = parseJsonObject(options, {});

  let extractedColor = '';
  let extractedMaterial = '';
  const otherSpecs = [];
  const mappedOptions = {};
  const dimensionMap = product.dimension_map || {};

  for (const [key, val] of Object.entries(options)) {
    if (!val) continue;
    const readableKey = dimensionMap[key] || key;
    mappedOptions[readableKey] = val;
    const lowerKey = String(readableKey).toLowerCase();
    if (['color', '颜色', '顏色'].includes(lowerKey)) {
      extractedColor = String(val);
    } else if (['material', '材质', '材質'].includes(lowerKey)) {
      extractedMaterial = String(val);
    } else {
      otherSpecs.push(`${readableKey}: ${val}`);
    }
  }

  // 自动填充表单字段
  form.name = product.name || '';
  form.brand = product.brand || '';
  form.series = product.series || '';
  form.sku = variant.sku || '';
  form.color = extractedColor;
  form.material = extractedMaterial;
  form.size = otherSpecs.join('，') || '';
  boundProductVariant.value = mappedOptions;
  lines.value = [buildCurrentLineFromForm()];
  lineEditorEnabled.value = false;

  // Auto-fill image
  const mainImage = getProductMainImage(product);
  if (mainImage) {
    // Check if already exists to avoid duplicates
    const exists = uploadedFiles.value.some((f) => f.url === mainImage);
    if (!exists) {
      uploadedFiles.value.push({
        url: mainImage,
        isLocal: false, // Treat as remote/pre-filled
        isPrefill: true,
        id: generateRandomId('prefill'),
      });
    }
  }
};

const unbindProduct = () => {
  if (!canEditBinding.value) return;
  boundProduct.value = null;
  selectedProductId.value = null;
  boundProductVariant.value = null;
};

const getProductMainImage = (product) => resolveSelectedVariantMainImageSrc(product);

// 存储初始值快照
const initialValues = ref({
  status: '',
  name: '',
  brand: '',
  series: '',
  sku: '',
  size: '',
  color: '',
  material: '',
  quantity: 1,
  remark: '',
  deadline: '',
  fileIds: '',
  productId: null,
  variantId: null,
  lineSignature: '',
  lineCount: 1,
});

const initializedId = ref(null);
const initialLineCount = computed(() => Number(initialValues.value.lineCount || 1));
const isInitiallyMultiline = computed(() => initialLineCount.value > 1);
const showBindingSection = computed(() => props.mode === 'admin' || !isInitiallyMultiline.value);
const effectiveLineMode = computed(
  () => showLineEditor.value || (props.mode === 'sales' && isInitiallyMultiline.value)
);
const getStructuralSubmitLines = () => {
  if (showLineEditor.value) return buildNormalizedSubmitLines(lines.value);
  if (supportsLineEditing.value && isInitiallyMultiline.value) {
    return buildNormalizedSubmitLines([buildCurrentLineFromForm()]);
  }
  return [];
};
const hasExplicitLineMutation = computed(() => {
  const structuralLines = getStructuralSubmitLines();
  if (structuralLines.length === 0) return false;
  return serializeEditableLineSignature(structuralLines) !== initialValues.value.lineSignature;
});

// 初始化数据
watch(
  () => props.order,
  (newOrder) => {
    if (newOrder && newOrder.id !== initializedId.value) {
      initializedId.value = newOrder.id;
      // Ensure currentData exists
      const current = newOrder.currentData || {};
      const historicalProductName = resolveHistoricalOrderProductName(newOrder);
      const historicalBrand = resolveOrderSnapshotField(newOrder, 'brand');
      const historicalSeries = resolveOrderSnapshotField(newOrder, 'series');
      const historicalSku = resolveOrderSnapshotField(newOrder, 'sku');
      const historicalSize = resolveOrderSnapshotField(newOrder, 'size');
      const historicalColor = resolveOrderSnapshotField(newOrder, 'color');
      const historicalMaterial = resolveOrderSnapshotField(newOrder, 'material');
      const historicalRemark = resolveOrderSnapshotField(newOrder, 'remark');
      const historicalDeadline = resolveOrderSnapshotField(newOrder, 'deadline');

      form.status = newOrder.status || 'pending';
      form.name = historicalProductName;
      form.brand = historicalBrand;
      form.series = historicalSeries;
      form.sku = historicalSku;
      form.size = historicalSize;
      form.color = historicalColor;
      form.material = historicalMaterial;
      form.quantity = resolveOrderQuantity(newOrder);
      form.remark = historicalRemark;
      form.deadline = historicalDeadline;
      const editableLines = buildEditableLinesFromOrder(newOrder);
      lines.value = editableLines;
      lineEditorEnabled.value = editableLines.length > 1;

      // 初始化已绑定商品
      if (newOrder.productId) {
        selectedProductId.value = newOrder.productId;
        // 已绑定时显示基本信息
        boundProduct.value = {
          id: newOrder.productId,
          name: historicalProductName,
          sku: historicalSku,
          brand: historicalBrand,
          series: historicalSeries,
          variantId: newOrder.variantId || null,
          mainImage: newOrder.mainImage || null, // Assuming this comes from order join
        };
        // 编辑已有绑定订单时，规格字段也必须进入只读锁定状态
        boundProductVariant.value = buildBoundVariantSnapshot(current);
      } else {
        selectedProductId.value = null;
        boundProduct.value = null;
        boundProductVariant.value = null;
      }

      initialValues.value = {
        status: newOrder.status || 'pending',
        name: historicalProductName,
        brand: historicalBrand,
        series: historicalSeries,
        sku: historicalSku,
        size: historicalSize,
        color: historicalColor,
        material: historicalMaterial,
        quantity: resolveOrderQuantity(newOrder),
        remark: historicalRemark,
        deadline: historicalDeadline,
        fileIds: (newOrder.files || [])
          .map((f) => f.id)
          .sort()
          .join(','),
        productId: newOrder.productId || null,
        variantId: newOrder.variantId || null,
        salespersonId: newOrder.salespersonId || '',
        lineSignature: serializeEditableLineSignature(editableLines),
        lineCount: editableLines.length,
      };

      form.salespersonId = newOrder.salespersonId || '';

      uploadedFiles.value = (newOrder.files || []).map((f) => ({
        id: f.id,
        url: f.url,
      }));
    }
  },
  { immediate: true }
);

const originalData = computed(() => ({
  ...(props.order.originalData || {}),
  name: resolveHistoricalOrderProductName(props.order),
  brand: resolveOrderSnapshotField(props.order, 'brand'),
  series: resolveOrderSnapshotField(props.order, 'series'),
  sku: resolveOrderSnapshotField(props.order, 'sku'),
  size: resolveOrderSnapshotField(props.order, 'size'),
  color: resolveOrderSnapshotField(props.order, 'color'),
  material: resolveOrderSnapshotField(props.order, 'material'),
  remark: resolveOrderSnapshotField(props.order, 'remark'),
  deadline: resolveOrderSnapshotField(props.order, 'deadline'),
}));

const getCurrentBindingState = () => {
  const productId = selectedProductId.value ?? null;
  const variantId = productId ? (boundProduct.value?.variantId ?? null) : null;
  return { productId, variantId };
};

// 检查是否有变更
const hasChanges = computed(() => {
  if (!props.order) return false;
  const init = initialValues.value;
  const currentBinding = getCurrentBindingState();

  // 检查商品绑定变更
  if (currentBinding.productId !== init.productId) return true;
  if (currentBinding.variantId !== init.variantId) return true;
  if (hasExplicitLineMutation.value) return true;

  const fieldsChanged =
    form.name !== init.name ||
    form.brand !== init.brand ||
    form.series !== init.series ||
    form.sku !== init.sku ||
    form.size !== init.size ||
    form.color !== init.color ||
    form.material !== init.material ||
    form.quantity !== init.quantity ||
    form.remark !== init.remark ||
    form.deadline !== init.deadline;

  if (props.mode === 'admin' && form.status !== init.status) return true;
  if (props.mode === 'admin' && form.salespersonId !== init.salespersonId) return true;
  if (fieldsChanged) return true;

  // Check for new files (no ID) or count mismatch
  const currentFiles = uploadedFiles.value;
  const newLocalFiles = currentFiles.some((f) => !f.id && f.isLocal);
  if (newLocalFiles) return true;

  // Check for removed files (ID mismatch)
  const newIds = currentFiles
    .filter((f) => f.id && !f.isLocal && !f.isPrefill)
    .map((f) => f.id)
    .sort()
    .join(',');
  return init.fileIds !== newIds;
});

const { token: salesToken } = useSalesToken();
const salesTokenValue = computed(() => salesToken.value || '');

const uploadEndpoint = computed(() => {
  const orderId = props.order?.id;
  if (props.mode === 'sales') {
    const base = API.SALES_UPLOAD(salesTokenValue.value);
    return orderId ? `${base}?orderId=${orderId}` : base;
  }
  return orderId ? `${API.MANAGE_UPLOAD}?orderId=${orderId}` : API.MANAGE_UPLOAD;
});

const isValid = computed(() => {
  if (!hasChanges.value) return false;
  if (showLineEditor.value) {
    return lines.value.some((line) => String(line?.name || '').trim());
  }
  if (hasExplicitLineMutation.value) {
    return getStructuralSubmitLines().length > 0;
  }
  return true;
});

const toggleLineEditor = () => {
  if (!canShowLineModeToggle.value || boundProduct.value) return;
  if (showLineEditor.value) {
    const collapsedLine = normalizeEditableLine(lines.value[0] || buildCurrentLineFromForm());
    applyLineToForm(collapsedLine);
    lines.value = [collapsedLine];
    lineEditorEnabled.value = false;
    return;
  }

  lines.value = [buildCurrentLineFromForm(), createEmptyOrderLine()];
  lineEditorEnabled.value = true;
};

const handleSaveClick = () => {
  if (!isValid.value) return;

  // Reset reason and show dialog
  editReason.value = '';
  confirmData.value = {
    show: true,
    title: t('order.manage.saveChanges'),
    message: t('order.manage.editReasonRequired'),
    type: 'warning',
    loading: false,
  };
};

const handleConfirmSave = (reason) => {
  editReason.value = reason;
  handleSubmit();
};

const uploaderRef = ref(null);

const handleSubmit = async () => {
  if (!isValid.value) return;

  confirmData.value.loading = true;

  try {
    if (uploaderRef.value) {
      const uploadSuccess = await uploaderRef.value.uploadPendingFiles();
      if (!uploadSuccess) return;
      await nextTick();
    }

    const updates = {};
    const init = initialValues.value;
    const structuralLines = getStructuralSubmitLines();
    if (hasExplicitLineMutation.value) {
      const primaryLine = structuralLines[0];
      updates.name = primaryLine.name;
      updates.brand = primaryLine.brand;
      updates.category = primaryLine.category;
      updates.series = primaryLine.series;
      updates.sku = primaryLine.sku;
      updates.size = primaryLine.size;
      updates.color = primaryLine.color;
      updates.material = primaryLine.material;
      updates.quantity = structuralLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
      updates.lines = structuralLines;
    } else {
      if (form.name !== init.name) updates.name = form.name;
      if (form.brand !== init.brand) updates.brand = form.brand;
      if (form.series !== init.series) updates.series = form.series;
      if (form.sku !== init.sku) updates.sku = form.sku;
      if (form.size !== init.size) updates.size = form.size;
      if (form.color !== init.color) updates.color = form.color;
      if (form.material !== init.material) updates.material = form.material;
      if (form.quantity !== init.quantity) updates.quantity = form.quantity;
    }
    if (form.remark !== init.remark) updates.remark = form.remark;
    if (form.deadline !== init.deadline) updates.deadline = form.deadline;

    // 移除状态更新逻辑，状态变更应使用 OrderStatusChanger 专用 API
    if (props.mode === 'admin' && form.status !== init.status) {
      updates.status = form.status;
    }
    if (props.mode === 'admin' && form.salespersonId !== init.salespersonId) {
      updates.salespersonId = form.salespersonId;
    }

    const oldIds = (props.order.files || [])
      .map((f) => f.id)
      .sort()
      .join(',');
    const currentFiles = uploadedFiles.value.filter((f) => f.id && !f.isLocal && !f.isPrefill);

    const newIds = currentFiles
      .map((f) => f.id)
      .sort()
      .join(',');

    const payload = {
      updates,
      reason: editReason.value,
    };

    // 商品绑定变更：绑定时要求 variantId，解绑时显式传 null
    const currentBinding = getCurrentBindingState();
    if (currentBinding.productId && !currentBinding.variantId) return;
    if (currentBinding.productId !== init.productId) {
      payload.productId = currentBinding.productId;
    }
    if (currentBinding.variantId !== init.variantId) {
      payload.variantId = currentBinding.variantId;
    }

    if (oldIds !== newIds) {
      payload.fileIds = currentFiles.map((f) => f.id);
    }

    emit('submit', payload);
  } finally {
    confirmData.value.loading = false;
    confirmData.value.show = false;
  }
};
</script>
