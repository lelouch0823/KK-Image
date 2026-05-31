import { ref, reactive, type Ref } from 'vue';

interface ConfirmData {
  show: boolean;
  title: string;
  message: string;
  type: string;
  loading: boolean;
  onConfirm: () => void;
}

interface DetailWithItems {
  items?: Array<{ variant_id?: string }>;
  [key: string]: unknown;
}

export function usePurchaseOrderModals() {
  // 详情侧滑
  const showDetail: Ref<boolean> = ref(false);

  // 主流程弹窗
  const showCreateModal: Ref<boolean> = ref(false);
  const showSuggestions: Ref<boolean> = ref(false);

  // 选择器弹窗
  const showOrderPicker: Ref<boolean> = ref(false);
  const showProductPicker: Ref<boolean> = ref(false);
  const pickerTarget: Ref<string> = ref('create'); // 'create' | 'detail'

  // 交互确认弹窗
  const showShortageConfirm: Ref<boolean> = ref(false);
  const confirmData: ConfirmData = reactive({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    loading: false,
    onConfirm: () => {},
  });

  // 辅助状态
  const viewProductId: Ref<string | null> = ref(null);

  // 详情中聚焦的变体（用于 AI 上下文）
  const detailFocusedVariantId = (detail: DetailWithItems | null | undefined): string | null => {
    const item = (detail?.items || []).find((entry) => entry?.variant_id);
    return item?.variant_id || null;
  };

  const openOrderPicker = (target = 'create'): void => {
    pickerTarget.value = target;
    showOrderPicker.value = true;
  };

  const openProductPicker = (target = 'create'): void => {
    pickerTarget.value = target;
    showProductPicker.value = true;
  };

  const closeDetail = (): void => {
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
