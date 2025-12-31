<template>
  <Modal 
    :modelValue="true" 
    size="6xl"
    :title="t('order.manage.editOrder')"
    bodyClass="flex-1 overflow-y-auto p-6"
    @update:modelValue="$emit('close')"
  >
    <template #header>
        <div class="flex items-center gap-3">
          <div>
            <h3 class="text-lg font-semibold text-primary">{{ t('order.manage.editOrder') }}</h3>
            <p class="text-sm text-secondary mt-0.5">{{ order?.orderNo }}</p>
          </div>
          <span 
            v-if="form.status"
            class="px-2.5 py-0.5 rounded-full text-xs font-medium border"
            :class="getStatusBadgeClass(form.status)"
          >
            {{ t(`order.statuses.${form.status}`) }}
          </span>
        </div>
    </template>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- 左侧：表单 -->
      <div class="space-y-6">
        <div>
          <h4 class="text-sm font-medium text-primary border-b border-[var(--border-color)] pb-2 mb-4">
            {{ t('order.detail.currentInfo') }}
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 状态修改 (仅如有权限) -->
            <div class="md:col-span-2" v-if="mode === 'admin'">
               <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.manage.orderStatus') }}</label>
               <select 
                 v-model="form.status"
                 class="input h-10"
               >
                 <option v-for="s in statuses" :key="s" :value="s">
                   {{ t(`order.statuses.${s}`) }}
                 </option>
               </select>
            </div>
             <!-- 商品名称 (全宽) -->
             <div class="md:col-span-2">
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.productName') }}</label>
              <input 
                v-model="form.name"
                class="input"
              >
            </div>

            <!-- 品牌 -->
            <div>
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.brand') }}</label>
              <input 
                v-model="form.brand"
                class="input"
              >
            </div>

            <!-- 系列 -->
            <div>
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.series') }}</label>
              <input 
                v-model="form.series"
                class="input"
              >
            </div>

            <!-- 规格尺寸 -->
            <div>
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.size') }}</label>
              <input 
                v-model="form.size"
                class="input"
              >
            </div>

            <!-- 颜色 -->
            <div>
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.color') }}</label>
              <input 
                v-model="form.color"
                class="input"
              >
            </div>

            <!-- 材质 -->
            <div>
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.material') }}</label>
              <input 
                v-model="form.material"
                class="input"
              >
            </div>

            <!-- 期望到货时间 -->
            <div>
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.expectedArrival') }}</label>
              <input 
                v-model="form.deadline"
                type="date"
                :min="minDate"
                class="input appearance-none bg-white"
                :class="{ 'text-muted': !form.deadline }"
              >
            </div>

            <!-- 备注 (全宽) -->
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-secondary mb-1">{{ t('order.form.remark') }}</label>
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
           <h4 class="text-sm font-medium text-primary border-b border-[var(--border-color)] pb-2 mb-3">
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
          <h4 class="text-sm font-medium text-primary border-b border-[var(--border-color)] pb-2 mb-3">
            {{ t('order.detail.originalInfo') }}
          </h4>
          <div class="grid grid-cols-2 gap-3 text-sm text-secondary bg-[var(--bg-muted)] p-4 rounded-lg">
            <div>
              <span class="text-muted text-xs block">{{ t('order.form.productName') }}</span>
              <span class="font-medium text-primary">{{ originalData.name || '-' }}</span>
            </div>
            <div>
              <span class="text-muted text-xs block">{{ t('order.form.brand') }}</span>
              <span class="text-primary">{{ originalData.brand || '-' }}</span>
            </div>
            <div>
              <span class="text-muted text-xs block">{{ t('order.form.series') }}</span>
              <span class="text-primary">{{ originalData.series || '-' }}</span>
            </div>
            <div>
              <span class="text-muted text-xs block">{{ t('order.form.size') }}</span>
              <span class="text-primary">{{ originalData.size || '-' }}</span>
            </div>
            <div>
              <span class="text-muted text-xs block">{{ t('order.form.color') }}</span>
              <span class="text-primary">{{ originalData.color || '-' }}</span>
            </div>
            <div>
              <span class="text-muted text-xs block">{{ t('order.form.material') }}</span>
              <span class="text-primary">{{ originalData.material || '-' }}</span>
            </div>
             <!-- 期望到货时间 (全宽) -->
             <div class="col-span-2 flex items-start gap-2">
              <span class="text-muted text-xs block whitespace-nowrap w-24 flex-shrink-0 pt-0.5">{{ t('order.form.expectedArrival') }}</span>
              <span class="text-primary">{{ formatDateWithWeekday(originalData.deadline) }}</span>
            </div>
            <div class="col-span-2 flex items-start gap-2">
              <span class="text-muted text-xs block w-24 flex-shrink-0 pt-0.5">{{ t('order.form.remark') }}</span>
              <p class="whitespace-pre-wrap text-primary">{{ originalData.remark || '-' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 修改理由 (管理端必填) -->
    <div v-if="mode === 'admin'" class="mt-6 pt-6 border-t border-[var(--border-color)]">
      <label class="block text-sm font-medium text-primary mb-2">
        {{ t('order.manage.editReason') }} <span class="text-danger">*</span>
      </label>
      <input 
        v-model="editReason"
        type="text"
        :placeholder="t('order.manage.editReasonPlaceholder')"
        class="w-full px-4 py-2.5 bg-warning-bg border border-warning/20 rounded-lg text-sm focus:ring-warning/40 focus:border-warning outline-none text-warning-text placeholder-warning-text/40"
      >
      <p class="text-xs text-warning-text mt-1.5 flex items-center">
        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        {{ t('order.manage.editReasonRequired') }}
      </p>
    </div>

    <template #footer>
      <button 
        @click="$emit('close')"
        class="px-5 py-2 border border-[var(--border-color)] text-secondary font-medium rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
      >
        {{ t('common.cancel') }}
      </button>
      <button 
        @click="handleSubmit"
        :disabled="!isValid || submitting"
        class="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-lg shadow-primary/20"
      >
        <svg v-if="submitting" class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {{ t('common.save') }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import { getTodayISOString } from '@/utils/common';
import { formatDateWithWeekday } from '@/utils/formatters';
import { getStatusBadgeClass } from '@/utils/status';
import { useSalesToken } from '@/composables/useSalesToken';
import ImageUploader from './common/ImageUploader.vue';
import Modal from '@/components/ui/Modal.vue';

const minDate = computed(() => getTodayISOString());

const props = defineProps({
  order: { type: Object, required: true },
  submitting: Boolean,
  mode: { type: String, default: 'admin' },
  statuses: { type: Array, default: () => ['pending', 'confirmed', 'production', 'shipping', 'completed', 'rejected', 'void'] }
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
  deadline: ''
});

// 初始化数据
watch(() => props.order, (newOrder) => {
  if (newOrder) {
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
    
    // 初始化文件
    uploadedFiles.value = (newOrder.files || []).map(f => ({
      id: f.id,
      url: f.url
    }));
  }
}, { immediate: true });

const originalData = computed(() => props.order.originalData || {});
const currentData = computed(() => props.order.currentData || {});

// 检查是否有变更
const hasChanges = computed(() => {
  if (!props.order) return false;
  
  // 检查字段变更
  const fieldsChanged = (
    form.name !== (currentData.value.name || '') ||
    form.brand !== (currentData.value.brand || '') ||
    form.series !== (currentData.value.series || '') ||
    form.size !== (currentData.value.size || '') ||
    form.color !== (currentData.value.color || '') ||
    form.material !== (currentData.value.material || '') ||
    form.remark !== (currentData.value.remark || '') ||
    form.deadline !== (currentData.value.deadline || '')
  );

  // 检查状态变更
  if (props.mode === 'admin' && form.status !== props.order.status) return true;

  if (fieldsChanged) return true;

  // 检查文件变更
  const oldIds = (props.order.files || []).map(f => f.id).join(',');
  const newIds = uploadedFiles.value.map(f => f.id).join(',');
  return oldIds !== newIds;
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

// 验证逻辑
const isValid = computed(() => {
  if (!hasChanges.value) return false;
  if (props.mode === 'admin' && !editReason.value.trim()) return false;
  return true;
});

const uploaderRef = ref(null);

// 提交
const handleSubmit = async () => {
  if (!isValid.value) return;
  
  // 1. 先触发图片上传 (延迟上传模式)
  if (uploaderRef.value) {
    const uploadSuccess = await uploaderRef.value.uploadPendingFiles();
    if (!uploadSuccess) return; // 上传失败终止提交
  }
  
  // 仅提取变更字段
  const updates = {};
  if (form.name !== currentData.value.name) updates.name = form.name;
  if (form.brand !== currentData.value.brand) updates.brand = form.brand;
  if (form.series !== currentData.value.series) updates.series = form.series;
  if (form.size !== currentData.value.size) updates.size = form.size;
  if (form.color !== currentData.value.color) updates.color = form.color;
  if (form.material !== currentData.value.material) updates.material = form.material;
  if (form.remark !== currentData.value.remark) updates.remark = form.remark;
  if (form.deadline !== currentData.value.deadline) updates.deadline = form.deadline;

  // 状态变更
  if (props.mode === 'admin' && form.status !== props.order.status) {
    updates.status = form.status;
  }

  // 处理文件变更
  const oldIds = (props.order.files || []).map(f => f.id).join(',');
  const newIds = uploadedFiles.value.filter(f => !f.isLocal).map(f => f.id).join(',');
  
  const payload = {
    updates,
    reason: editReason.value
  };

  // 只有当文件列表真正变化时才包含 fileIds
  if (oldIds !== newIds) {
    payload.fileIds = uploadedFiles.value.map(f => f.id);
  }

  emit('submit', payload);
};
</script>

