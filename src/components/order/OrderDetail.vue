<template>
  <div class="base-container">
    <!-- Screen View (网页模式) -->
    <div class="screen-view space-y-6">


      <!-- 主要内容区域 Grid -->
      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <!-- 左侧：图片区域 (PC端占 8列) -->
        <div class="order-last min-w-0 space-y-4 lg:order-first lg:col-span-8">
          <!-- 商品图片 -->
          <OrderFileGrid :files="order.files" @preview="handlePreview" />

          <!-- 商品信息 (PC端显示在左侧下方，放大显示) -->
          <OrderInfoCard
            :data="currentData"
            :quantity="order.quantity || 1"
            :has-correction="hasCorrection"
            @view-correction="showCorrectionModal = true"
          />
        </div>

        <!-- 右侧：信息区域 (PC端占 4列) -->
        <div class="min-w-0 space-y-4 lg:col-span-4">
          <!-- 客户信息 (仅当有有效客户数据时显示) -->
          <OrderPersonCard
            v-if="hasCustomerInfo"
            :title="t('customer.detail.title')"
            :name="order.customer.name"
            :subtitle="order.customer.company"
            :phone="order.customer.phone"
            avatar-class="bg-info-bg text-info"
          />

          <!-- 销售人员信息 (仅管理员可见) -->
          <OrderPersonCard
            v-if="(mode === 'admin' || !mode) && order.salesperson"
            :title="t('order.detail.submittedBy')"
            :name="order.salesperson.name"
            :subtitle="order.salesperson.store"
            :phone="order.salesperson.phone"
            avatar-class="bg-primary-bg text-primary"
          />

          <!-- 订单头部 -->
          <OrderStatusHeader
            :order-no="order.orderNo"
            :product-name="currentData.name"
            :status="order.status"
            :quantity="order.quantity || 1"
          />

          <!-- 时间轴 (PC端窄栏显示，移动端通用) -->
          <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4">
            <h3 class="text-primary mb-4 text-sm font-medium">{{ t('order.detail.timeline') }}</h3>
            <OrderTimeline :timeline="order.timeline" />
          </div>

          <div
            v-if="markReadError"
            class="rounded-xl border border-warning/30 bg-(--color-warning-bg)/60 p-3"
            data-testid="mark-read-warning"
          >
            <p class="text-sm text-(--text-main)">{{ markReadError }}</p>
            <button
              type="button"
              class="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-(--text-inverse)"
              data-testid="mark-read-retry"
              @click="retryMarkAsRead"
            >
              {{ t('common.retry') }}
            </button>
          </div>



          <!-- 留言输入 -->
          <OrderCommentInput
            ref="commentInputRef"
            :error="commentError"
            :pending-comment="pendingComment"
            @submit="sendComment"
            @retry="retryComment"
          />
        </div>
      </div>

      <!-- 修正对比弹窗 -->
      <Modal
        v-model="showCorrectionModal"
        :title="t('order.detail.correctionCompare')"
        size="md"
        body-class="max-h-[60vh] overflow-y-auto space-y-4 p-4"
      >
        <div
          v-for="correction in corrections"
          :key="correction.id"
          class="rounded-lg border border-(--border-color) p-3"
        >
          <p class="mb-2 text-xs text-(--text-secondary)">{{ formatTime(correction.createdAt) }}</p>
          <div class="flex items-start gap-2 text-sm">
            <span class="shrink-0 pt-0.5 text-(--text-secondary)">{{ correction.fieldName }}:</span>
            <span class="text-danger/60 min-w-0 flex-1 wrap-break-word line-through"> {{ correction.oldValue }}</span>
            <AppIcon name="arrow-right" class="mt-0.5 size-4 shrink-0 text-(--text-secondary)" />
            <span class="text-success min-w-0 flex-1 font-medium wrap-break-word">{{ correction.newValue }}</span>
          </div>
          <p class="mt-2 text-xs wrap-break-word whitespace-pre-wrap text-(--text-secondary)">
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
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import { useSalesToken } from '@/composables/useSalesToken';
import { useLightbox } from '@/composables/useLightbox';
import { formatTimelineTime } from '@/utils/formatters';
import AppIcon from '@/components/ui/AppIcon.vue';


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
import Lightbox from '@/components/ui/Lightbox.vue';

const props = defineProps({
  order: { type: Object, required: true },
  mode: { type: String, default: 'sales' },
  commentError: { type: String, default: '' },
  pendingComment: { type: String, default: '' },
  commentClearKey: { type: Number, default: 0 },
});

const emit = defineEmits(['back', 'comment', 'refresh', 'duplicate', 'edit', 'delete-order']);

const { t } = useI18n();
const { addToast } = useToast();

const showCorrectionModal = ref(false);
const showEditModal = ref(false);
const submitting = ref(false);
const printViewRef = ref(null);
const commentInputRef = ref(null);
const markReadError = ref('');

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
    const response = await fetch(API.SALES_ORDER_READ(salesToken.value, props.order.id), {
      method: 'PATCH',
      credentials: 'include',
    });
    if (!response.ok) {
      markReadError.value = t('common.loadFailed');
      return;
    }
    markReadError.value = '';
    emit('refresh');
  } catch (_e) {
    markReadError.value = t('common.networkError');
  }
};

const retryMarkAsRead = async () => {
  await markAsRead();
};

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

const retryComment = (text) => {
  const retryText = text || props.pendingComment || commentInputRef.value?.getText?.() || '';
  if (!retryText) return;
  emit('comment', retryText);
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

  const { updates, fileIds, reason, productId, variantId } = payload;

  submitting.value = true;
  try {
    // 发送正确的 payload 结构：updates, reason, fileIds 都在顶层
    const requestBody = { updates, reason };
    if (fileIds) {
      requestBody.fileIds = fileIds;
    }
    if (productId !== undefined) {
      requestBody.productId = productId;
    }
    if (variantId !== undefined) {
      requestBody.variantId = variantId;
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

  import('html2pdf.js').then((module) => {
    const html2pdf = module.default;
    html2pdf()
      .set(opt)
      .from(clone)
      .save()
      .then(() => {
        document.body.removeChild(clone);
      });
  });
};

watch(
  () => props.commentClearKey,
  () => {
    commentInputRef.value?.clear?.();
  }
);

onMounted(() => {
  markAsRead();
});

defineExpose({ handleSavePdf, handleVoid, retryMarkAsRead });
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
