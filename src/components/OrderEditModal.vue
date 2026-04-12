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
          :bound-product="boundProduct"
          :variant-select-policy="variantSelectPolicy"
          @select="handleProductSelect"
          @unbind="unbindProduct"
        />

        <OrderFormFields
          :model-value="form"
          :show-status="mode === 'admin'"
          :statuses="statuses"
          :salespersons="salespersons"
          :disabled-fields="disabledFields"
          :bound-product-variant="boundProductVariant"
          @update:model-value="updateForm"
        />
      </div>

      <!-- 右侧：原始信息 & 图片 -->
      <div class="space-y-6">
        <!-- 图片管理 -->
        <div>
          <h4
            class="text-primary mb-3 border-b border-(--border-subtle) pb-2 text-sm font-medium"
          >
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
    <div v-if="mode === 'admin'" class="border-danger/30 bg-danger/5 mt-8 rounded-2xl border p-4 sm:p-5">
      <h3 class="mb-2 flex items-center gap-2 text-base font-bold text-(--text-main)">
        <AppIcon name="exclamation-triangle" class="text-danger size-4" />
        {{ t('order.detail.dangerZone') || '危险区域 / Danger Zone' }}
      </h3>
      <div class="sm:flex sm:items-center sm:justify-between">
        <p class="mb-4 text-sm text-(--text-secondary) sm:mb-0 sm:max-w-xl">
          {{ t('order.detail.dangerWarning') || '此操作不可逆。订单及其关联的客户信息、图片文件、留言和所有历史记录将被永久擦除。建议优先使用“作废”功能。' }}
        </p>
        <button 
          class="focus:ring-danger focus:ring-2 focus:ring-offset-2 bg-danger inline-flex w-full shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-danger/90 sm:w-auto"
          @click="$emit('delete-order')"
        >
          {{ t('order.detail.deletePermanently') || '彻底删除订单' }}
        </button>
      </div>
    </div>

    <template #footer>
      <button
        class="rounded-lg border border-(--border-subtle) px-5 py-2 font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :class="[
          !isValid || submitting ? 'cursor-not-allowed opacity-50' : 'hover:opacity-90',
          'bg-primary shadow-primary/20 flex items-center rounded-lg px-5 py-2 font-medium text-(--text-inverse) shadow-lg transition-all'
        ]"
        :disabled="!isValid || submitting"
        @click="handleSaveClick"
      >
        <AppIcon
          v-if="submitting"
          name="spinner"
          class="mr-2 size-4 animate-spin"
        />
        {{ t('common.save') }}
      </button>
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
import { resolveHistoricalOrderProductName, resolveOrderQuantity, resolveOrderSnapshotField } from '@/utils/order-display';
import { resolveSelectedVariantMainImageSrc } from '@/utils/product-image.js';
import { ORDER_BOUND_SNAPSHOT_FIELDS } from '@/utils/order-binding-fields.js';
import { useSalesToken } from '@/composables/useSalesToken';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import OrderFormFields from './order/OrderFormFields.vue';
import OrderOriginalInfo from './order/OrderOriginalInfo.vue';
import ImageUploader from '@/components/common/ImageUploader.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

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
      'completed',
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
  STRUCTURAL_EDITABLE_STATUSES.has(String(props.order?.status || '').trim().toLowerCase())
);
const QUANTITY_EDITABLE_STATUSES = new Set(['pending', 'confirmed', 'rejected', 'void']);
const canEditQuantity = computed(() =>
  QUANTITY_EDITABLE_STATUSES.has(String(props.order?.status || '').trim().toLowerCase())
);

// 绑定商品后锁定的字段
const LOCKED_FIELDS = ORDER_BOUND_SNAPSHOT_FIELDS;
const disabledFields = computed(() => {
  const fields = boundProduct.value ? [...LOCKED_FIELDS] : [];
  if (!canEditQuantity.value) fields.push('quantity');
  return fields;
});

const boundProductVariant = ref(null);

const updateForm = (newVal) => {
  Object.assign(form, newVal);
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
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { options = {}; }
  }

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

  // Auto-fill image
  const mainImage = getProductMainImage(product);
  if (mainImage) {
    // Check if already exists to avoid duplicates
    const exists = uploadedFiles.value.some(f => f.url === mainImage);
    if (!exists) {
      uploadedFiles.value.push({
        url: mainImage,
        isLocal: false, // Treat as remote/pre-filled
        id: generateRandomId('prefill'), 
        // NOTE: In Edit mode, ImageUploader usually deals with existing (ID+URL) and new (File object).
        // If we pass an object with just URL and no ID, ImageUploader might treat it as a preview?
        // We need to ensure ImageUploader handles { url, isLocal: false } correctly.
        // Assuming it does based on OrderCreateModal logic.
        // Assuming it does based on OrderCreateModal logic.
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
});

const initializedId = ref(null);

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
        fileIds: (newOrder.files || []).map((f) => f.id).sort().join(','),
        productId: newOrder.productId || null,
        variantId: newOrder.variantId || null,
        salespersonId: newOrder.salespersonId || '',
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
  const newLocalFiles = currentFiles.filter(f => !f.id).length > 0;
  if (newLocalFiles) return true;

  // Check for removed files (ID mismatch)
  const newIds = currentFiles.map((f) => f.id).filter(Boolean).sort().join(',');
  return init.fileIds !== newIds;
});

const { token: salesToken } = useSalesToken();

const uploadEndpoint = computed(() => {
  const orderId = props.order?.id;
  if (props.mode === 'sales') {
    const base = API.SALES_UPLOAD(salesToken.value || '');
    return orderId ? `${base}?orderId=${orderId}` : base;
  }
  return orderId ? `${API.MANAGE_UPLOAD}?orderId=${orderId}` : API.MANAGE_UPLOAD;
});

const isValid = computed(() => {
  if (!hasChanges.value) return false;
  return true;
});

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
  if (form.name !== init.name) updates.name = form.name;
  if (form.brand !== init.brand) updates.brand = form.brand;
  if (form.series !== init.series) updates.series = form.series;
  if (form.sku !== init.sku) updates.sku = form.sku;
  if (form.size !== init.size) updates.size = form.size;
  if (form.color !== init.color) updates.color = form.color;
  if (form.material !== init.material) updates.material = form.material;
  if (form.quantity !== init.quantity) updates.quantity = form.quantity;
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
  const currentFiles = uploadedFiles.value.filter((f) => f.id && !f.isLocal);

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
