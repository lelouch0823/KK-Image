<template>
  <!-- 移动端全屏，桌面端 6xl -->
  <Modal
    :model-value="true"
    :size="isMobile ? 'full' : '6xl'"
    :title="t('order.manage.editOrder')"
    :body-class="isMobile ? 'flex-1 overflow-y-auto p-4' : 'flex-1 overflow-y-auto p-6'"
    :z-index="zIndex"
    @update:model-value="$emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div>
          <h3 class="text-primary text-lg font-semibold">{{ t('order.manage.editOrder') }}</h3>
          <p class="text-secondary mt-0.5 text-sm">{{ order?.orderNo }}</p>
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
        <OrderFormFields
          :model-value="form"
          :show-status="mode === 'admin'"
          :statuses="statuses"
          @update:model-value="updateForm"
        />
      </div>

      <!-- 右侧：原始信息 & 图片 -->
      <div class="space-y-6">
        <!-- 图片管理 -->
        <div>
          <h4
            class="text-primary mb-3 border-b border-[var(--border-color)] pb-2 text-sm font-medium"
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

      <!-- 修改理由 (必填) -->
      <div class="col-span-full border-t border-[var(--border-color)] pt-4">
        <label class="text-primary mb-2 block text-sm font-medium">
          {{ t('order.manage.editReason') }} <span class="text-danger">*</span>
        </label>
        <input
          ref="reasonInputRef"
          v-model="editReason"
          type="text"
          :placeholder="t('order.manage.editReasonPlaceholder')"
          class="w-full rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning-bg)]/50 px-4 py-2.5 text-sm text-[var(--color-warning-text)] outline-none transition placeholder:text-[var(--color-warning-text)]/40 focus:border-[var(--color-warning)] focus:ring-1 focus:ring-[var(--color-warning)] dark:bg-[var(--color-warning)]/10 dark:text-[var(--color-warning)] dark:placeholder:text-[var(--color-warning)]/50"
        />
        <p class="mt-1.5 flex items-center text-xs text-[var(--color-warning-text)] dark:text-[var(--color-warning)]">
          <svg class="mr-1 size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          {{ t('order.manage.editReasonRequired') }}
        </p>
      </div>
    </div>

    <template #footer>
      <button
        class="text-secondary rounded-lg border border-[var(--border-color)] px-5 py-2 font-medium transition-colors hover:bg-[var(--bg-hover)]"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :class="[
          !isValid || submitting ? 'cursor-not-allowed opacity-50' : 'hover:bg-primary-hover',
          'bg-primary shadow-primary/20 flex items-center rounded-lg px-5 py-2 font-medium text-white dark:text-gray-900 shadow-lg transition-colors'
        ]"
        :disabled="submitting"
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
  </Modal>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import { getStatusBadgeClass, STATUS_STYLES } from '@/utils/status';
import { useSalesToken } from '@/composables/useSalesToken';
import Modal from '@/components/ui/Modal.vue';
import OrderFormFields from './order/OrderFormFields.vue';
import OrderOriginalInfo from './order/OrderOriginalInfo.vue';
import StatusSelector from '@/components/ui/StatusSelector.vue';
import ImageUploader from '@/components/common/ImageUploader.vue';



// 移动端检测
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const isMobile = computed(() => windowWidth.value < 768);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

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

// 表单数据
const form = reactive({
  status: '',
  name: '',
  brand: '',
  series: '',
  size: '',
  color: '',
  material: '',
  remark: '',
  deadline: '',
});

const updateForm = (newVal) => {
  Object.assign(form, newVal);
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
});

const initialized = ref(false);

// 初始化数据
watch(
  () => props.order,
  (newOrder) => {
    if (newOrder && !initialized.value) {
      initialized.value = true;
      const current = newOrder.currentData || {};
      
      form.status = newOrder.status || 'pending';
      form.name = current.name || '';
      form.brand = current.brand || '';
      form.series = current.series || '';
      form.size = current.size || '';
      form.color = current.color || '';
      form.material = current.material || '';
      form.remark = current.remark || '';
      form.deadline = current.deadline || '';

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

  const newIds = uploadedFiles.value.map((f) => f.id).sort().join(',');
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
  if (!editReason.value.trim()) return false;
  return true;
});

const reasonInputRef = ref(null);

const handleSaveClick = () => {
  if (!isValid.value) {
    if (hasChanges.value && !editReason.value.trim() && reasonInputRef.value) {
      reasonInputRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
      reasonInputRef.value.focus();
    }
    return;
  }
  handleSubmit();
};

const uploaderRef = ref(null);

const handleSubmit = async () => {
  if (!isValid.value) return;

  if (uploaderRef.value) {
    console.warn('[OrderEditModal] Before upload, uploadedFiles:', JSON.stringify(uploadedFiles.value.map(f => ({ id: f.id, isLocal: f.isLocal }))));
    const uploadSuccess = await uploaderRef.value.uploadPendingFiles();
    if (!uploadSuccess) return;
    await nextTick();
    console.warn('[OrderEditModal] After upload, uploadedFiles:', JSON.stringify(uploadedFiles.value.map(f => ({ id: f.id, isLocal: f.isLocal }))));
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
  console.warn('[OrderEditModal] currentFiles for payload:', JSON.stringify(currentFiles.map(f => ({ id: f.id, isLocal: f.isLocal }))));
  const newIds = currentFiles
    .map((f) => f.id)
    .sort()
    .join(',');

  const payload = {
    updates,
    reason: editReason.value,
  };

  if (oldIds !== newIds) {
    payload.fileIds = currentFiles.map((f) => f.id);
  }

  emit('submit', payload);
};
</script>
