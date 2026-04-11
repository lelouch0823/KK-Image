<template>
  <Modal
    :model-value="modelValue"
    size="2xl"
    :title="t('order.manage.createTitle')"
    @update:model-value="$emit('update:modelValue', false)"
  >
    <div class="p-4 sm:p-6">
      <div class="space-y-5">
        <!-- Product Binding Section -->
        <ProductBindingSection
          :bound-product="boundProduct"
          :variant-select-policy="'allow_out_of_stock'"
          @select="handleProductSelect"
          @unbind="unbindProduct"
        />

        <OrderForm
          ref="orderFormRef"
          mode="admin"
          :salespersons="salespersons"
          :statuses="statuses"
          :submit-progress="submitProgress"
          :prefill="formData"
          :disabled-fields="disabledFields"
          :bound-product-variant="boundProductVariant"
          @submit="handleSubmit"
          @cancel="$emit('update:modelValue', false)"
        />
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { resolveSelectedVariantMainImageSrc } from '@/utils/product-image.js';
import Modal from '@/components/ui/Modal.vue';
import OrderForm from '@/components/order/OrderForm.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';

const props = defineProps({
  modelValue: Boolean,
  salespersons: { type: Array, default: () => [] },
  statuses: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'submit']);
const { t } = useI18n();

const submitProgress = ref({ step: '', current: 0, total: 0 });

// Bound Product State
const boundProduct = ref(null);
const selectedProductId = ref(null);

// Form Data for pre-filling
const formData = ref({});
const boundProductVariant = ref(null);

// Locked fields when product is bound
const LOCKED_FIELDS = ['name', 'brand', 'series', 'sku'];
const disabledFields = computed(() => boundProduct.value ? LOCKED_FIELDS : []);

const getProductMainImage = (product) => resolveSelectedVariantMainImageSrc(product);

const handleProductSelect = (product) => {
  const mainImage = getProductMainImage(product);
  const variant = product.selectedVariant;
  if (!variant) return;
  
  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: variant.sku,
    brand: product.brand,
    series: product.series,
    variantId: variant.id,
    mainImage,
  };
  selectedProductId.value = product.id;

  // Extract variant specs
  let options = variant.options_values || {};
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { options = {}; }
  }

  // Map option IDs to names using dimension_map
  const dimensionMap = product.dimension_map || {};

  const mappedOptions = {};
  let extractedColor = '';
  let extractedMaterial = '';
  const otherSpecs = [];

  for (const [key, val] of Object.entries(options)) {
    if (!val) continue;
    const readableKey = dimensionMap[key] || key;
    mappedOptions[readableKey] = val;

    const lowerKey = readableKey.toLowerCase();
    if (['color', '颜色', '顏色'].includes(lowerKey)) {
      extractedColor = String(val);
    } else if (['material', '材质', '材質'].includes(lowerKey)) {
      extractedMaterial = String(val);
    } else {
      otherSpecs.push(`${readableKey}: ${val}`);
    }
  }

  // Auto-fill form fields
  // SOTA: Use formData ref to trigger OrderForm's watch prefill
  const newData = {
    name: product.name || '',
    brand: product.brand || '',
    series: product.series || '',
    sku: variant.sku || '',
    color: extractedColor,
    material: extractedMaterial,
    size: otherSpecs.join('，') || '',
  };
  if (mainImage) {
    newData.files = [{
      url: mainImage,
      isLocal: false, // Treat as remote file, though it doesn't have an ID yet for THIS order.
      // Actually, for a new order, we might need to treat it as a "pre-filled" file that needs "association" or just pass URL.
      // useOrderForm's fillForm might expect specific structure. 
      // Let's assume passed files are { url, id? } objects. 
      // Since this is a new order, we can pass it as a file with url. 
      // If we want it to be "uploaded" (preserved), ImageUploader needs to handle it.
      // For simplicity, let's pass it as a file object.
    }];
  }

  formData.value = newData;
  boundProductVariant.value = mappedOptions; // Set extracted options object for display
};

const unbindProduct = () => {
  boundProduct.value = null;
  selectedProductId.value = null;
  boundProductVariant.value = null;
  // We don't clear formData to avoid data loss if user unbinds intentionally to edit
};

const handleSubmit = async (data) => {
  const payload = { ...data };
  if (selectedProductId.value) {
    if (!boundProduct.value?.variantId) return;
    payload.productId = selectedProductId.value;
    payload.variantId = boundProduct.value.variantId;
  }
  emit('submit', payload);
};

// Reset state on open
watch(() => props.modelValue, (val) => {
  if (val) {
    boundProduct.value = null;
    selectedProductId.value = null;
    boundProductVariant.value = null;
    formData.value = {};
  }
});
</script>
