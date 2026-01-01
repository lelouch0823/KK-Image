<template>
  <div class="base-container">
    <!-- Screen View (网页模式) -->
    <div class="screen-view space-y-6">
      <!-- 原有的 Header, Grid, Timeline 等内容保持不变 -->
      <!-- 返回按钮 -->
      <div class="flex items-center justify-between">
        <button 
          @click="$emit('back')"
          class="flex items-center gap-2 text-secondary hover:text-primary transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          {{ t('order.portal.myOrders') }}
        </button>

        <!-- 销售端操作按钮 -->
        <div v-if="mode === 'sales'" class="flex gap-2">
          <!-- 复制订单按钮 (始终显示) -->
          <button 
            @click="$emit('duplicate', order)"
            class="px-3 py-1.5 text-sm font-medium text-primary bg-white border border-[var(--border-hover)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            {{ t('order.actions.duplicate') }}
          </button>
          <!-- 编辑和作废按钮 -->
          <!-- 编辑: pending, rejected, void -->
          <button 
            v-if="['pending', 'rejected', 'void'].includes(order.status)"
            @click="showEditModal = true"
            class="px-3 py-1.5 text-sm font-medium text-primary bg-white border border-[var(--border-hover)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            {{ t('order.manage.editOrder') }}
          </button>
          
          <!-- 作废: 仅 pending -->
          <button 
            v-if="order.status === 'pending'"
            @click="handleVoid"
            class="px-3 py-1.5 text-sm font-medium text-[var(--color-danger-text)] bg-white border border-[var(--color-danger-bg)] rounded-lg hover:bg-[var(--color-danger-bg)] transition-colors"
          >
            {{ t('order.actions.void') }}
          </button>
        </div>

         <!-- 管理端操作按钮 -->
        <div v-if="mode === 'admin' || !mode" class="flex gap-2">
           <button 
              @click="$emit('edit', order)"
              class="px-3 py-1.5 text-sm font-medium text-primary bg-white border border-[var(--border-hover)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
           >
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
             </svg>
             {{ t('order.manage.editOrder') }}
           </button>
           <!-- 打印/保存PDF 按钮 -->
           <button 
              @click="handleSavePdf"
              class="px-3 py-1.5 text-sm font-medium text-secondary bg-white border border-[var(--border-hover)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
           >
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
             </svg>
             {{ t('common.savePdf') }}
           </button>
        </div>
      </div>

      <!-- 主要内容区域 Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        <!-- 左侧：图片区域 (PC端占 8列) -->
        <div class="lg:col-span-8 space-y-4 order-last lg:order-first">
          <!-- 商品图片 -->
          <div v-if="order.files && order.files.length > 0" class="bg-white rounded-xl border border-[var(--border-color)] p-4">
            <h3 class="text-sm font-medium text-primary mb-3">{{ t('order.detail.images') }}</h3>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <div 
                v-for="file in order.files" 
                :key="file.id"
                class="aspect-square rounded-lg overflow-hidden bg-[var(--bg-muted)] hover:opacity-90 transition-opacity cursor-pointer"
              >
                <img :src="file.url" class="w-full h-full object-cover" loading="lazy">
              </div>
            </div>
          </div>
          
          <!-- 时间轴 (PC端显示在左侧下方) -->
          <div class="bg-white rounded-xl border border-[var(--border-color)] p-4 hidden lg:block">
             <h3 class="text-sm font-medium text-primary mb-4">{{ t('order.detail.timeline') }}</h3>
             <OrderTimeline :timeline="order.timeline" />
          </div>
        </div>

        <!-- 右侧：信息区域 (PC端占 4列) -->
        <div class="lg:col-span-4 space-y-4">
          <!-- 销售人员信息 (仅管理员可见) -->
          <div v-if="(mode === 'admin' || !mode) && order.salesperson" class="bg-white rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
             <h3 class="text-xs font-medium text-secondary mb-3 uppercase tracking-wider">{{ t('order.detail.submittedBy') }}</h3>
             <div class="flex items-center gap-3">
               <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                 {{ order.salesperson.name.charAt(0) }}
               </div>
               <div class="flex-1 min-w-0">
                 <p class="text-sm font-medium text-primary truncate">{{ order.salesperson.name }}</p>
                 <p class="text-xs text-secondary truncate">{{ order.salesperson.store || '-' }}</p>
               </div>
               <!-- 电话 (点击拨打) -->
               <a v-if="order.salesperson.phone" :href="`tel:${order.salesperson.phone}`" class="p-2 text-secondary hover:text-primary hover:bg-[var(--bg-muted)] rounded-full transition-colors">
                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                 </svg>
               </a>
             </div>
          </div>

          <!-- 订单头部 -->
          <div class="bg-white rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs text-secondary mb-1">{{ order.orderNo }}</p>
                <h2 class="text-lg font-bold text-primary">{{ currentData.name || t('order.form.productName') }}</h2>
              </div>
              <StatusBadge :variant="getStatusVariant(order.status)" size="md" dot>
                {{ t(`order.statuses.${order.status}`) }}
              </StatusBadge>
            </div>

            <!-- 状态流程条 -->
            <div class="mt-6 relative">
              <div class="absolute top-3 left-0 right-0 h-0.5 bg-[var(--border-color)]"></div>
              <div 
                class="absolute top-3 left-0 h-0.5 bg-primary transition-all"
                :style="{ width: progressWidth }"
              ></div>
              <div class="relative flex justify-between">
                <div 
                  v-for="(step, index) in statusSteps" 
                  :key="step"
                  class="flex flex-col items-center"
                >
                  <div 
                    class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all"
                    :class="index <= currentStepIndex 
                      ? 'bg-primary border-primary text-white' 
                      : 'bg-white border-[var(--border-hover)] text-secondary'"
                  >
                    <svg v-if="index < currentStepIndex" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span v-else>{{ index + 1 }}</span>
                  </div>
                  <span 
                    class="text-[10px] mt-1.5 text-center whitespace-nowrap"
                    :class="index <= currentStepIndex ? 'text-primary font-medium' : 'text-secondary'"
                  >
                    {{ t(`order.statuses.${step}`) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 商品信息 -->
          <div class="bg-white rounded-xl border border-[var(--border-color)] p-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-primary">{{ t('order.detail.currentInfo') }}</h3>
              <!-- 修正标记 -->
              <span 
                v-if="hasCorrection"
                class="text-xs text-[var(--color-warning-text)] bg-[var(--color-warning-bg)] px-2 py-0.5 rounded-full cursor-pointer hover:bg-[var(--color-warning)] hover:text-white"
                @click="showCorrectionModal = true"
              >
                {{ t('order.portal.viewCorrection') }}
              </span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div class="flex">
                <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.productName') }}</span>
                <span class="text-sm text-primary truncate">{{ currentData.name || '-' }}</span>
              </div>
              <div class="flex">
                <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.brand') }}</span>
                <span class="text-sm text-primary truncate">{{ currentData.brand || '-' }}</span>
              </div>
              <div class="flex">
                <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.series') }}</span>
                <span class="text-sm text-primary truncate">{{ currentData.series || '-' }}</span>
              </div>
              <div class="flex">
                <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.size') }}</span>
                <span class="text-sm text-primary truncate">{{ currentData.size || '-' }}</span>
              </div>
              <div class="flex">
                <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.color') }}</span>
                <span class="text-sm text-primary truncate">{{ currentData.color || '-' }}</span>
              </div>
              <div class="flex">
                <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.material') }}</span>
                <span class="text-sm text-primary truncate">{{ currentData.material || '-' }}</span>
              </div>
              <!-- 期望到货时间 (全宽) -->
              <div class="col-span-1 sm:col-span-2 flex">
                 <span class="w-28 text-sm text-secondary flex-shrink-0 whitespace-nowrap">{{ t('order.form.expectedArrival') }}</span>
                 <span class="text-sm text-primary">{{ formatDeadline(currentData.deadline) }}</span>
              </div>
              <!-- 备注 (全宽) -->
              <div class="col-span-1 sm:col-span-2 flex">
                <span class="w-28 text-sm text-secondary flex-shrink-0">{{ t('order.form.remark') }}</span>
                <p class="text-sm border border-[var(--border-color)] rounded-lg p-2 bg-[var(--bg-muted)] text-primary w-full whitespace-pre-wrap">{{ currentData.remark || '-' }}</p>
              </div>
            </div>
          </div>

          <!-- 时间轴 (移动端显示) -->
          <div class="bg-white rounded-xl border border-[var(--border-color)] p-4 lg:hidden">
            <h3 class="text-sm font-medium text-primary mb-4">{{ t('order.detail.timeline') }}</h3>
            <OrderTimeline :timeline="order.timeline" />
          </div>

          <!-- 留言输入 - 聊天风格 -->
          <div class="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div class="flex items-center gap-3 p-3">
              <input 
                v-model="commentText"
                type="text"
                :placeholder="t('order.detail.commentPlaceholder')"
                class="flex-1 h-10 px-4 text-sm bg-[var(--bg-muted)] border-0 rounded-full focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                @keyup.enter="sendComment"
              >
              <button 
                @click="sendComment"
                :disabled="!commentText.trim()"
                class="w-10 h-10 flex-shrink-0 rounded-full bg-primary text-white flex items-center justify-center hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 修正对比弹窗 -->
      <Modal
        v-model="showCorrectionModal"
        :title="t('order.detail.correctionCompare')"
        size="md"
        bodyClass="p-4 max-h-[60vh] overflow-y-auto space-y-4"
      >
        <div v-for="correction in corrections" :key="correction.id" class="border border-[var(--border-color)] rounded-lg p-3">
          <p class="text-xs text-secondary mb-2">{{ formatTime(correction.createdAt) }}</p>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-secondary">{{ correction.fieldName }}:</span>
            <span class="line-through text-danger/60"> {{ correction.oldValue }}</span>
            <svg class="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
            <span class="text-success font-medium">{{ correction.newValue }}</span>
          </div>
          <p class="text-xs text-secondary mt-2">
            <span class="font-medium text-primary">{{ t('order.detail.correctionReason') }}:</span> {{ correction.reason }}
          </p>
        </div>
      </Modal>


      <!-- 编辑弹窗 -->
      <OrderEditModal
        v-if="showEditModal"
        :order="order"
        :mode="'sales'"
        :submitting="submitting"
        @close="showEditModal = false"
        @submit="handleUpdate"
      />

      <!-- 作废确认弹窗 -->
      <ConfirmDialog
        v-model="confirmData.show"
        :title="confirmData.title"
        :message="confirmData.message"
        :type="confirmData.type"
        :loading="confirmData.loading"
        @confirm="confirmData.onConfirm"
      />
    </div>

    <!-- Print View (文档模式 - A4 SOTA) -->
    <div class="print-view hidden">
      <!-- 打印页眉 -->
      <div class="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold uppercase tracking-wider text-black">KK-Image System</h1>
          <div class="mt-2 text-sm text-gray-600 space-y-0.5">
            <p>{{ t('order.orderNo') }}: <span class="font-mono font-bold text-black text-base ml-2">{{ order.orderNo }}</span></p>
            <p>{{ t('order.createdAt') }}: <span class="text-black ml-2">{{ formatTime(order.createdAt) }}</span></p>
          </div>
        </div>
        <div class="text-right">
          <div class="inline-block px-4 py-1 border-2 border-black rounded-sm font-bold text-black uppercase">
            {{ t(`order.statuses.${order.status}`) }}
          </div>
        </div>
      </div>

      <!-- 订单信息网格 -->
      <div class="mb-8 break-inside-avoid">
        <h2 class="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3 border-b border-gray-200 pb-1">{{ t('order.detail.currentInfo') }}</h2>
        <dl class="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
          <div class="grid grid-cols-[80px_1fr]">
            <dt class="text-gray-500">{{ t('order.form.productName') }}</dt>
            <dd class="font-medium text-black">{{ currentData.name || '-' }}</dd>
          </div>
          <div class="grid grid-cols-[80px_1fr]">
            <dt class="text-gray-500">{{ t('order.form.brand') }}</dt>
            <dd class="font-medium text-black">{{ currentData.brand || '-' }}</dd>
          </div>
          <div class="grid grid-cols-[80px_1fr]">
            <dt class="text-gray-500">{{ t('order.form.series') }}</dt>
            <dd class="font-medium text-black">{{ currentData.series || '-' }}</dd>
          </div>
          <div class="grid grid-cols-[80px_1fr]">
             <dt class="text-gray-500">{{ t('order.form.size') }}</dt>
             <dd class="font-medium text-black">{{ currentData.size || '-' }}</dd>
          </div>
          <div class="grid grid-cols-[80px_1fr]">
             <dt class="text-gray-500">{{ t('order.form.color') }}</dt>
             <dd class="font-medium text-black">{{ currentData.color || '-' }}</dd>
          </div>
          <div class="grid grid-cols-[80px_1fr]">
             <dt class="text-gray-500">{{ t('order.form.material') }}</dt>
             <dd class="font-medium text-black">{{ currentData.material || '-' }}</dd>
          </div>
          <div class="col-span-2 mt-2 pt-2 border-t border-dashed border-gray-200">
            <dt class="text-gray-500 text-xs mb-1">{{ t('order.form.remark') }}</dt>
            <dd class="text-black bg-gray-50 p-3 rounded text-sm leading-relaxed border border-gray-100">{{ currentData.remark || '-' }}</dd>
          </div>
        </dl>
      </div>

      <!-- 图片区域 -->
      <div v-if="order.files && order.files.length > 0" class="mb-8 break-inside-avoid">
        <h2 class="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3 border-b border-gray-200 pb-1">{{ t('order.detail.images') }}</h2>
        <div class="grid grid-cols-4 gap-4">
          <div v-for="file in order.files" :key="file.id" class="break-inside-avoid">
            <div class="aspect-square border border-gray-200 rounded-sm overflow-hidden bg-gray-50">
              <img :src="file.url" class="w-full h-full object-cover">
            </div>
          </div>
        </div>
      </div>

      <!-- 操作审计日志 (Table Mode) -->
      <div v-if="order.timeline && order.timeline.length > 0">
        <h2 class="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3 border-b border-gray-200 pb-1">{{ t('order.detail.timeline') }}</h2>
        <OrderTimeline :timeline="order.timeline" mode="table" :maxItems="999" />
      </div>

      <!-- 页脚 -->
      <div class="fixed bottom-0 left-0 w-full text-center text-[10px] text-gray-400 border-t border-gray-100 pt-2 bg-white">
        Generated by KK-Image System • {{ new Date().toLocaleString() }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import { STATUS_OPTIONS, STATUS_STYLES, getStatusVariant } from '@/utils/status';
import { useSalesToken } from '@/composables/useSalesToken';
import { formatRelativeTime, formatDateWithWeekday, formatTimelineTime } from '@/utils/formatters';
import OrderTimeline from './OrderTimeline.vue';
import OrderEditModal from '../OrderEditModal.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  order: { type: Object, required: true },
  mode: { type: String, default: 'sales' }
});

const emit = defineEmits(['back', 'comment', 'refresh', 'duplicate']);

const { t } = useI18n();
const { addToast } = useToast();

const commentText = ref('');
const showCorrectionModal = ref(false);
const showEditModal = ref(false);
const submitting = ref(false);

const { token: salesToken } = useSalesToken();

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {}
});

