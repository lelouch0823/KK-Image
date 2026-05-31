export const createPurchaseOrderSteps = (translate: (key: string) => string): { value: string; label: string }[] => [
  { value: 'draft', label: translate('purchaseOrder.status.draft') },
  { value: 'ordered', label: translate('purchaseOrder.status.ordered') },
  { value: 'shipping', label: translate('purchaseOrder.status.shipping') },
  { value: 'arrived', label: translate('purchaseOrder.status.arrived') },
  { value: 'completed', label: translate('purchaseOrder.status.completed') },
];

export const getStepIndex = (stepsList: { value: string }[] = [], status: string): number =>
  stepsList.findIndex((step) => step.value === status);

export const isStepCompleted = (stepsList: { value: string }[] = [], currentStatus: string, stepStatus: string): boolean => {
  if (currentStatus === 'cancelled') return false;
  return getStepIndex(stepsList, currentStatus) > getStepIndex(stepsList, stepStatus);
};

export const getStepperProgress = (stepsList: { value: string }[] = [], currentStatus: string): string => {
  if (currentStatus === 'cancelled') return '0%';
  const currentIndex = getStepIndex(stepsList, currentStatus);
  if (currentIndex <= 0) return '0%';
  return `${(currentIndex / (stepsList.length - 1)) * 100}%`;
};

export const getStepIconClasses = (stepsList: { value: string }[] = [], currentStatus: string, stepStatus: string): string => {
  if (currentStatus === 'cancelled') {
    return 'border-(--border-subtle) bg-(--bg-muted) text-(--text-muted)';
  }

  const currentIndex = getStepIndex(stepsList, currentStatus);
  const stepIndex = getStepIndex(stepsList, stepStatus);

  if (currentIndex > stepIndex) {
    return 'border-primary bg-primary text-(--text-inverse)';
  }

  if (currentIndex === stepIndex) {
    return 'border-primary bg-(--bg-card)';
  }

  return 'border-(--border-strong) bg-(--bg-muted)';
};
