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

// Locked fields when product is bound
const LOCKED_FIELDS = ['name', 'brand', 'series', 'sku'];
const disabledFields = computed(() => boundProduct.value ? LOCKED_FIELDS : []);

const getProductMainImage = (product) => {
  if (product?.mainImage) return product.mainImage;
  const variant = product?.selectedVariant;
  if (variant?.primaryImage) return `/file/${variant.primaryImage}`;
  if (Array.isArray(variant?.images) && variant.images.length > 0) {
    const primary = variant.images.find((img) => Number(img.is_primary) === 1) || variant.images[0];
    if (primary?.image_id) return `/file/${primary.image_id}`;
  }
  try {
    if (!product.images) return null;
    const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    return Array.isArray(imgs) && imgs.length > 0 ? `/file/${imgs[0]}` : null;
  } catch { return null; }
};

const handleProductSelect = (product) => {
  const mainImage = getProductMainImage(product);
  const variant = product.selectedVariant;
  
  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: variant ? variant.sku : product.sku,
    brand: product.brand,
    series: product.series,
    variantId: variant ? variant.id : null,
    mainImage,
  };
  selectedProductId.value = product.id;

  // Auto-fill form fields
  // SOTA: Use formData ref to trigger OrderForm's watch prefill
  const newData = {
    name: product.name || '',
    brand: product.brand || '',
    series: product.series || '',
    sku: variant ? variant.sku : (product.sku || ''),
  };
  
  // Auto-fill image if available
  // OrderForm uses ImageUploader which accepts v-model="uploadedFiles"
  // OrderForm initializes uploadedFiles from prefill.files if present (checking useOrderForm)
  // Logic: We pass file objects with { url, isLocal: false } or similar to mimic uploaded files
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
};

const unbindProduct = () => {
  boundProduct.value = null;
  selectedProductId.value = null;
  // We don't clear formData to avoid data loss if user unbinds intentionally to edit
};

const handleSubmit = async (data) => {
  const payload = { ...data };
  if (selectedProductId.value) {
    payload.productId = selectedProductId.value;
  }
  if (boundProduct.value?.variantId) {
    payload.variantId = boundProduct.value.variantId;
  }
  emit('submit', payload);
};

// Reset state on open
watch(() => props.modelValue, (val) => {
  if (val) {
    boundProduct.value = null;
    selectedProductId.value = null;
    formData.value = {};
  }
});
</script>
