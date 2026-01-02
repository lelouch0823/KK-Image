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
        <div>
          <h4
            class="text-primary mb-4 border-b border-[var(--border-color)] pb-2 text-sm font-medium"
          >
            {{ t('order.detail.currentInfo') }}
          </h4>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- 状态修改 (仅如有权限) -->
            <div v-if="mode === 'admin'" class="sm:col-span-2">
              <label class="text-secondary mb-1.5 block text-xs font-medium">{{
                t('order.manage.orderStatus')
              }}</label>
              <select v-model="form.status" class="input h-11">
                <option v-for="s in statuses" :key="s" :value="s">
                  {{ t(`order.statuses.${s}`) }}
                </option>
              </select>
            </div>
            <!-- 商品名称 (全宽) -->
            <div class="md:col-span-2">
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.productName')
              }}</label>
              <input v-model="form.name" class="input" />
            </div>

            <!-- 品牌 -->
            <div>
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.brand')
              }}</label>
              <input v-model="form.brand" class="input" />
            </div>

            <!-- 系列 -->
            <div>
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.series')
              }}</label>
              <input v-model="form.series" class="input" />
            </div>

            <!-- 规格尺寸 -->
            <div>
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.size')
              }}</label>
              <input v-model="form.size" class="input" />
            </div>

            <!-- 颜色 -->
            <div>
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.color')
              }}</label>
              <input v-model="form.color" class="input" />
            </div>

            <!-- 材质 -->
            <div>
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.material')
              }}</label>
              <input v-model="form.material" class="input" />
            </div>

            <!-- 期望到货时间 -->
            <div>
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.expectedArrival')
              }}</label>
              <input
                v-model="form.deadline"
                type="date"
                :min="minDate"
                class="input appearance-none bg-white"
                :class="{ 'text-muted': !form.deadline }"
              />
            </div>

            <!-- 备注 (全宽) -->
            <div class="md:col-span-2">
              <label class="text-secondary mb-1 block text-xs font-medium">{{
                t('order.form.remark')
              }}</label>
              <textarea
                v-model="form.remark"
                rows="3"
                class="input h-auto resize-none py-2"
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：原始信息 & 图片 -->
      <div class="space-y-6">
        <!-- 图片管理 (放在右侧上方) -->
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
        <div>
          <h4
            class="text-primary mb-3 border-b border-[var(--border-color)] pb-2 text-sm font-medium"
          >
            {{ t('order.detail.originalInfo') }}
          </h4>
          <div
            class="text-secondary grid grid-cols-2 gap-3 rounded-lg bg-[var(--bg-muted)] p-4 text-sm"
          >
            <div>
              <span class="text-muted block text-xs">{{ t('order.form.productName') }}</span>
              <span class="text-primary font-medium">{{ originalData.name || '-' }}</span>
            </div>
            <div>
              <span class="text-muted block text-xs">{{ t('order.form.brand') }}</span>
              <span class="text-primary">{{ originalData.brand || '-' }}</span>
            </div>
            <div>
              <span class="text-muted block text-xs">{{ t('order.form.series') }}</span>
              <span class="text-primary">{{ originalData.series || '-' }}</span>
            </div>
            <div>
              <span class="text-muted block text-xs">{{ t('order.form.size') }}</span>
              <span class="text-primary">{{ originalData.size || '-' }}</span>
            </div>
            <div>
              <span class="text-muted block text-xs">{{ t('order.form.color') }}</span>
              <span class="text-primary">{{ originalData.color || '-' }}</span>
            </div>
            <div>
              <span class="text-muted block text-xs">{{ t('order.form.material') }}</span>
              <span class="text-primary">{{ originalData.material || '-' }}</span>
            </div>
            <!-- 期望到货时间 (全宽) -->
            <div class="col-span-2 flex items-start gap-2">
              <span class="text-muted block w-24 flex-shrink-0 pt-0.5 text-xs whitespace-nowrap">{{
                t('order.form.expectedArrival')
              }}</span>
              <span class="text-primary">{{ formatDateWithWeekday(originalData.deadline) }}</span>
            </div>
            <div class="col-span-2 flex items-start gap-2">
              <span class="text-muted block w-24 flex-shrink-0 pt-0.5 text-xs">{{
                t('order.form.remark')
              }}</span>
              <p class="text-primary whitespace-pre-wrap">{{ originalData.remark || '-' }}</p>
            </div>
          </div>
        </div>
    </div>

    <!-- 修改理由 (必填) - 移动到左侧表单下方 -->
    <div class="mt-4 border-t border-[var(--border-color)] pt-4">
      <label class="text-primary mb-2 block text-sm font-medium">
        {{ t('order.manage.editReason') }} <span class="text-danger">*</span>
      </label>
      <input
        ref="reasonInputRef"
        v-model="editReason"
        type="text"
        :placeholder="t('order.manage.editReasonPlaceholder')"
        class="bg-warning-bg border-warning/20 text-warning-text placeholder-warning-text/40 w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-warning/40 focus:border-warning"
      />
      <p class="text-warning-text mt-1.5 flex items-center text-xs">
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
          'bg-primary shadow-primary/20 flex items-center rounded-lg px-5 py-2 font-medium text-white shadow-lg transition-colors'
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
import { getTodayISOString } from '@/utils/common';
import { formatDateWithWeekday } from '@/utils/formatters';
import { getStatusBadgeClass } from '@/utils/status';
import { useSalesToken } from '@/composables/useSalesToken';
import ImageUploader from './common/ImageUploader.vue';
import Modal from '@/components/ui/Modal.vue';

