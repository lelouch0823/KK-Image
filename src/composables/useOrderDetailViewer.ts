import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

interface OrderBrief {
  id: string;
  [key: string]: unknown;
}

interface UseOrderDetailViewerOptions {
  /** 获取完整订单详情的函数 */
  getOrder: (id: string) => Promise<unknown>;
  /** 关闭详情弹窗后的回调（可选），用于刷新列表等 */
  onClose?: () => void;
  /** 刷新详情完成后的回调（可选），用于级联刷新 */
  onRefresh?: () => void | Promise<void>;
  /** 添加评论的函数（可选），传入后会暴露 handleComment */
  addComment?: (id: string, comment: string) => Promise<boolean>;
}

/**
 * 订单详情查看器 composable，消除 Dashboard 和 OrderPickerModal 中重复的
 * viewOrder / refreshOrderDetail / handleComment 模式。
 */
export function useOrderDetailViewer(options: UseOrderDetailViewerOptions) {
  const { getOrder, onClose, onRefresh, addComment } = options;
  const { t } = useI18n();

  const showDetailModal = ref(false);
  const viewingOrder = ref<OrderBrief | null>(null);
  const detailHydrating = ref(false);
  const detailHydrationError = ref('');
  const commenting = ref(false);
  let detailRequestId = 0;

  /** 使当前进行中的请求失效 */
  function invalidateDetailRequests() {
    detailRequestId += 1;
    detailHydrating.value = false;
  }

  /** 查看订单详情，带竞态保护 */
  async function viewOrder(order: OrderBrief) {
    const requestId = ++detailRequestId;
    viewingOrder.value = order ? { ...order } : null;
    showDetailModal.value = true;
    detailHydrationError.value = '';
    detailHydrating.value = true;
    try {
      const fullOrder = await getOrder(order.id);
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      if (fullOrder) {
        viewingOrder.value = fullOrder as OrderBrief;
      } else {
        detailHydrationError.value = t('common.loadFailed');
      }
    } catch {
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      detailHydrationError.value = t('common.networkError');
    } finally {
      if (requestId === detailRequestId) {
        detailHydrating.value = false;
      }
    }
  }

  /** 关闭详情弹窗 */
  function closeDetail() {
    invalidateDetailRequests();
    showDetailModal.value = false;
    viewingOrder.value = null;
    detailHydrationError.value = '';
    detailHydrating.value = false;
    onClose?.();
  }

  /** 刷新当前查看的订单详情 */
  async function refreshOrderDetail() {
    if (!viewingOrder.value) return;
    const requestId = ++detailRequestId;
    detailHydrationError.value = '';
    detailHydrating.value = true;
    try {
      const fullOrder = await getOrder(viewingOrder.value.id);
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      if (fullOrder) {
        viewingOrder.value = fullOrder as OrderBrief;
      } else {
        detailHydrationError.value = t('common.loadFailed');
      }
    } catch {
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      detailHydrationError.value = t('common.networkError');
    } finally {
      if (requestId === detailRequestId) {
        detailHydrating.value = false;
      }
    }
    await onRefresh?.();
  }

  /** 添加评论并刷新详情（仅在传入 addComment 时可用） */
  async function handleComment(comment: string) {
    if (!addComment || !viewingOrder.value || !comment.trim() || commenting.value) return;
    commenting.value = true;
    try {
      const success = await addComment(viewingOrder.value.id, comment);
      if (success) {
        await refreshOrderDetail();
      }
    } finally {
      commenting.value = false;
    }
  }

  return {
    showDetailModal,
    viewingOrder,
    detailHydrating,
    detailHydrationError,
    commenting,
    viewOrder,
    closeDetail,
    refreshOrderDetail,
    handleComment,
  };
}
