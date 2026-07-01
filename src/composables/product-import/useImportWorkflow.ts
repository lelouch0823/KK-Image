import { ref, computed, watch } from 'vue';

export function useImportWorkflow(modelValue, { t, resetCallback }) {
  const currentStep = ref(1); // 1: Upload, 3: Mapping, 5: Image Match, 4: Preview

  let importRequestId = 0;
  let imageUploadRequestId = 0;
  let fileParseRequestId = 0;

  const WORKFLOW_STEPS = [
    {
      id: 'upload',
      order: 1,
      label: t('product.import.step_upload', '上传文件'),
      hint: t('product.import.workflow_hint_upload', '上传 Excel/CSV 并自动识别列头'),
    },
    {
      id: 'mapping',
      order: 2,
      label: t('product.import.step_mapping', '列映射'),
      hint: t('product.import.workflow_hint_mapping', '确认字段映射、规格配置与导入策略'),
    },
    {
      id: 'images',
      order: 3,
      label: t('product.import.step_image', '图片匹配'),
      hint: t('product.import.workflow_hint_images', '可选：为本地图片引用匹配文件'),
    },
    {
      id: 'preview',
      order: 4,
      label: t('product.import.step_verify', '确认导入'),
      hint: t('product.import.workflow_hint_preview', '查看统计、冲突与导入结果'),
    },
  ];

  const currentStepIndex = computed(() => {
    if (currentStep.value === 1) return 1;
    if (currentStep.value === 3) return 2;
    if (currentStep.value === 5) return 3;
    if (currentStep.value === 4) return 4;
    return 1;
  });

  const isWorkflowCompleted = (order) => currentStepIndex.value > order;
  const isWorkflowActive = (order) => currentStepIndex.value === order;
  const getWorkflowStepClass = (order) => {
    if (isWorkflowCompleted(order)) return 'border-success bg-success/10 text-success';
    if (isWorkflowActive(order)) return 'border-primary bg-primary/10 text-primary';
    return 'border-(--border-color) bg-(--bg-muted) text-(--text-secondary)';
  };
  const currentWorkflowHint = computed(
    () => WORKFLOW_STEPS.find((step) => step.order === currentStepIndex.value)?.hint || ''
  );

  const invalidateImportRequest = () => {
    importRequestId += 1;
    imageUploadRequestId += 1;
    fileParseRequestId += 1;
  };

  const isImportRequestActive = (requestId) => requestId === importRequestId && modelValue();
  const isImageUploadActive = (requestId) =>
    requestId === imageUploadRequestId && modelValue();
  const isFileParseActive = (requestId) => requestId === fileParseRequestId && modelValue();

  const getImportRequestId = () => ++importRequestId;
  const getImageUploadRequestId = () => ++imageUploadRequestId;
  const getFileParseRequestId = () => ++fileParseRequestId;

  const handleBack = ({ hasImageWorkflowState }) => {
    if (currentStep.value === 3) {
      return true; // signal: resetFile needed
    } else if (currentStep.value === 5) {
      currentStep.value = 3;
    } else if (currentStep.value === 4) {
      currentStep.value = hasImageWorkflowState ? 5 : 3;
    }
    return false;
  };

  watch(
    () => modelValue(),
    (visible) => {
      if (!visible) {
        invalidateImportRequest();
        resetCallback();
        currentStep.value = 1;
      }
    }
  );

  return {
    currentStep,
    WORKFLOW_STEPS,
    currentStepIndex,
    isWorkflowCompleted,
    isWorkflowActive,
    getWorkflowStepClass,
    currentWorkflowHint,
    invalidateImportRequest,
    isImportRequestActive,
    isImageUploadActive,
    isFileParseActive,
    getImportRequestId,
    getImageUploadRequestId,
    getFileParseRequestId,
    handleBack,
  };
}
