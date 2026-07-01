import {
  onMounted,
  onActivated,
  onDeactivated,
  onUnmounted,
  watch,
  computed,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAI } from '@/composables/useAI';

/**
 * 页面生命周期与订阅逻辑：挂载/激活/失活/销毁、路由联动、AI 上下文同步。
 * 将 watch + 生命周期钩子从页面主文件中抽出，降低主文件行数和认知负担。
 */
export function usePurchaseOrderPageLifecycle({
  subscribeModule,
  loadPurchaseOrderOverview,
  loadSuggestions,
  openDetail,
  showDetail,
  showCreateModal,
  showSuggestions,
  showProductPicker,
  viewProductId,
  selectedVariantIdsForPicker,
  selectedSuggestions,
  detail,
  getDetailFocusedVariantId,
  hasPoDraft,
  clearPoDraft,
  resetCostModalState,
  resetReceiptModalState,
  resetReceiptReversalState,
}) {
  const route = useRoute();
  const router = useRouter();
  const { setContext } = useAI();

  let stopPurchaseOrdersRefreshSubscription = null;

  const detailFocusedVariantId = computed(() => getDetailFocusedVariantId(detail.value));

  // 页面挂载后订阅采购单模块刷新事件。
  // 只有在未打开抽屉时才静默刷新 overview，避免打断用户正在编辑的上下文。
  onMounted(() => {
    stopPurchaseOrdersRefreshSubscription = subscribeModule('purchaseOrders', async () => {
      if (!showCreateModal.value && !showDetail.value) {
        await loadPurchaseOrderOverview();
      }
    });
  });

  // keep-alive 激活时重新拉取概览。
  // 如果 URL 上带了 id，则自动恢复详情抽屉。
  onActivated(async () => {
    await loadPurchaseOrderOverview();

    if (route.query.id) {
      const targetId = route.query.id;
      openDetail(targetId);
    }
  });

  // 详情抽屉关闭时，负责清理路由 query 和各种明细弹层状态。
  watch(showDetail, (isOpen) => {
    if (!isOpen && route.query.id) {
      const newQuery = { ...route.query };
      delete newQuery.id;
      router.replace({ path: route.path, query: newQuery });
    }
    if (!isOpen) {
      resetCostModalState();
      resetReceiptModalState();
      resetReceiptReversalState();
    }
  });

  // 智能建议每次打开都重新清空勾选并拉取，关闭时也做清理，避免脏选择遗留。
  watch(showSuggestions, (v) => {
    if (v) {
      selectedSuggestions.value = [];
      loadSuggestions();
      return;
    }
    selectedSuggestions.value = [];
  });

  // 采购单创建弹窗关闭时清除草稿（创建成功或取消后表单已被重置）
  watch(showCreateModal, (isOpen) => {
    if (!isOpen && hasPoDraft.value) {
      clearPoDraft();
    }
  });

  // 把当前采购上下文同步到 AI：
  // 商品选择器优先，其次是显式商品详情，再其次是详情抽屉聚焦的变体，最后才回退到路由 query。
  watch(
    [
      showProductPicker,
      selectedVariantIdsForPicker,
      viewProductId,
      showDetail,
      detailFocusedVariantId,
      () => route.query.variantId,
    ],
    ([pickerOpen, selectedVariantIds, productId, detailOpen, detailVariantId, routeVariantId]) => {
      if (pickerOpen) {
        setContext({
          selectedId: selectedVariantIds[0] || null,
          selectedType: 'variant',
        });
        return;
      }
      if (productId) {
        setContext({
          selectedId: productId,
          selectedType: 'product',
        });
        return;
      }
      if (detailOpen && detailVariantId) {
        setContext({
          selectedId: detailVariantId,
          selectedType: 'variant',
        });
        return;
      }
      if (typeof routeVariantId === 'string' && routeVariantId.trim()) {
        setContext({
          selectedId: routeVariantId.trim(),
          selectedType: 'variant',
        });
        return;
      }
      setContext({
        selectedId: null,
        selectedType: null,
      });
    }
  );

  // 页面失活时清空 AI 上下文，避免其它页面继承采购单的上下文对象。
  onDeactivated(() => {
    setContext({
      selectedId: null,
      selectedType: null,
    });
  });

  // 页面销毁时显式退订刷新总线，避免重复订阅。
  onUnmounted(() => {
    stopPurchaseOrdersRefreshSubscription?.();
    stopPurchaseOrdersRefreshSubscription = null;
  });
}
