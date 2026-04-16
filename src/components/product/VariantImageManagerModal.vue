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
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" @click="$emit('update:modelValue', false)"></div>
        <AppCard
          padding="p-0"
          class="relative z-10 flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl shadow-2xl"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-(--border-color) bg-(--bg-card) px-6 py-4">
            <div>
              <h1 class="text-xl font-bold tracking-tight text-(--text-main)">{{ t('product.create.variants.image_upload', 'Product Variant Image Upload') }}</h1>
              <p class="mt-1 text-sm text-(--text-secondary)">{{ t('product.create.variants.image_manage', 'Manage and organize visual assets for each SKU') }}</p>
            </div>
            <AppButton
              variant="ghost"
              size="sm"
              class="text-(--text-secondary) hover:text-(--text-main) !h-10 !w-10 !gap-0 !px-0 [&_span]:hidden"
              @click="$emit('update:modelValue', false)"
            >
              <template #icon-left>
                <AppIcon name="x-mark" class="size-6" />
              </template>
            </AppButton>
          </div>

          <!-- Main Content Area -->
          <div class="flex flex-1 overflow-hidden">
            <!-- Sidebar -->
            <aside class="w-72 overflow-y-auto border-r border-(--border-color) bg-(--bg-muted)/30">
              <div class="p-4">
                <h2 class="mb-4 px-2 text-xs font-semibold tracking-wider text-(--text-secondary) uppercase">
                  {{ t('product.create.variants.select', 'Select Variant') }}
                </h2>
                <nav class="space-y-1">
                  <AppCard
                    v-for="(variant, index) in variants"
                    :key="getVariantKey(variant, index)"
                    clickable
                    :selected="selectedVariantKey === getVariantKey(variant, index)"
                    padding="px-3 py-2.5"
                    class="group flex w-full items-center justify-between rounded-lg text-(--text-secondary) hover:text-(--text-main)"
                    @click="selectedVariantKey = getVariantKey(variant, index)"
                  >
                    <div class="flex items-center gap-3 overflow-hidden pr-2">
                       <div 
                         class="flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
                         :class="selectedVariantKey === getVariantKey(variant, index) ? 'border-primary bg-primary' : 'border-(--text-muted) group-hover:border-(--text-secondary)'"
                       >
                         <div v-show="selectedVariantKey === getVariantKey(variant, index)" class="size-1.5 rounded-full bg-white"></div>
                       </div>
                      <span class="truncate text-sm" :class="selectedVariantKey === getVariantKey(variant, index) ? 'font-semibold' : 'font-medium'">
                        {{ formatVariant(variant.options_values) || variant.sku || variant.id }}
                      </span>
                    </div>
                    <span 
                      class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      :class="getImageCountByKey(getVariantKey(variant, index)) > 0 
                        ? (selectedVariantKey === getVariantKey(variant, index) ? 'bg-primary text-white' : 'bg-primary/10 text-primary') 
                        : 'bg-(--bg-muted) text-(--text-secondary)'"
                    >
                      {{ getImageCountByKey(getVariantKey(variant, index)) }}
                    </span>
                  </AppCard>
                </nav>
              </div>
            </aside>

            <!-- Main Content: Image Grid -->
            <main class="flex flex-1 flex-col overflow-y-auto bg-(--bg-card)">
              <!-- Action Bar -->
              <div class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-(--border-color) bg-(--bg-card)/80 p-6 backdrop-blur-md">
                <div v-if="selectedVariantKey">
                  <h3 class="text-lg font-bold text-(--text-main)">{{ getSelectedVariantName() }}</h3>
                  <p class="text-xs text-(--text-secondary)">
                    {{ getImageCountByKey(selectedVariantKey) }} {{ t('common.images_count') }}
                  </p>
                </div>
              </div>
              
              <div class="p-6">
                <ImageUploader
                  v-if="selectedVariantKey"
                  v-model="variantImagesForUploader"
                  :upload-endpoint="API.MANAGE_UPLOAD"
                  :max-files="10"
                  context="variant"
                  :deferred="false"
                  grid-class="grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  class="border-0! bg-transparent! p-0!"
                />
              </div>
            </main>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between border-t border-(--border-color) bg-(--bg-card) px-6 py-4">
            <div class="flex items-center gap-2 text-(--text-secondary)">
              <AppIcon name="information-circle" class="size-5" />
              <span class="text-xs">{{ t('product.variants.image.auto_save', 'Changes are automatically saved to draft.') }}</span>
            </div>
            <div class="flex gap-3">
              <AppButton
                variant="ghost"
                @click="$emit('update:modelValue', false)"
              >
                {{ t('common.cancel', 'Cancel') }}
              </AppButton>
              <AppButton
                class="shadow-primary/20 px-8 shadow-lg"
                @click="$emit('update:modelValue', false)"
              >
                {{ t('common.saveChanges', 'Save Changes') }}
              </AppButton>
            </div>
          </div>
        </AppCard>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
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

const getSelectedVariantName = () => {
    if (!selectedVariantKey.value) return '';
    const variant = props.variants.find((v, index) => getVariantKey(v, index) === selectedVariantKey.value);
    if (!variant) return '';
    return formatVariant(variant.options_values) || variant.sku || variant.id;
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
