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
          <p class="text-secondary-text mt-0.5 text-sm">{{ order?.orderNo }}</p>
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
        <div class="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <svg class="size-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {{ t('order.binding.title') }}
          </h4>

          <!-- 已绑定商品卡片 -->
          <div v-if="boundProduct" class="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
            <div class="size-12 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-600">
              <AppImage 
                v-if="boundProduct.mainImage" 
                :src="boundProduct.mainImage" 
                fit="cover" 
                class="size-full" 
              />
              <div v-else class="flex h-full items-center justify-center text-slate-300">
                <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium text-slate-800 dark:text-slate-100">{{ boundProduct.name }}</div>
              <div class="mt-0.5 text-xs text-slate-500">SKU: {{ boundProduct.sku }}</div>
            </div>
            <button 
              type="button" 
              class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
              :title="t('order.binding.unbind')"
              @click="unbindProduct"
            >
              <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 商品搜索选择器 -->
          <div v-else>
            <p class="mb-2 text-xs text-slate-500">{{ t('order.binding.hint') }}</p>
            <ProductSelect @select="handleProductSelect" />
          </div>
        </div>

        <OrderFormFields
          :model-value="form"
          :show-status="mode === 'admin'"
          :statuses="statuses"
          :disabled-fields="disabledFields"
          @update:model-value="updateForm"
        />
      </div>

      <!-- 右侧：原始信息 & 图片 -->
      <div class="space-y-6">
        <!-- 图片管理 -->
        <div>
          <h4
            class="text-primary border-border mb-3 border-b pb-2 text-sm font-medium"
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

    <template #footer>
      <button
        class="text-secondary-text border-border rounded-lg border px-5 py-2 font-medium transition-colors hover:bg-surface-hover"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :class="[
          !isValid || submitting ? 'cursor-not-allowed opacity-50' : 'hover:bg-primary-hover',
          'bg-primary shadow-primary/20 flex items-center rounded-lg px-5 py-2 font-medium text-white shadow-lg transition-colors dark:text-surface'
        ]"
        :disabled="!isValid || submitting"
        @click="handleSaveClick"
      >
        <svg
          v-if="submitting"
          class="mr-2 size-4 animate-spin"
          fill="none"
          stroke="currentColor"
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
import { useSalesToken } from '@/composables/useSalesToken';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import OrderFormFields from './order/OrderFormFields.vue';
import OrderOriginalInfo from './order/OrderOriginalInfo.vue';
import ImageUploader from '@/components/common/ImageUploader.vue';
import ProductSelect from '@/components/product/ProductSelect.vue';
import AppImage from '@/components/ui/AppImage.vue';

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
  zIndex: { type: [Number, String], default: 100 },
});

const emit = defineEmits(['close', 'submit']);

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
  remark: '',
  deadline: '',
});

// 绑定商品后锁定的字段
const LOCKED_FIELDS = ['name', 'brand', 'series', 'sku'];
const disabledFields = computed(() => boundProduct.value ? LOCKED_FIELDS : []);

const updateForm = (newVal) => {
  Object.assign(form, newVal);
};

// 商品选择处理
const handleProductSelect = (product) => {
  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: product.sku,
    brand: product.brand,
    series: product.series,
    mainImage: getProductMainImage(product),
  };
  selectedProductId.value = product.id;

  // 自动填充表单字段
  form.name = product.name || '';
  form.brand = product.brand || '';
  form.series = product.series || '';
  form.sku = product.sku || '';
};

const unbindProduct = () => {
  boundProduct.value = null;
  selectedProductId.value = null;
};

const getProductMainImage = (product) => {
  try {
    if (!product.images) return null;
    const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    return Array.isArray(imgs) && imgs.length > 0 ? `/file/${imgs[0]}` : null;
  } catch { return null; }
};

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
  remark: '',
  deadline: '',
  fileIds: '',
  productId: null,
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
      
      form.status = newOrder.status || 'pending';
      form.name = current.name || '';
      form.brand = current.brand || '';
      form.series = current.series || '';
      form.sku = current.sku || '';
      form.size = current.size || '';
      form.color = current.color || '';
      form.material = current.material || '';
      form.remark = current.remark || '';
      form.deadline = current.deadline || '';

      // 初始化已绑定商品
      if (newOrder.productId) {
        selectedProductId.value = newOrder.productId;
        // 已绑定时显示基本信息
        boundProduct.value = {
          id: newOrder.productId,
          name: current.name || '', // Prefer current order data
          sku: current.sku || '',
          brand: current.brand || '',
          series: current.series || '',
          mainImage: newOrder.mainImage || null, // Assuming this comes from order join
        };
      } else {
        selectedProductId.value = null;
        boundProduct.value = null;
      }

      initialValues.value = {
        status: newOrder.status || 'pending',
        name: current.name || '',
        brand: current.brand || '',
        series: current.series || '',
        sku: current.sku || '',
        size: current.size || '',
        color: current.color || '',
        material: current.material || '',
        remark: current.remark || '',
        deadline: current.deadline || '',
        fileIds: (newOrder.files || []).map((f) => f.id).sort().join(','),
        productId: newOrder.productId || null,
      };

      uploadedFiles.value = (newOrder.files || []).map((f) => ({
        id: f.id,
        url: f.url,
      }));
    }
  },
  { immediate: true }
);



const originalData = computed(() => props.order.originalData || {});

// 检查是否有变更
const hasChanges = computed(() => {
  if (!props.order) return false;
  const init = initialValues.value;

  // 检查商品绑定变更
  if (selectedProductId.value !== init.productId) return true;

  const fieldsChanged =
    form.name !== init.name ||
    form.brand !== init.brand ||
    form.series !== init.series ||
    form.sku !== init.sku ||
    form.size !== init.size ||
    form.color !== init.color ||
    form.material !== init.material ||
    form.remark !== init.remark ||
    form.deadline !== init.deadline;

  if (props.mode === 'admin' && form.status !== init.status) return true;
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
  if (form.remark !== init.remark) updates.remark = form.remark;
  if (form.deadline !== init.deadline) updates.deadline = form.deadline;

  // 移除状态更新逻辑，状态变更应使用 OrderStatusChanger 专用 API
  if (props.mode === 'admin' && form.status !== init.status) {
    updates.status = form.status;
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

  // 添加商品绑定ID
  if (selectedProductId.value !== init.productId) {
    payload.productId = selectedProductId.value;
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
