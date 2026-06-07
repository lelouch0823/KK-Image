import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('PurchaseOrders decomposition audit', () => {
  it('moves purchase-order view helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'src', 'views', 'PurchaseOrders.vue');
    const helperPaths = [
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'progress.ts'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'stepper.ts'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'drafts.ts'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'create-flow.ts'),
      path.join(ROOT, 'src', 'composables', 'usePurchaseOrderDetailActions.ts'),
      path.join(ROOT, 'src', 'composables', 'usePurchaseOrderCreateFlow.ts'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes('@/utils/formatters')) {
      offenders.push(
        'src/views/PurchaseOrders.vue: missing formatter import from @/utils/formatters'
      );
    }

    if (!source.includes('@/views/purchase-orders/progress')) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order progress helper import');
    }

    if (!source.includes('@/views/purchase-orders/stepper')) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order stepper helper import');
    }

    if (!source.includes('@/views/purchase-orders/drafts')) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order draft helper import');
    }

    if (!source.includes('@/composables/usePurchaseOrderDetailActions')) {
      offenders.push(
        'src/views/PurchaseOrders.vue: missing purchase-order detail-actions composable import'
      );
    }

    if (!source.includes('@/composables/usePurchaseOrderCreateFlow')) {
      offenders.push(
        'src/views/PurchaseOrders.vue: missing purchase-order create-flow composable import'
      );
    }

    for (const expectedImport of [
      '@/components/purchase-order/PurchaseOrderOverviewBanner.vue',
      '@/components/purchase-order/PurchaseOrderListTable.vue',
      '@/components/purchase-order/PurchaseOrderDetailDrawer.vue',
      '@/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      '@/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue',
      '@/components/purchase-order/PurchaseOrderCostModal.vue',
      '@/components/purchase-order/PurchaseOrderReceiptModal.vue',
      '@/components/purchase-order/PurchaseOrderShortageModal.vue',
      '@/components/purchase-order/PurchaseOrderReceiptReversalModal.vue',
      '@/composables/usePurchaseOrderListPresentation',
      '@/composables/usePurchaseOrderDetailPresentation',
    ]) {
      if (!source.includes(expectedImport)) {
        offenders.push(
          `src/views/PurchaseOrders.vue: missing future decomposition import ${expectedImport}`
        );
      }
    }

    for (const marker of [
      'const formatDate = (ts) => {',
      'const formatDateTime = (ts) => {',
      'const buildReceiptProgressSummary = (record = {}) => {',
      'const buildReceiptMeta = (record = {}) => {',
      'const getStepIndex = (status) => {',
      'const isStepCompleted = (currentStatus, stepStatus) => {',
      'const getStepperProgress = (currentStatus) => {',
      'const getStepIconClasses = (currentStatus, stepStatus) => {',
      'function normalizeReceiptQty(value) {',
      'function normalizeDecimal(value, fallback = 0) {',
      'function normalizeNullableDecimal(value) {',
      'function isReceiptDraftInvalid(entry = {}) {',
      'function isShortageDraftInvalid(entry = {}) {',
      'const buildSuggestionVariantLabel = (variantOptions = {}) =>',
      'const buildSuggestionMeta = (suggestion) => {',
      'function getSuggestionOrderIds(suggestion = {}) {',
      'const totalCreateQty = computed(() => poItems.reduce((sum, i) => sum + (i.quantity || 0), 0))',
      'const shortageItems = computed(() =>',
      'const excludeOrderIds = computed(() => {',
      'const selectedVariantIdsForPicker = computed(() => {',
      'const existingBrands = computed(() => {',
      'const saveCostSettings = async ({ allocateAfterSave = false } = {}) => {',
      'const openReceiptModal = () => {',
      'const submitReceipts = async () => {',
      'const submitShortageClosures = async () => {',
      'const submitReceiptReversal = async () => {',
      'const handleOrdersSelected = async (orders) => {',
      'const handleProductsSelected = async ({ selectedVariantIds = [], selectedVariants = [] } = {}) => {',
      'const handleCreate = async () => {',
      'const executeCreate = async () => {',
      'const handleCreateFromSuggestions = async () => {',
      'data-testid="purchase-order-console-banner"',
      'data-testid="purchase-order-detail-shell"',
      'data-testid="purchase-order-create-shell"',
      'data-testid="purchase-order-suggestions-shell"',
    ]) {
      if (source.includes(marker)) {
        offenders.push(`src/views/PurchaseOrders.vue: still defines ${marker}`);
      }
    }

    expect(offenders, `PurchaseOrders decomposition offenders:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
