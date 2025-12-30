<template>
  <Modal 
    :modelValue="true" 
    size="2xl"
    :title="t('order.manage.editOrder')"
    bodyClass="flex-1 overflow-y-auto p-6"
    @update:modelValue="$emit('close')"
  >
    <template #header>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">{{ t('order.manage.editOrder') }}</h3>
          <p class="text-sm text-gray-500 mt-0.5">{{ order?.orderNo }}</p>
        </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 左侧：表单 -->
      <div class="space-y-4">
        <h4 class="text-sm font-medium text-gray-900 border-b border-gray-100 pb-2">
          {{ t('order.detail.currentInfo') }}
        </h4>

        <!-- 商品名称 -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.productName') }}</label>
          <input 
            v-model="form.name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
          >
        </div>

        <!-- 品牌和系列 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.brand') }}</label>
            <input 
              v-model="form.brand"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.series') }}</label>
            <input 
              v-model="form.series"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
            >
          </div>
        </div>

        <!-- 规格尺寸 -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.size') }}</label>
          <input 
            v-model="form.size"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
          >
        </div>

        <!-- 颜色 -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.color') }}</label>
          <input 
            v-model="form.color"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
          >
        </div>

        <!-- 材质 -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.material') }}</label>
          <input 
            v-model="form.material"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
          >
        </div>

        <!-- 备注 -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('order.form.remark') }}</label>
          <textarea 
            v-model="form.remark"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none resize-none"
          ></textarea>
        </div>
      </div>

      <!-- 右侧：原始信息 & 图片 -->
      <div class="space-y-6">
        <!-- 原始信息对比 -->
        <div>
          <h4 class="text-sm font-medium text-gray-900 border-b border-gray-100 pb-2 mb-3">
            {{ t('order.detail.originalInfo') }}
          </h4>
          <div class="space-y-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.productName') }}:</span>
              <span>{{ originalData.name || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.brand') }}:</span>
              <span>{{ originalData.brand || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.series') }}:</span>
              <span>{{ originalData.series || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.size') }}:</span>
              <span>{{ originalData.size || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.color') }}:</span>
              <span>{{ originalData.color || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.material') }}:</span>
              <span>{{ originalData.material || '-' }}</span>
            </div>
            <div class="block">
              <span class="text-gray-400 text-xs block mb-1">{{ t('order.form.remark') }}:</span>
              <p class="whitespace-pre-wrap">{{ originalData.remark || '-' }}</p>
            </div>
             <div class="flex justify-between">
              <span class="text-gray-400 text-xs">{{ t('order.form.deadline') }}:</span>
              <span>{{ originalData.deadline || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 图片管理 -->
        <div>
           <h4 class="text-sm font-medium text-gray-900 border-b border-gray-100 pb-2 mb-3">
            {{ t('order.detail.images') }}
          </h4>
           <ImageUploader
            v-model="uploadedFiles"
            :upload-endpoint="uploadEndpoint"
            :max-files="9"
          />
        </div>
      </div>
    </div>

    <!-- 修改理由 (管理端必填) -->
    <div v-if="mode === 'admin'" class="mt-6 pt-6 border-t border-gray-100">
      <label class="block text-sm font-medium text-gray-900 mb-2">
        {{ t('order.manage.editReason') }} <span class="text-red-500">*</span>
      </label>
      <input 
        v-model="editReason"
        type="text"
        :placeholder="t('order.manage.editReasonPlaceholder')"
        class="w-full px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm focus:ring-yellow-400 focus:border-yellow-400 outline-none text-yellow-800 placeholder-yellow-400/70"
      >
      <p class="text-xs text-yellow-600 mt-1.5 flex items-center">
        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        {{ t('order.manage.editReasonRequired') }}
      </p>
    </div>

    <template #footer>
      <button 
        @click="$emit('close')"
        class="px-5 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition-colors"
      >
        {{ t('common.cancel') }}
      </button>
      <button 
        @click="handleSubmit"
        :disabled="!isValid || submitting"
        class="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-lg shadow-primary/20"
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
import ImageUploader from './common/ImageUploader.vue';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  order: { type: Object, required: true },
  submitting: Boolean,
  mode: { type: String, default: 'admin' }
});

const emit = defineEmits(['close', 'submit']);

const { t } = useI18n();
const editReason = ref('');
const uploadedFiles = ref([]);

// 表单数据
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

// 初始化数据
watch(() => props.order, (newOrder) => {
  if (newOrder) {
    const current = newOrder.currentData || {};
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

  if (fieldsChanged) return true;

  // 检查文件变更
  const oldIds = (props.order.files || []).map(f => f.id).sort().join(',');
  const newIds = uploadedFiles.value.map(f => f.id).sort().join(',');
  return oldIds !== newIds;
});

// 动态上传地址
const uploadEndpoint = computed(() => {
  if (props.mode === 'sales') {
     const match = window.location.pathname.match(/\/sales\/([^\/]+)/);
     return match ? API.SALES_UPLOAD(match[1]) : '';
  }
  return API.MANAGE_UPLOAD;
});

// 验证逻辑
const isValid = computed(() => {
  if (!hasChanges.value) return false;
  if (props.mode === 'admin' && !editReason.value.trim()) return false;
  return true;
});

// 提交
const handleSubmit = () => {
  if (!isValid.value) return;
  
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

  // 处理文件变更
  const oldIds = (props.order.files || []).map(f => f.id).sort().join(',');
  const newIds = uploadedFiles.value.map(f => f.id).sort().join(',');
  if (oldIds !== newIds) {
    updates.fileIds = uploadedFiles.value.map(f => f.id);
  }

  emit('submit', { 
    updates, 
    reason: editReason.value 
  });
};
</script>

