import { computed } from 'vue';
import { reconcileVariantSelection } from '@/utils/purchase-order-variant-selection';
import { getSuggestionOrderIds } from '@/views/purchase-orders/drafts.js';
import {
  buildCreatePurchaseItemsPayload,
  getCreateFlowSourceItems,
  getExistingBrands,
  getExcludeOrderIds,
  getSelectedVariantIdsForPicker,
  getShortageItems,
  getTotalCreateQty,
} from '@/views/purchase-orders/create-flow.js';

function buildOrderSelectionDraft(order = {}) {
  const data =
    order.currentData && typeof order.currentData === 'object' ? order.currentData : {};

  return {
    product_id: order.productId || null,
    variant_id: order.variantId || null,
    product_name: order.productName || data.name || '—',
    sku: order.sku || data.sku || data.variant_sku || data.spu || '—',
    brand: order.brand || data.brand || '',
    image: order.mainImage || data.images?.[0] || null,
    quantity: order.quantity || 1,
    unit_cost: data.cost_price || data.price || 0,
    moq: order.moq || null,
    pack_size: order.pack_size || null,
    order_step: order.order_step || null,
    pre_order_id: order.id,
    order_no: order.orderNo || '',
    required_quantity: order.quantity || 1,
  };
}

export function usePurchaseOrderCreateFlow({
  t,
  addToast,
  createForm,
  poItems,
  pickerTarget,
  detail,
  detailRequestId,
  showDetail,
  showCreateModal,
  showSuggestions,
  showShortageConfirm,
  selectedSuggestions,
  createPO,
  createFromOrders,
  addItems,
  removeItem,
  refreshPurchaseOrderViews,
  validateOrderQuantity,
}) {
  const createFlowSourceItems = computed(() =>
    getCreateFlowSourceItems({
      pickerTarget: pickerTarget.value,
      detailItems: detail.value?.items || [],
      poItems,
    })
  );
  const totalCreateQty = computed(() => getTotalCreateQty(poItems));
  const shortageItems = computed(() => getShortageItems(poItems));
  const excludeOrderIds = computed(() => getExcludeOrderIds(createFlowSourceItems.value));
  const selectedVariantIdsForPicker = computed(() =>
    getSelectedVariantIdsForPicker(createFlowSourceItems.value)
  );
  const existingBrands = computed(() => getExistingBrands(createFlowSourceItems.value));
  const selectedSuggestionOrderIds = computed(() =>
    [
      ...new Set(
        (selectedSuggestions.value || []).flatMap((suggestion) => getSuggestionOrderIds(suggestion))
      ),
    ]
  );

  const resetCreateDraftState = () => {
    showCreateModal.value = false;
    createForm.remark = '';
    createForm.currency = 'CNY';
    createForm.estimated_shipping_cost = 0;
    createForm.estimated_tariff_cost = 0;
    createForm.allocation_method = 'by_quantity';
    poItems.splice(0, poItems.length);
  };

  const handleOrdersSelected = async (orders) => {
    const itemsToAdd = [];
    for (const order of orders) {
      const isDuplicate =
        pickerTarget.value === 'create'
          ? poItems.some((item) => item.pre_order_id === order.id)
          : detail.value?.items?.some((item) => item.pre_order_id === order.id);
      if (isDuplicate) continue;
      itemsToAdd.push(buildOrderSelectionDraft(order));
    }

    if (itemsToAdd.length === 0) return;
    const validItems = itemsToAdd.filter((item) => item.product_id && item.variant_id);
    if (validItems.length === 0) return;

    if (pickerTarget.value === 'create') {
      poItems.push(...validItems);
      return;
    }

    if (pickerTarget.value === 'detail' && detail.value) {
      const newItems = validItems.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        pre_order_id: item.pre_order_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }));
      const success = await addItems(detail.value.id, newItems);
      if (success) {
        await refreshPurchaseOrderViews(detail.value.id);
      }
    }
  };

  const handleProductsSelected = async ({ selectedVariantIds = [], selectedVariants = [] } = {}) => {
    if (pickerTarget.value === 'create') {
      const { toAdd, toRemoveVariantIds } = reconcileVariantSelection({
        currentItems: poItems,
        selectedVariants,
        selectedVariantIds,
      });

      if (toRemoveVariantIds.length > 0) {
        for (let index = poItems.length - 1; index >= 0; index -= 1) {
          if (!poItems[index].pre_order_id && toRemoveVariantIds.includes(poItems[index].variant_id)) {
            poItems.splice(index, 1);
          }
        }
      }
      if (toAdd.length > 0) {
        poItems.push(...toAdd);
      }
      return;
    }

    if (pickerTarget.value === 'detail' && detail.value) {
      const currentItems = (detail.value.items || []).filter(
        (item) => !item.pre_order_id && item.variant_id
      );
      const { toAdd, toRemoveItemIds } = reconcileVariantSelection({
        currentItems,
        selectedVariants,
        selectedVariantIds,
      });

      if (toRemoveItemIds.length > 0) {
        await Promise.all(toRemoveItemIds.map((itemId) => removeItem(detail.value.id, itemId)));
      }
      if (toAdd.length > 0) {
        const newItems = toAdd.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          pre_order_id: null,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        }));
        await addItems(detail.value.id, newItems);
      }

      if (toRemoveItemIds.length > 0 || toAdd.length > 0) {
        await refreshPurchaseOrderViews(detail.value.id);
      }
    }
  };

  const removePoItem = (index) => {
    poItems.splice(index, 1);
  };

  const executeCreate = async () => {
    showShortageConfirm.value = false;

    for (const item of poItems) {
      const result = validateOrderQuantity(item.quantity || 1, {
        moq: item.moq || 1,
        packSize: item.pack_size || 1,
        orderStep: item.order_step || 1,
      });
      if (!result.valid) {
        addToast({
          type: 'warning',
          message: `${item.product_name} 数量不满足规则，建议数量 ${result.suggestedQuantity}`,
        });
        return;
      }
    }

    const result = await createPO({ ...createForm });
    if (!result) return;

    const items = buildCreatePurchaseItemsPayload(poItems);
    if (items.length > 0) {
      const itemsAdded = await addItems(result.id, items);
      if (!itemsAdded) {
        resetCreateDraftState();
        detailRequestId.value = String(result.id || '');
        showDetail.value = true;
        await refreshPurchaseOrderViews(result.id);
        addToast({
          type: 'warning',
          message: t(
            'purchaseOrder.toast.createdWithoutItems',
            '采购单已创建，但明细添加失败，请检查详情后继续处理'
          ),
        });
        return;
      }
    }

    resetCreateDraftState();
    await refreshPurchaseOrderViews();
  };

  const handleCreate = async () => {
    if (poItems.length === 0) return;
    if (shortageItems.value.length > 0) {
      showShortageConfirm.value = true;
      return;
    }
    await executeCreate();
  };

  const handleCreateFromSuggestions = async () => {
    const allOrderIds = selectedSuggestionOrderIds.value;
    if (allOrderIds.length === 0) {
      addToast({
        type: 'warning',
        message: t(
          'purchaseOrder.toast.noBindableSuggestionOrders',
          '所选建议暂无可绑定订单，请改为手动建单或等待新的已确认订单。'
        ),
      });
      return;
    }

    const result = await createFromOrders(allOrderIds, {
      allocation_method: 'by_quantity',
    });
    if (result) {
      showSuggestions.value = false;
      selectedSuggestions.value = [];
      await refreshPurchaseOrderViews();
    }
  };

  return {
    createFlowSourceItems,
    totalCreateQty,
    shortageItems,
    excludeOrderIds,
    selectedVariantIdsForPicker,
    existingBrands,
    selectedSuggestionOrderIds,
    resetCreateDraftState,
    handleOrdersSelected,
    handleProductsSelected,
    removePoItem,
    executeCreate,
    handleCreate,
    handleCreateFromSuggestions,
  };
}
