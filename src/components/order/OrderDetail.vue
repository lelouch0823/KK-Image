<template>
  <div class="base-container">
    <!-- Screen View (网页模式) -->
    <div class="screen-view space-y-6">
      <!-- 返回按钮和操作区 -->
      <div class="flex items-center justify-between">
        <button
          v-if="mode !== 'sales'"
          class="flex items-center gap-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--color-primary)]"
          @click="$emit('back')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          {{ t('order.portal.myOrders') }}
        </button>

        <!-- 销售端操作按钮 -->
        <div v-if="mode === 'sales'" class="flex gap-2">
          <button
            class="flex items-center gap-1.5 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] shadow-sm transition-all hover:bg-[var(--bg-hover)] hover:shadow-md active:scale-95"
            @click="$emit('duplicate', order)"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {{ t('order.actions.duplicate') }}
          </button>
          <button
            v-if="['pending', 'rejected', 'void'].includes(order.status)"
            class="flex items-center gap-1.5 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] shadow-sm transition-all hover:bg-[var(--bg-hover)] hover:shadow-md active:scale-95"
            @click="showEditModal = true"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {{ t('order.manage.editOrder') }}
          </button>
          <button
            v-if="order.status === 'pending'"
            class="rounded-lg border border-[var(--color-danger-bg)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger-text)] transition-colors hover:bg-[var(--color-danger-bg)]"
            @click="handleVoid"
          >
            {{ t('order.actions.void') }}
          </button>
        </div>

        <!-- 管理端操作按钮 -->
        <div v-if="mode === 'admin' || !mode" class="flex gap-2">
          <button
            class="flex items-center gap-1.5 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] shadow-sm transition-all hover:bg-[var(--bg-hover)] hover:shadow-md active:scale-95"
            @click="$emit('edit', order)"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {{ t('order.manage.editOrder') }}
          </button>
          <button
            class="group flex items-center gap-1.5 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] shadow-sm transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)] hover:shadow-md active:scale-95"
            @click="handleSavePdf"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {{ t('common.savePdf') }}
          </button>
        </div>
      </div>

      <!-- 主要内容区域 Grid -->
      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <!-- 左侧：图片区域 (PC端占 8列) -->
        <div class="order-last space-y-4 lg:order-first lg:col-span-8">
          <!-- 商品图片 -->
          <OrderFileGrid :files="order.files" @preview="handlePreview" />

          <!-- 商品信息 (PC端显示在左侧下方，放大显示) -->
          <OrderInfoCard
            :data="currentData"
            :has-correction="hasCorrection"
            @view-correction="showCorrectionModal = true"
          />
        </div>

        <!-- 右侧：信息区域 (PC端占 4列) -->
        <div class="space-y-4 lg:col-span-4">
          <!-- 客户信息 (仅当有有效客户数据时显示) -->
          <OrderPersonCard
            v-if="hasCustomerInfo"
            :title="t('customer.detail.title')"
            :name="order.customer.name"
            :subtitle="order.customer.company"
            :phone="order.customer.phone"
            avatar-class="bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
          />

          <!-- 销售人员信息 (仅管理员可见) -->
          <OrderPersonCard
            v-if="(mode === 'admin' || !mode) && order.salesperson"
            :title="t('order.detail.submittedBy')"
            :name="order.salesperson.name"
            :subtitle="order.salesperson.store"
            :phone="order.salesperson.phone"
            avatar-class="bg-[var(--color-primary-bg)] text-[var(--color-primary)]"
          />

          <!-- 订单头部 -->
          <OrderStatusHeader
            :order-no="order.orderNo"
            :product-name="currentData.name"
            :status="order.status"
            :quantity="order.quantity || 1"
          />

          <!-- 时间轴 (PC端窄栏显示，移动端通用) -->
          <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <h3 class="mb-4 text-sm font-medium text-[var(--color-primary)]">{{ t('order.detail.timeline') }}</h3>
            <OrderTimeline :timeline="order.timeline" />
          </div>



          <!-- 留言输入 -->
          <OrderCommentInput @submit="sendComment" />
        </div>
      </div>

      <!-- 修正对比弹窗 -->
      <Modal
        v-model="showCorrectionModal"
        :title="t('order.detail.correctionCompare')"
        size="md"
        body-class="p-4 max-h-[60vh] overflow-y-auto space-y-4"
      >
        <div
          v-for="correction in corrections"
          :key="correction.id"
          class="rounded-lg border border-[var(--border-color)] p-3"
        >
          <p class="text-secondary mb-2 text-xs">{{ formatTime(correction.createdAt) }}</p>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-secondary">{{ correction.fieldName }}:</span>
            <span class="text-danger/60 line-through"> {{ correction.oldValue }}</span>
            <svg
              class="text-secondary size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
            <span class="text-success font-medium">{{ correction.newValue }}</span>
          </div>
          <p class="text-secondary mt-2 text-xs">
            <span class="text-primary font-medium">{{ t('order.detail.correctionReason') }}:</span>
            {{ correction.reason }}
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
    <OrderPrintView ref="printViewRef" :order="order" class="hidden" />

    <!-- Lightbox -->
    <Lightbox
      :visible="visible"
      :current-file="currentFile"
      :current-index="currentIndex"
      :total="total"
      :has-prev="hasPrev"
      :has-next="hasNext"
      @close="close"
      @prev="prev"
      @next="next"
      @download="download"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import { useSalesToken } from '@/composables/useSalesToken';