// 清除红点
const markAsRead = async () => {
  if (props.mode !== 'sales' || !props.order.hasNewFeedback || !salesToken.value) return;
  
  try {
    await fetch(API.SALES_ORDER_READ(salesToken.value, props.order.id), {
      method: 'PATCH',
      credentials: 'include'
    });
    // 本地更新状态
    props.order.hasNewFeedback = false;
  } catch (e) {
    console.error('Failed to mark read', e);
  }
};

// 初始化
markAsRead();

// 当前数据
const currentData = computed(() => props.order.currentData || {});
const originalData = computed(() => props.order.originalData || {});

// 状态流程
const statusSteps = STATUS_OPTIONS.filter(s => s !== 'rejected'); // 排除 rejected
const currentStepIndex = computed(() => {
  const idx = statusSteps.indexOf(props.order.status);
  return idx >= 0 ? idx : 0;
});
const progressWidth = computed(() => {
  const total = statusSteps.length - 1;
  return `${(currentStepIndex.value / total) * 100}%`;
});

// 状态样式
const statusClasses = STATUS_STYLES;

// 是否有修正
const hasCorrection = computed(() => {
  return props.order.timeline?.some(t => t.actionType === 'field_updated');
});

// 获取修正记录
const corrections = computed(() => {
  return props.order.timeline?.filter(t => t.actionType === 'field_updated') || [];
});

