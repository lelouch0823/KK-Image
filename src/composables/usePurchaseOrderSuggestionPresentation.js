import { computed } from 'vue';

export function usePurchaseOrderSuggestionPresentation({
  suggestions,
  selectedSuggestions,
  t,
  formatInteger,
}) {
  const suggestionSummaryCards = computed(() => {
    const suggestionList = suggestions.value || [];
    const selectedList = selectedSuggestions.value || [];

    if (suggestionList.length === 0) return [];

    const totalShortage = suggestionList.reduce((sum, item) => sum + Number(item.shortage || 0), 0);
    const selectedShortage = selectedList.reduce((sum, item) => sum + Number(item.shortage || 0), 0);

    return [
      {
        key: 'candidates',
        label: t('purchaseOrder.ui.candidateVariants', '候选变体'),
        value: formatInteger(suggestionList.length),
        hint: t(
          'purchaseOrder.ui.candidateVariantsHint',
          '按当前订货缺口和库存情况筛出的待采购对象。'
        ),
      },
      {
        key: 'shortage',
        label: t('purchaseOrder.ui.totalShortage', '总缺口'),
        value: formatInteger(totalShortage),
        hint: t('purchaseOrder.ui.totalShortageHint', '全部建议项汇总的待补数量。'),
      },
      {
        key: 'selected',
        label: t('purchaseOrder.ui.selectedPlan', '已选建议'),
        value: formatInteger(selectedList.length),
        hint: `${t('purchaseOrder.suggestions.shortage')} ${formatInteger(selectedShortage)}`,
      },
    ];
  });

  return {
    suggestionSummaryCards,
  };
}
