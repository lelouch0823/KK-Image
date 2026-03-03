import { ref, reactive } from 'vue';

export function usePurchaseOrderModals() {
  // 详情侧滑
  const showDetail = ref(false);
  
  // 主流程弹窗
  const showCreateModal = ref(false);
  const showSuggestions = ref(false);
  
  // 选择器弹窗
  const showOrderPicker = ref(false);
  const showProductPicker = ref(false);
  const pickerTarget = ref('create'); // 'create' | 'detail'
  
  // 交互确认弹窗
  const showShortageConfirm = ref(false);
  const confirmData = reactive({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    loading: false,
    onConfirm: () => {},
  });

  // 辅助状态
  const viewProductId = ref(null);

  // 详情中聚焦的变体（用于 AI 上下文）
  const detailFocusedVariantId = (detail) => {
    const item = (detail?.items || []).find((entry) => entry?.variant_id);
    return item?.variant_id || null;
  };

  const openOrderPicker = (target = 'create') => {
    pickerTarget.value = target;
    showOrderPicker.value = true;
  };

  const openProductPicker = (target = 'create') => {
    pickerTarget.value = target;
    showProductPicker.value = true;
  };

  const closeDetail = () => {
    showDetail.value = false;
  };

  return {
    showDetail,
    showCreateModal,
    showSuggestions,
    showOrderPicker,
    showProductPicker,
    pickerTarget,
    showShortageConfirm,
    confirmData,
    viewProductId,
    detailFocusedVariantId,
    openOrderPicker,
    openProductPicker,
    closeDetail,
  };
}
