<template>
  <div class="space-y-6">
    <!-- 返回按钮 -->
    <button 
      @click="$emit('back')"
      class="flex items-center gap-2 text-secondary hover:text-primary transition-colors"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
      </svg>
      {{ t('order.portal.myOrders') }}
    </button>

    <!-- 订单头部 -->
    <div class="bg-white rounded-xl border border-[var(--border-color)] p-4">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs text-secondary mb-1">{{ order.orderNo }}</p>
          <h2 class="text-lg font-bold text-primary">{{ currentData.name || t('order.form.productName') }}</h2>
        </div>
        <span 
          class="px-3 py-1 text-sm font-medium rounded-full"
          :class="statusClasses[order.status]"
        >
          {{ t(`order.statuses.${order.status}`) }}
        </span>
      </div>

      <!-- 状态流程条 -->
      <div class="mt-6 relative">
        <div class="absolute top-3 left-0 right-0 h-0.5 bg-gray-200"></div>
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
                : 'bg-white border-gray-300 text-gray-400'"
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

    <!-- 商品图片 -->
    <div v-if="order.files && order.files.length > 0" class="bg-white rounded-xl border border-[var(--border-color)] p-4">
      <h3 class="text-sm font-medium text-primary mb-3">{{ t('order.detail.images') }}</h3>
      <div class="grid grid-cols-3 gap-2">
        <div 
          v-for="file in order.files" 
          :key="file.id"
          class="aspect-square rounded-lg overflow-hidden bg-gray-100"
        >
          <img :src="file.url" class="w-full h-full object-cover" loading="lazy">
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
          class="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full cursor-pointer hover:bg-orange-100"
          @click="showCorrectionModal = true"
        >
          {{ t('order.portal.viewCorrection') }}
        </span>
      </div>
      
      <div class="space-y-3">
        <div class="flex">
          <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.productName') }}</span>
          <span class="text-sm text-primary">{{ currentData.name || '-' }}</span>
        </div>
        <div class="flex">
          <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.size') }}</span>
          <span class="text-sm text-primary">{{ currentData.size || '-' }}</span>
        </div>
        <div class="flex">
          <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.color') }}</span>
          <span class="text-sm text-primary">{{ currentData.color || '-' }}</span>
        </div>
        <div class="flex">
          <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.material') }}</span>
          <span class="text-sm text-primary">{{ currentData.material || '-' }}</span>
        </div>
        <div class="flex">
          <span class="w-20 text-sm text-secondary flex-shrink-0">{{ t('order.form.remark') }}</span>
          <span class="text-sm text-primary whitespace-pre-wrap">{{ currentData.remark || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 时间轴 -->
    <div class="bg-white rounded-xl border border-[var(--border-color)] p-4">
      <h3 class="text-sm font-medium text-primary mb-4">{{ t('order.detail.timeline') }}</h3>
      <OrderTimeline :timeline="order.timeline" />
    </div>

    <!-- 留言输入 -->
    <div class="bg-white rounded-xl border border-[var(--border-color)] p-4">
      <h3 class="text-sm font-medium text-primary mb-3">{{ t('order.detail.addComment') }}</h3>
      <div class="flex gap-2">
        <input 
          v-model="commentText"
          type="text"
          :placeholder="t('order.detail.commentPlaceholder')"
          class="flex-1 h-10 px-4 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none"
          @keyup.enter="sendComment"
        >
        <button 
          @click="sendComment"
          :disabled="!commentText.trim()"
          class="px-4 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ t('order.detail.sendComment') }}
        </button>
      </div>
    </div>

    <!-- 修正对比弹窗 -->
    <div 
      v-if="showCorrectionModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      @click.self="showCorrectionModal = false"
    >
      <div class="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div class="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-semibold text-primary">{{ t('order.detail.correctionCompare') }}</h3>
          <button @click="showCorrectionModal = false" class="p-1 text-secondary hover:text-primary">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          <div v-for="correction in corrections" :key="correction.id" class="border border-[var(--border-color)] rounded-lg p-3">
            <p class="text-xs text-secondary mb-2">{{ formatTime(correction.createdAt) }}</p>
            <div class="flex items-center gap-2 text-sm">
              <span class="text-secondary">{{ correction.fieldName }}:</span>
              <span class="line-through text-red-400">{{ correction.oldValue }}</span>
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
              <span class="text-green-600 font-medium">{{ correction.newValue }}</span>
            </div>
            <p class="text-xs text-secondary mt-2">
              <span class="font-medium">{{ t('order.detail.correctionReason') }}:</span> {{ correction.reason }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import OrderTimeline from './OrderTimeline.vue';

const props = defineProps({
  order: { type: Object, required: true }
});

const emit = defineEmits(['back', 'comment']);

const { t } = useI18n();

const commentText = ref('');
const showCorrectionModal = ref(false);

// 当前数据
const currentData = computed(() => props.order.currentData || {});
const originalData = computed(() => props.order.originalData || {});

// 状态流程
const statusSteps = ['pending', 'confirmed', 'production', 'shipping', 'arrived', 'delivered'];
const currentStepIndex = computed(() => {
  const idx = statusSteps.indexOf(props.order.status);
  return idx >= 0 ? idx : 0;
});
const progressWidth = computed(() => {
  const total = statusSteps.length - 1;
  return `${(currentStepIndex.value / total) * 100}%`;
});

// 状态样式
const statusClasses = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-700',
  production: 'bg-purple-50 text-purple-700',
  shipping: 'bg-cyan-50 text-cyan-700',
  arrived: 'bg-green-50 text-green-700',
  delivered: 'bg-gray-100 text-gray-600'
};

// 是否有修正
const hasCorrection = computed(() => {
  return props.order.timeline?.some(t => t.actionType === 'field_updated');
});

// 获取修正记录
const corrections = computed(() => {
  return props.order.timeline?.filter(t => t.actionType === 'field_updated') || [];
});

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 发送留言
const sendComment = () => {
  if (!commentText.value.trim()) return;
  emit('comment', commentText.value.trim());
  commentText.value = '';
};
</script>
