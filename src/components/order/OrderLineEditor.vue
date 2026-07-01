<template>
  <AppCard
    padding="p-0"
    class="border-(--border-color)"
    :indicator="cardTone"
    :active-border="status === 'pending'"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <div class="text-sm font-semibold text-(--text-main)">
              {{ t('order.form.lineTitle', `商品明细 ${index + 1}`) }}
            </div>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusBadgeClass">
              {{ statusLabel }}
            </span>
          </div>
          <div class="text-xs text-(--text-secondary)">
            {{ summaryText }}
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AppButton
            type="button"
            variant="ghost"
            size="sm"
            :data-testid="`copy-order-line-${index}`"
            @click="$emit('copy')"
          >
            {{ t('order.form.copyLine', '复制上一行') }}
          </AppButton>
          <AppButton type="button" variant="ghost" size="sm" @click="$emit('add-after')">
            {{ t('order.form.addNextLine', '新增下一行') }}
          </AppButton>
          <AppButton
            v-if="canRemove"
            type="button"
            variant="ghost"
            size="sm"
            data-testid="remove-order-line"
            @click="$emit('remove')"
          >
            {{ t('common.remove', '移除') }}
          </AppButton>
        </div>
      </div>
    </template>

    <div class="space-y-4 p-4">
      <ProductBindingSection
        :bound-product="modelValue.boundProduct"
        :variant-select-policy="'allow_out_of_stock'"
        @select="handleProductSelect"
        @unbind="clearProductBinding"
      />

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AppInput
          :model-value="modelValue.name"
          :label="t('order.form.productName')"
          :disabled="isBindingLocked"
          :data-testid="`order-line-name-${index}`"
          @update:model-value="updateField('name', $event)"
        />
        <AppInput
          :model-value="modelValue.sku"
          :label="t('order.form.sku')"
          :disabled="isBindingLocked"
          @update:model-value="updateField('sku', $event)"
        />
        <AppInput
          :model-value="modelValue.brand"
          :label="t('order.form.brand')"
          :disabled="isBindingLocked"
          @update:model-value="updateField('brand', $event)"
        />
        <AppInput
          :model-value="modelValue.series"
          :label="t('order.form.series')"
          :disabled="isBindingLocked"
          @update:model-value="updateField('series', $event)"
        />
        <AppInput
          :model-value="modelValue.size"
          :label="t('order.form.size')"
          :disabled="isBindingLocked"
          @update:model-value="updateField('size', $event)"
        />
        <AppInput
          :model-value="modelValue.quantity"
          type="number"
          min="1"
          :label="t('order.form.quantity')"
          :data-testid="`order-line-quantity-${index}`"
          @update:model-value="updateField('quantity', Number($event || 0))"
        />
        <AppInput
          :model-value="modelValue.color"
          :label="t('order.form.color')"
          :disabled="isBindingLocked"
          @update:model-value="updateField('color', $event)"
        />
        <AppInput
          :model-value="modelValue.material"
          :label="t('order.form.material')"
          :disabled="isBindingLocked"
          @update:model-value="updateField('material', $event)"
        />
      </div>
    </div>
  </AppCard>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { parseJsonObject } from '@/utils/json.js';
import { resolveSelectedVariantMainImageSrc } from '@/utils/product-image.js';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppInput from '@/components/ui/AppInput.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    default: 0,
  },
  canRemove: {
    type: Boolean,
    default: false,
  },
  state: {
    type: Object,
    default: () => ({
      completion: {
        status: 'empty',
        tone: 'neutral',
        label: '',
      },
    }),
  },
});

const emit = defineEmits(['update:modelValue', 'remove', 'copy', 'add-after']);
const { t } = useI18n();

const isBindingLocked = computed(() =>
  Boolean(props.modelValue.productId || props.modelValue.variantId)
);
const status = computed(() => props.state?.completion?.status || 'empty');
const statusLabel = computed(() => props.state?.completion?.label || t('order.form.blankLine', '空白行'));
const cardTone = computed(() => props.state?.completion?.tone || 'neutral');
const statusBadgeClass = computed(() => {
  if (status.value === 'ready') {
    return 'bg-(--color-success-bg)/40 text-(--color-success-text)';
  }
  if (status.value === 'pending') {
    return 'bg-(--color-warning-bg)/50 text-(--color-warning-text)';
  }
  return 'bg-(--bg-muted) text-(--text-secondary)';
});
const summaryText = computed(() => {
  const parts = [];
  if (props.modelValue.name) parts.push(props.modelValue.name);
  if (props.modelValue.sku) parts.push(props.modelValue.sku);
  if (props.modelValue.quantity) parts.push(`x${props.modelValue.quantity}`);
  if (parts.length === 0 && status.value === 'pending') {
    return props.state?.completion?.message || t('order.form.linePending', '请先补齐商品信息');
  }
  if (parts.length === 0) {
    return t('order.form.lineEmpty', '先绑定商品，或填写一条商品名称');
  }
  return parts.join(' · ');
});

const updateField = (field, value) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: field === 'quantity' ? Math.max(1, Math.trunc(Number(value || 0) || 1)) : value,
  });
};

const buildMappedVariantOptions = (product) => {
  const variant = product?.selectedVariant;
  const options = parseJsonObject(variant?.options_values || {}, {});
  const dimensionMap = product?.dimension_map || {};
  const mappedOptions = {};
  let extractedColor = '';
  let extractedMaterial = '';
  const otherSpecs = [];

  Object.entries(options).forEach(([key, val]) => {
    if (!val) return;
    const readableKey = dimensionMap[key] || key;
    mappedOptions[readableKey] = val;

    const lowerKey = String(readableKey).toLowerCase();
    if (['color', '颜色', '顏色'].includes(lowerKey)) {
      extractedColor = String(val);
    } else if (['material', '材质', '材質'].includes(lowerKey)) {
      extractedMaterial = String(val);
    } else {
      otherSpecs.push(`${readableKey}: ${val}`);
    }
  });

  return {
    mappedOptions,
    extractedColor,
    extractedMaterial,
    sizeText: otherSpecs.join('，'),
  };
};

const handleProductSelect = (product) => {
  const variant = product?.selectedVariant;
  if (!variant) return;

  const mainImage = resolveSelectedVariantMainImageSrc(product);
  const { mappedOptions, extractedColor, extractedMaterial, sizeText } =
    buildMappedVariantOptions(product);

  emit('update:modelValue', {
    ...props.modelValue,
    name: product.name || '',
    brand: product.brand || '',
    series: product.series || '',
    sku: variant.sku || '',
    color: extractedColor,
    material: extractedMaterial,
    size: sizeText || '',
    quantity: Math.max(1, Math.trunc(Number(props.modelValue.quantity || 1) || 1)),
    productId: product.id || null,
    variantId: variant.id || null,
    boundProduct: {
      id: product.id,
      name: product.name,
      sku: variant.sku,
      brand: product.brand,
      series: product.series,
      variantId: variant.id,
      mainImage,
    },
    boundProductVariant: mappedOptions,
  });
};

const clearProductBinding = () => {
  emit('update:modelValue', {
    ...props.modelValue,
    productId: null,
    variantId: null,
    boundProduct: null,
    boundProductVariant: null,
  });
};
</script>