import { useLightbox } from '@/composables/useLightbox';
import { formatTimelineTime } from '@/utils/formatters';
import html2pdf from 'html2pdf.js';

// Sub-components
import OrderTimeline from './OrderTimeline.vue';
import OrderFileGrid from './OrderFileGrid.vue';
import OrderInfoCard from './OrderInfoCard.vue';
import OrderCommentInput from './OrderCommentInput.vue';
import OrderPersonCard from './OrderPersonCard.vue';
import OrderStatusHeader from './OrderStatusHeader.vue';
import OrderPrintView from './OrderPrintView.vue';
import OrderEditModal from '../OrderEditModal.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import Lightbox from '@/components/common/Lightbox.vue';

const props = defineProps({
  order: { type: Object, required: true },
  mode: { type: String, default: 'sales' },
});

const emit = defineEmits(['back', 'comment', 'refresh', 'duplicate', 'edit']);

const { t } = useI18n();
const { addToast } = useToast();

const showCorrectionModal = ref(false);
const showEditModal = ref(false);
const submitting = ref(false);
const printViewRef = ref(null);

const { token: salesToken } = useSalesToken();

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

// 清除红点
const markAsRead = async () => {
  if (props.mode !== 'sales' || !props.order.hasNewFeedback || !salesToken.value) return;

  try {
    await fetch(API.SALES_ORDER_READ(salesToken.value, props.order.id), {
      method: 'PATCH',
      credentials: 'include',
    });
    emit('refresh');
  } catch (_e) {
    console.error('Failed to mark read', _e);
  }
};

// 初始化
markAsRead();

// 是否有有效的客户信息 (SOTA: 精确检查客户数据有效性)
const hasCustomerInfo = computed(() => {
  const customer = props.order.customer;
  return customer && typeof customer === 'object' && customer.name?.trim();
});

// 当前数据
const currentData = computed(() => props.order.currentData || {});

// 是否有修正
const hasCorrection = computed(() => {
  return props.order.timeline?.some((t) => t.actionType === 'field_updated');
});

// 获取修正记录
const corrections = computed(() => {
  return props.order.timeline?.filter((t) => t.actionType === 'field_updated') || [];
});

// 格式化时间
const formatTime = (timestamp) => formatTimelineTime(timestamp);

// 发送留言
const sendComment = (text) => {
  emit('comment', text);
};

// 预览图片
// 预览图片
const files = computed(() => props.order.files || []);
const {
  visible,
  currentFile,
  currentIndex,
  total,
  hasPrev,
  hasNext,
  open,
  close,
  prev,
  next,
  download,
} = useLightbox(files);

const handlePreview = (file) => {
  const index = files.value.findIndex((f) => f.id === file.id);
  if (index !== -1) {
    open(file, index);
  }
};

const handleVoid = () => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('common.confirmVoid'),
    type: 'danger',
    onConfirm: executeVoid,
  };
};

const executeVoid = async () => {
  if (!salesToken.value) return;

  confirmData.value.loading = true;
  try {
    const res = await fetch(API.SALES_ORDER_DETAIL(salesToken.value, props.order.id), {
      method: 'DELETE',
      credentials: 'include',
    });
    const result = await res.json();

    if (result.success) {
      addToast({ message: t('common.success'), type: 'success' });
      confirmData.value.show = false;
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    confirmData.value.loading = false;
  }
};

// 更新订单
const handleUpdate = async (payload) => {
  if (!salesToken.value) return;

  const { updates, fileIds, reason } = payload;

  submitting.value = true;
  try {
    // 发送正确的 payload 结构：updates, reason, fileIds 都在顶层
    const requestBody = { updates, reason };
    if (fileIds) {
      requestBody.fileIds = fileIds;
    }
    
    const res = await fetch(API.SALES_ORDER_DETAIL(salesToken.value, props.order.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });
    const result = await res.json();

    if (result.success) {
      addToast({ message: t('common.success'), type: 'success' });
      showEditModal.value = false;
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    submitting.value = false;
  }
};

const handleSavePdf = () => {
  const element = printViewRef.value?.$el;
  if (!element) return;

  const clone = element.cloneNode(true);
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.position = 'absolute';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.width = '210mm';
  clone.style.background = 'white';

  document.body.appendChild(clone);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Order_${props.order.orderNo}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf()
    .set(opt)
    .from(clone)
    .save()
    .then(() => {
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
  @page {
    size: A4;
    margin: 1.5cm;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: white;
  }

  .screen-view {
    display: none !important;
  }

  .print-view {
    display: block !important;
    width: 100%;
    color: black;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
  }

  button,
  .flex.items-center.justify-between,
  .fixed.inset-0,
  nav,
  header {
    display: none !important;
  }

  .break-inside-avoid {
    break-inside: avoid;
  }
}
</style>