// 格式化时间
const formatTime = (timestamp) => formatTimelineTime(timestamp);

// 格式化截止时间
const formatDeadline = (date) => formatDateWithWeekday(date);

// 发送留言
const sendComment = () => {
  if (!commentText.value.trim()) return;
  emit('comment', commentText.value.trim());
  commentText.value = '';
};

const handleVoid = () => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('common.confirmVoid'),
    type: 'danger',
    onConfirm: executeVoid
  };
};

const executeVoid = async () => {
  if (!salesToken.value) return;

  confirmData.value.loading = true;
  try {
    const res = await fetch(API.SALES_ORDER_DETAIL(salesToken.value, props.order.id), {
      method: 'DELETE',
      credentials: 'include'
    });
    const result = await res.json();
    
    if (result.success) {
      addToast({ message: t('common.success'), type: 'success' });
      confirmData.value.show = false;
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    confirmData.value.loading = false;
  }
};

// 更新订单
const handleUpdate = async (payload) => {
  if (!salesToken.value) return;
  
  const { updates, fileIds } = payload;
  const updatesToSend = { ...updates };
  if (fileIds) {
    updatesToSend.fileIds = fileIds;
  }

  submitting.value = true;
  try {
    const res = await fetch(API.SALES_ORDER_DETAIL(salesToken.value, props.order.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: updatesToSend }),
      credentials: 'include'
    });
    const result = await res.json();
    
    if (result.success) {
      addToast({ message: t('common.success'), type: 'success' });
      showEditModal.value = false;
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    submitting.value = false;
  }
};

