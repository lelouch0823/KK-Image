import { computed, type ComputedRef } from 'vue';
import { reconcileVariantSelection } from '@/utils/purchase-order-variant-selection';
import { getSuggestionOrderIds } from '@/views/purchase-orders/drafts';
import {
  buildCreatePurchaseItemsPayload,
  getCreateFlowSourceItems,
  getExistingBrands,
  getExcludeOrderIds,
  getSelectedVariantIdsForPicker,
  getShortageItems,
  getTotalCreateQty,
} from '@/views/purchase-orders/create-flow';

interface OrderDraft {
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string;
  brand: string;
  image: string | null;
  quantity: number;
  unit_cost: number;
  moq: number | null;
  pack_size: number | null;
  order_step: number | null;
  pre_order_id: string;
  order_no: string;
  required_quantity: number;
}

interface OrderData {
  id: string;
  productId?: string;
  variantId?: string;
  productName?: string;
  sku?: string;
  brand?: string;
  mainImage?: string;
  quantity?: number;
  moq?: number;
  pack_size?: number;
  order_step?: number;
  orderNo?: string;
  currentData?: Record<string, unknown>;
}

interface CreateFormData {
  remark: string;
  currency: string;
  estimated_shipping_cost: number;
  estimated_tariff_cost: number;
  allocation_method: string;
  [key: string]: unknown;
}

interface POItem extends OrderDraft {
  [key: string]: unknown;
}

interface DetailData {
  id: string;
  items?: Array<{ pre_order_id?: string; variant_id?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface Suggestion {
  [key: string]: unknown;
}

interface UsePurchaseOrderCreateFlowOptions {
  t: (key: string, fallback?: string) => string;
  addToast: (options: { type: string; message: string }) => void;
  createForm: CreateFormData;
  poItems: POItem[];
  pickerTarget: { value: string };
  detail: { value: DetailData | null };
  detailRequestId: { value: string };
  showDetail: { value: boolean };
  showCreateModal: { value: boolean };
  showSuggestions: { value: boolean };
  showShortageConfirm: { value: boolean };
  selectedSuggestions: { value: Suggestion[] };
  createPO: (form: CreateFormData) => Promise<DetailData | null>;
  createFromOrders: (orderIds: string[], options: Record<string, unknown>) => Promise<unknown>;
  addItems: (poId: string, items: Record<string, unknown>[]) => Promise<boolean>;
  removeItem: (poId: string, itemId: string) => Promise<boolean>;
  refreshPurchaseOrderViews: (poId?: string) => Promise<void>;
  validateOrderQuantity: (qty: number, rules: { moq: number; packSize: number; orderStep: number }) => { valid: boolean; suggestedQuantity?: number };
}

function buildOrderSelectionDraft(order: OrderData): OrderDraft {
  const data =
    order.currentData && typeof order.currentData === 'object' ? order.currentData : {};

  return {
    product_id: order.productId || null,
    variant_id: order.variantId || null,
    product_name: order.productName || (data.name as string) || '—',
    sku: order.sku || (data.sku as string) || (data.variant_sku as string) || (data.spu as string) || '—',
    brand: order.brand || (data.brand as string) || '',
    image: order.mainImage || (data.images as string[])?.[0] || null,
    quantity: order.quantity || 1,
    unit_cost: (data.cost_price as number) || (data.price as number) || 0,
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
}: UsePurchaseOrderCreateFlowOptions) {
  const createFlowSourceItems: ComputedRef<unknown[]> = computed(() =>
    getCreateFlowSourceItems({
      pickerTarget: pickerTarget.value,
      detailItems: detail.value?.items || [],
      poItems,
    })
  );
  const totalCreateQty: ComputedRef<number> = computed(() => getTotalCreateQty(poItems));
  const shortageItems: ComputedRef<unknown[]> = computed(() => getShortageItems(poItems));
  const excludeOrderIds: ComputedRef<string[]> = computed(() => getExcludeOrderIds(createFlowSourceItems.value));
  const selectedVariantIdsForPicker: ComputedRef<string[]> = computed(() =>
    getSelectedVariantIdsForPicker(createFlowSourceItems.value)
  );
  const existingBrands: ComputedRef<string[]> = computed(() => getExistingBrands(createFlowSourceItems.value));
  const selectedSuggestionOrderIds: ComputedRef<string[]> = computed(() =>
    [
      ...new Set(
        (selectedSuggestions.value || []).flatMap((suggestion) => getSuggestionOrderIds(suggestion))
      ),
    ]
  );

  const resetCreateDraftState = (): void => {
    showCreateModal.value = false;
    createForm.remark = '';
    createForm.currency = 'CNY';
    createForm.estimated_shipping_cost = 0;
    createForm.estimated_tariff_cost = 0;
    createForm.allocation_method = 'by_quantity';
    poItems.splice(0, poItems.length);
  };

  const handleOrdersSelected = async (orders: OrderData[]): Promise<void> => {
    const itemsToAdd: OrderDraft[] = [];
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
      poItems.push(...(validItems as any[]));
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

  const handleProductsSelected = async ({ selectedVariantIds = [], selectedVariants = [] }: { selectedVariantIds?: string[]; selectedVariants?: Record<string, unknown>[] } = {}): Promise<void> => {
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
        await Promise.all(toRemoveItemIds.map((itemId: string) => removeItem(detail.value!.id, itemId)));
      }
      if (toAdd.length > 0) {
        const newItems = toAdd.map((item: Record<string, unknown>) => ({
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

  const removePoItem = (index: number): void => {
    poItems.splice(index, 1);
  };

  const executeCreate = async (): Promise<void> => {
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

  const handleCreate = async (): Promise<void> => {
    if (poItems.length === 0) return;
    if (shortageItems.value.length > 0) {
      showShortageConfirm.value = true;
      return;
    }
    await executeCreate();
  };

  const handleCreateFromSuggestions = async (): Promise<void> => {
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
