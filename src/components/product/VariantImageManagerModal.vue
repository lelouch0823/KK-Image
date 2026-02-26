<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="$emit('update:modelValue', false)"></div>
      <div class="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) md:grid-cols-3">
        <aside class="border-r border-(--border-color) p-4 h-[80vh] overflow-y-auto">
          <h3 class="mb-3 text-sm font-semibold text-(--text-main)">{{ t('product.create.variants', 'Variants') }}</h3>
          <div data-testid="variant-list" class="space-y-2">
            <button
              v-for="(variant, index) in variants"
              :key="getVariantKey(variant, index)"
              type="button"
              class="w-full rounded-lg border px-3 py-2 text-left text-sm transition"
              :class="selectedVariantKey === getVariantKey(variant, index) ? 'border-(--color-primary) bg-(--bg-muted)' : 'border-(--border-color)'"
              @click="selectedVariantKey = getVariantKey(variant, index)"
            >
              <div class="font-medium text-(--text-main)">{{ variant.sku || variant.id }}</div>
              <div class="text-xs text-(--text-secondary)">{{ formatVariant(variant.options_values) }}</div>
            </button>
          </div>
        </aside>

        <section class="md:col-span-2 p-4 flex flex-col h-[80vh]">
          <div class="mb-3 flex items-center justify-between shrink-0">
            <h3 class="text-sm font-semibold text-(--text-main)">{{ t('product.table.variant.images', 'Images') }}</h3>
            <button type="button" class="text-sm text-(--text-secondary) cursor-pointer" @click="$emit('update:modelValue', false)">{{ t('common.close', 'Close') }}</button>
          </div>
          
          <div class="flex-1 overflow-y-auto pr-2">
            <ImageUploader
              v-if="selectedVariantKey"
              v-model="variantImagesForUploader"
              :upload-endpoint="API.MANAGE_UPLOAD"
              :max-files="10"
              context="variant"
              :deferred="false"
            />
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ImageUploader from '@/components/common/ImageUploader.vue';
import { API } from '@/utils/constants';

const { t } = useI18n();

const props = defineProps({
    modelValue: Boolean,
    variants: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(['update:modelValue', 'update-images']);

const selectedVariantKey = ref(null);
const localImages = ref({});

const getVariantKey = (variant, index = 0) =>
    String(variant?.id || variant?._clientKey || `variant_tmp_${index}`);

watch(
    () => props.variants,
    (variants) => {
        const next = {};
        variants.forEach((variant, index) => {
            const variantKey = getVariantKey(variant, index);
            next[variantKey] = (variant.images || []).map((image) => ({ ...image }));
        });
        localImages.value = next;

        if (!variants.some((v, index) => getVariantKey(v, index) === selectedVariantKey.value)) {
            selectedVariantKey.value = variants.length > 0 ? getVariantKey(variants[0], 0) : null;
        }
    },
    { immediate: true, deep: true }
);

const formatVariant = (optionsValues) => {
    if (!optionsValues) return '';
    return Object.values(optionsValues).join(' / ');
};

// Map between DB format and ImageUploader format
const variantImagesForUploader = computed({
  get: () => {
    if (!selectedVariantKey.value) return [];
    const images = localImages.value[selectedVariantKey.value] || [];
    
    // Sort array so primary image is at index 0
    const sortedImages = [...images].sort((a, b) => {
        if (Number(a.is_primary) === 1) return -1;
        if (Number(b.is_primary) === 1) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return sortedImages.map(img => {
      const id = img.image_id || img.id;
      return {
        id,
        url: id ? `/file/${id}` : ''
      };
    });
  },
  set: (newFiles) => {
    if (!selectedVariantKey.value) return;
    
    // Map back to DB format, setting the first element as primary
    const updatedImages = newFiles.map((file, index) => ({
      image_id: file.id,
      id: file.id,
      is_primary: index === 0 ? 1 : 0,
      sort_order: index
    }));
    
    localImages.value[selectedVariantKey.value] = updatedImages;
    
    const matchedVariant = props.variants.find((variant, index) =>
        getVariantKey(variant, index) === selectedVariantKey.value
    );

    emit('update-images', { 
        variantId: matchedVariant?.id || null,
        variantKey: selectedVariantKey.value,
        images: updatedImages 
    });
  }
});
</script>
