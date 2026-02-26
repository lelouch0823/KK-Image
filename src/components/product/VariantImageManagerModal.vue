<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="$emit('update:modelValue', false)"></div>
        <div class="border-border relative z-10 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border bg-(--bg-card) shadow-2xl md:grid-cols-[360px_1fr]">
          <!-- Sidebar -->
          <aside class="border-border flex h-[650px] max-h-[85vh] flex-col border-r bg-(--bg-card)">
            <div class="border-border sticky top-0 z-10 border-b bg-(--bg-card) px-4 py-3">
              <h3 class="text-sm font-semibold text-(--text-main)">{{ t('product.create.variants', 'Variants') }}</h3>
            </div>
            <div data-testid="variant-list" class="flex-1 space-y-1.5 overflow-y-auto p-3">
              <button
                v-for="(variant, index) in variants"
                :key="getVariantKey(variant, index)"
                type="button"
                class="group flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition-all duration-200"
                :class="[
                  selectedVariantKey === getVariantKey(variant, index) 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'hover:border-border hover:bg-(--bg-muted) border-transparent'
                ]"
                @click="selectedVariantKey = getVariantKey(variant, index)"
              >
                <div class="flex-1 overflow-hidden pr-2">
                  <div class="truncate font-medium transition-colors" :class="selectedVariantKey === getVariantKey(variant, index) ? 'text-primary' : 'text-(--text-main)'">
                    {{ variant.sku || variant.id }}
                  </div>
                  <div class="mt-0.5 truncate text-xs text-(--text-secondary)">{{ formatVariant(variant.options_values) }}</div>
                </div>
                <div 
                  class="flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                  :class="getImageCountByKey(getVariantKey(variant, index)) > 0 ? 'bg-primary/10 text-primary' : 'bg-(--bg-muted) text-(--text-secondary)'"
                >
                  <AppIcon name="photo-solid" class="mr-1 size-3.5" />
                  {{ getImageCountByKey(getVariantKey(variant, index)) }}
                </div>
              </button>
            </div>
          </aside>

          <!-- Main Content -->
          <section class="flex h-[600px] max-h-[80vh] flex-col overflow-hidden bg-(--bg-card) md:col-span-1">
            <div class="border-border flex shrink-0 items-center justify-between border-b px-5 py-3">
              <h3 class="text-sm font-semibold text-(--text-main)">{{ t('product.table.variant.images', 'Images') }}</h3>
              <button 
                type="button" 
                aria-label="Close"
                class="rounded-lg p-1.5 text-(--text-secondary) transition-colors hover:bg-(--bg-muted) hover:text-(--text-main)" 
                @click="$emit('update:modelValue', false)"
              >
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>
            
            <div class="w-full flex-1 overflow-y-auto p-5">
              <ImageUploader
                v-if="selectedVariantKey"
                v-model="variantImagesForUploader"
                :upload-endpoint="API.MANAGE_UPLOAD"
                :max-files="10"
                context="variant"
                :deferred="false"
                grid-class="grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
                class="border-0! bg-transparent! p-0!"
              />
            </div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';
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

const getImageCountByKey = (key) => {
  return localImages.value[key]?.length || 0;
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