const minDate = computed(() => getTodayISOString());

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

// 存储初始值快照 (用于变更检测)
const initialValues = ref({
  status: '',
  name: '',
  brand: '',
  series: '',
  size: '',
  color: '',
  material: '',
  remark: '',
  deadline: '',
  fileIds: '',
});

// 初始化标志 - 确保只初始化一次
const initialized = ref(false);

// 初始化数据 - 只在首次挂载时执行
watch(
  () => props.order,
  (newOrder) => {
    // 只在第一次收到有效订单数据时初始化
    if (newOrder && !initialized.value) {
      initialized.value = true;
      const current = newOrder.currentData || {};
      
      // 设置表单值
      form.status = newOrder.status || 'pending';
      form.name = current.name || '';
      form.brand = current.brand || '';
      form.series = current.series || '';
      form.size = current.size || '';
      form.color = current.color || '';
      form.material = current.material || '';
      form.remark = current.remark || '';
      form.deadline = current.deadline || '';

      // 存储初始值快照 (深拷贝)
      initialValues.value = {
        status: newOrder.status || 'pending',
        name: current.name || '',
        brand: current.brand || '',
        series: current.series || '',
        size: current.size || '',
        color: current.color || '',
        material: current.material || '',
        remark: current.remark || '',
        deadline: current.deadline || '',
        fileIds: (newOrder.files || []).map((f) => f.id).sort().join(','),
      };

      // 初始化文件
      uploadedFiles.value = (newOrder.files || []).map((f) => ({
        id: f.id,
        url: f.url,
      }));
    }
  },
  { immediate: true }
);

const originalData = computed(() => props.order.originalData || {});

// 检查是否有变更 (对比初始值快照)
const hasChanges = computed(() => {
  if (!props.order) return false;
  const init = initialValues.value;

  // 检查字段变更
  const fieldsChanged =
    form.name !== init.name ||
    form.brand !== init.brand ||
    form.series !== init.series ||
    form.size !== init.size ||
    form.color !== init.color ||
    form.material !== init.material ||
    form.remark !== init.remark ||
    form.deadline !== init.deadline;

  // 检查状态变更
  if (props.mode === 'admin' && form.status !== init.status) return true;

  if (fieldsChanged) return true;

  // 检查文件变更
  const newIds = uploadedFiles.value.map((f) => f.id).sort().join(',');
  return init.fileIds !== newIds;
});

const { token: salesToken } = useSalesToken();

// 动态上传地址 (包含 orderId 以便归档)
const uploadEndpoint = computed(() => {
  const orderId = props.order?.id;
  if (props.mode === 'sales') {
    const base = API.SALES_UPLOAD(salesToken.value || '');
    return orderId ? `${base}?orderId=${orderId}` : base;
  }
  return orderId ? `${API.MANAGE_UPLOAD}?orderId=${orderId}` : API.MANAGE_UPLOAD;
});

// 验证逻辑 (所有模式都需要填写修改理由)
const isValid = computed(() => {
  if (!hasChanges.value) return false;
  if (!editReason.value.trim()) return false;
  return true;
});

// 编辑理由输入框引用
const reasonInputRef = ref(null);

// 点击保存按钮处理
const handleSaveClick = () => {
  if (!isValid.value) {
    // 如果有变更但没填理由，滚动到理由输入框并聚焦
    if (hasChanges.value && !editReason.value.trim() && reasonInputRef.value) {
      reasonInputRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
      reasonInputRef.value.focus();
    }
    return;
  }
  handleSubmit();
};

const uploaderRef = ref(null);

// 提交
const handleSubmit = async () => {
  if (!isValid.value) return;

  // 1. 先触发图片上传 (延迟上传模式)
  if (uploaderRef.value) {
    const uploadSuccess = await uploaderRef.value.uploadPendingFiles();
    if (!uploadSuccess) return; // 上传失败终止提交

    // 等待 Vue 更新 uploadedFiles
    await nextTick();
  }

  // 仅提取变更字段
  const updates = {};
  const init = initialValues.value;
  if (form.name !== init.name) updates.name = form.name;
  if (form.brand !== init.brand) updates.brand = form.brand;
  if (form.series !== init.series) updates.series = form.series;
  if (form.size !== init.size) updates.size = form.size;
  if (form.color !== init.color) updates.color = form.color;
  if (form.material !== init.material) updates.material = form.material;
  if (form.remark !== init.remark) updates.remark = form.remark;
  if (form.deadline !== init.deadline) updates.deadline = form.deadline;

  // 状态变更
  if (props.mode === 'admin' && form.status !== init.status) {
    updates.status = form.status;
  }

  // 处理文件变更 - 过滤掉仍在本地的文件（不应该有，因为已上传完成）
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

  // 只有当文件列表真正变化时才包含 fileIds
  if (oldIds !== newIds) {
    payload.fileIds = currentFiles.map((f) => f.id);
  }

  emit('submit', payload);
};
</script>