// 引入 html2pdf
import html2pdf from 'html2pdf.js';

// ... (other code)

const handleSavePdf = () => {
  // 1. 获取打印视图元素
  const element = document.querySelector('.print-view');
  if (!element) return;

  // 2. 临时显示元素 (html2pdf 需要元素可见)
  // 我们需要克隆元素以避免破坏现有 DOM 或影响显示
  // 但 html2pdf 最好直接处理 DOM。此处使用一个技巧：
  // 克隆节点，应用打印样式，插入 body (离屏)，生成后移除。
  
  // SOTA 方案：直接使用 html2pdf 处理 .print-view，但需确保其可见。
  //由于 .print-view 是 hidden 的，我们需要临时处理。
  
  const clone = element.cloneNode(true);
  
  // 移除 hidden 类，强制显示
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.position = 'absolute';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.width = '210mm'; // A4 width
  clone.style.background = 'white';
  
  // 插入文档
  document.body.appendChild(clone);

  // 3. 配置选项
  const opt = {
    margin:       [10, 10, 10, 10], // mm
    filename:     `Order_${props.order.orderNo}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // 4. 生成并下载
  html2pdf().set(opt).from(clone).save().then(() => {
    // 清理
    document.body.removeChild(clone);
  });
};
</script>

<style scoped>
/* Screen View Styles */
@media screen {
  .print-view {
    display: none !important;
  }
}

/* Print View Styles */
@media print {
  /* Layout Reset */
  @page {
    size: A4;
    margin: 1.5cm;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: white;
  }

  /* Visibility Toggle */
  .screen-view {
    display: none !important;
  }
  
  .print-view {
    display: block !important;
    width: 100%;
    color: black;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  /* Component Hiding (Safety Net) */
  button, 
  .flex.items-center.justify-between,
  .fixed.inset-0,
  nav,
  header {
    display: none !important;
  }

  /* Utilities */
  .break-inside-avoid {
    break-inside: avoid;
  }
}
</style>
