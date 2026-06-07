<template>
  <div class="mx-auto w-full max-w-2xl space-y-4 pb-8" :data-sales-order-mode="salesOrderEntry">
    <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-3">
      <p class="text-xs font-medium text-(--text-secondary)">
        {{ t('order.binding.salesGuide') }}
      </p>
    </div>

    <ProductBindingSection
      :key="productBindingKey"
      mode="sales"
      :sales-token="String(route.params.token || '')"
      :bound-product="boundProduct"
      :variant-select-policy="'in_stock_only'"
      @select="handleProductSelect"
      @unbind="unbindProduct"
      @product-fetch-error="handleProductFetchError"
      @product-fetch-success="clearProductFetchError"
    />

    <div
      v-if="productFetchError"
      class="rounded-xl border border-(--color-danger-text)/20 bg-(--color-danger-bg)/40 p-3"
      data-testid="product-fetch-error"
    >
      <p class="text-sm text-(--text-main)">{{ productFetchError }}</p>
      <AppButton
        type="button"
        variant="primary"
        size="sm"
        class="mt-2"
        data-testid="product-fetch-retry"
        @click="retryProductFetch"
      >
        {{ t('common.retry') }}
      </AppButton>
    </div>

    <OrderForm
      :prefill="formData"
      :submit-progress="submitProgress"
      :disabled-fields="disabledFields"
      :bound-product-variant="boundProductVariant"
      :submit-error="submitError"
      @submit="handleSubmit"
      @cancel="handleCancel"
    />
  </div>
</template>

<script setup>
import { ref, inject, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useOrders } from '@/composables/useOrders';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import AppButton from '@/components/ui/AppButton.vue';
import OrderForm from '@/components/order/OrderForm.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';
import { ORDER_BOUND_SNAPSHOT_FIELDS } from '@/utils/order-binding-fields.js';
import { parseJsonObject } from '@/utils/json.js';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const { addToast } = useToast();
const { createSalesOrder } = useOrders();

const salesContext = inject('salesContext', {});
const {
  prefillData = ref(null),
  setPrefillData = () => {},
  loadOrders = async () => {},
  salesOrderMode = ref('legacy'),
} = salesContext;
const salesOrderEntry = computed(() => salesOrderMode.value || 'legacy');

const submitProgress = ref({ step: '', current: 0, total: 0 });

const LOCKED_FIELDS = ORDER_BOUND_SNAPSHOT_FIELDS;
const COLOR_LABELS = ['color', '颜色', '顏色'];
const MATERIAL_LABELS = ['material', '材质', '材質'];

const boundProduct = ref(null);
const selectedProductId = ref(null);
const boundProductVariant = ref(null);
const formData = ref({});
const productFetchError = ref('');
const submitError = ref('');
const productBindingKey = ref(0);

const disabledFields = computed(() => (boundProduct.value ? LOCKED_FIELDS : []));

const applyInitialPrefill = (data) => {
  if (!boundProduct.value) {
    formData.value = data ? { ...data } : {};
  }
};

watch(
  prefillData,
  (data) => {
    applyInitialPrefill(data);
  },
  { immediate: true }
);

const handleProductSelect = (product) => {
  const variant = product.selectedVariant;
  if (!variant) return;

  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: variant.sku,
    brand: product.brand,
    series: product.series,
    variantId: variant.id,
    mainImage: product.mainImage || null,
  };
  selectedProductId.value = product.id;

  let options = variant.options_values || {};
  options = parseJsonObject(options, {});

  const dimensionMap = product.dimension_map || {};
  const mappedOptions = {};
  let extractedColor = '';
  let extractedMaterial = '';
  const otherSpecs = [];

  for (const [key, val] of Object.entries(options || {})) {
    if (!val) continue;
    const readableKey = dimensionMap[key] || key;
    mappedOptions[readableKey] = val;

    const lowerKey = String(readableKey).toLowerCase();
    if (COLOR_LABELS.includes(lowerKey)) {
      extractedColor = String(val);
    } else if (MATERIAL_LABELS.includes(lowerKey)) {
      extractedMaterial = String(val);
    } else {
      otherSpecs.push(`${readableKey}: ${val}`);
    }
  }

  const nextData = {
    ...(formData.value || {}),
    name: product.name || '',
    brand: product.brand || '',
    series: product.series || '',
    sku: variant.sku || '',
    color: extractedColor || '',
    material: extractedMaterial || '',
    size: otherSpecs.join('，') || '',
  };

  if (boundProduct.value.mainImage) {
    nextData.files = [
      {
        url: boundProduct.value.mainImage,
        isLocal: false,
      },
    ];
  }

  formData.value = nextData;
  boundProductVariant.value = mappedOptions;
  clearProductFetchError();
};

const unbindProduct = () => {
  boundProduct.value = null;
  selectedProductId.value = null;
  boundProductVariant.value = null;
  clearProductFetchError();
};

const handleProductFetchError = (message) => {
  productFetchError.value = message || t('common.loadFailed');
};

const clearProductFetchError = () => {
  productFetchError.value = '';
};

const retryProductFetch = () => {
  productFetchError.value = '';
  productBindingKey.value += 1;
};

const handleSubmit = async (payload) => {
  submitError.value = '';
  const handleProgress = (step, current, total) => {
    submitProgress.value = { step, current, total };
  };

  const nextPayload = { ...payload };
  if (selectedProductId.value) {
    if (!boundProduct.value?.variantId) {
      addToast({ message: t('order.binding.variantRequired'), type: 'error' });
      return;
    }
    nextPayload.productId = selectedProductId.value;
    nextPayload.variantId = boundProduct.value.variantId;
  }

  const result = await createSalesOrder(route.params.token, nextPayload, handleProgress);
  const isSuccess = result === true || result?.ok === true;

  submitProgress.value = { step: '', current: 0, total: 0 };

  if (isSuccess) {
    if (loadOrders) await loadOrders();
    router.push(`/sales/${route.params.token}`);
    return true;
  }

  submitError.value = result?.error || t('common.loadFailed');
  return false;
};

const handleCancel = () => {
  router.push(`/sales/${route.params.token}`);
};

onUnmounted(() => {
  if (setPrefillData) setPrefillData(null);
});
</script>
