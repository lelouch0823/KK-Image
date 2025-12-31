<template>
  <div class="space-y-6">
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
        <!-- 编辑和作废按钮 (仅pending/rejected显示) -->
        <template v-if="order.status === 'pending' || order.status === 'rejected'">
          <button 
            @click="showEditModal = true"
            class="px-3 py-1.5 text-sm font-medium text-primary bg-white border border-[var(--border-hover)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            {{ t('order.manage.editOrder') }}
          </button>
          <button 
            @click="handleVoid"
            class="px-3 py-1.5 text-sm font-medium text-[var(--color-danger-text)] bg-white border border-[var(--color-danger-bg)] rounded-lg hover:bg-[var(--color-danger-bg)] transition-colors"
          >
            {{ t('order.actions.void') }}
          </button>
        </template>
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
         <!-- 打印按钮 -->
         <button 
            @click="printOrder"
            class="px-3 py-1.5 text-sm font-medium text-secondary bg-white border border-[var(--border-hover)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5"
         >
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
           </svg>
           {{ t('common.print') }}
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
    <Modal
      v-model="showConfirmModal"
      :title="t('common.confirm')"
      size="sm"
    >
      <div class="p-4">
        <p class="text-secondary">{{ t('common.confirmVoid') }}</p>
      </div>
      <template #footer>
        <button 
          @click="showConfirmModal = false"
          class="px-4 py-2 border border-[var(--border-color)] text-secondary rounded-lg hover:bg-[var(--bg-hover)]"
        >
          {{ t('common.cancel') }}
        </button>
        <button 
          @click="executeVoid"
          class="px-4 py-2 bg-[var(--color-danger)] text-white rounded-lg hover:bg-[var(--color-danger-text)] shadow-lg shadow-danger/20"
        >
          {{ t('common.confirm') }}
        </button>
      </template>
    </Modal>
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
const showConfirmModal = ref(false);

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
  showConfirmModal.value = true;
};

const executeVoid = async () => {
  if (!salesToken.value) return;
  showConfirmModal.value = false;

  try {
    const res = await fetch(API.SALES_ORDER_DETAIL(salesToken.value, props.order.id), {
      method: 'DELETE',
      credentials: 'include'
    });
    const result = await res.json();
    
    if (result.success) {
      addToast({ message: t('common.success'), type: 'success' });
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

// 更新订单
const handleUpdate = async ({ updates }) => {
  if (!salesToken.value) return;

  submitting.value = true;
  try {
    const res = await fetch(API.SALES_ORDER_DETAIL(salesToken.value, props.order.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
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

const printOrder = () => {
    window.print();
};
</script>

<style scoped>
@media print {
  /* Hide non-printable areas */
  button, input, .order-timeline-container, .comment-input-area {
    display: none !important;
  }
}
</style>
