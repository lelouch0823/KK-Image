import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('PurchaseOrders decomposition audit', () => {
  it('moves purchase-order view helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'src', 'views', 'PurchaseOrders.vue');
    const helperPaths = [
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'formatters.js'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'progress.js'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'stepper.js'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'drafts.js'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'create-flow.js'),
      path.join(ROOT, 'src', 'composables', 'usePurchaseOrderDetailActions.js'),
      path.join(ROOT, 'src', 'composables', 'usePurchaseOrderCreateFlow.js'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes("@/views/purchase-orders/formatters.js")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order formatter import');
    }

    if (!source.includes("@/views/purchase-orders/progress.js")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order progress helper import');
    }

    if (!source.includes("@/views/purchase-orders/stepper.js")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order stepper helper import');
    }

    if (!source.includes("@/views/purchase-orders/drafts.js")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order draft helper import');
    }

    if (!source.includes("@/composables/usePurchaseOrderDetailActions")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order detail-actions composable import');
    }

    if (!source.includes("@/composables/usePurchaseOrderCreateFlow")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order create-flow composable import');
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
    ]) {
      if (source.includes(marker)) {
        offenders.push(`src/views/PurchaseOrders.vue: still defines ${marker}`);
      }
    }

    expect(
      offenders,
      `PurchaseOrders decomposition offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
