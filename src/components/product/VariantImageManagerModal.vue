<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="$emit('update:modelValue', false)"></div>
      <div class="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) md:grid-cols-3">
        <aside class="border-r border-(--border-color) p-4">
          <h3 class="mb-3 text-sm font-semibold text-(--text-main)">Variants</h3>
          <div data-testid="variant-list" class="space-y-2">
            <button
              v-for="variant in variants"
              :key="variant.id"
              type="button"
              class="w-full rounded-lg border px-3 py-2 text-left text-sm transition"
              :class="selectedVariantId === variant.id ? 'border-(--color-primary) bg-(--bg-muted)' : 'border-(--border-color)'"
              @click="selectedVariantId = variant.id"
            >
              <div class="font-medium text-(--text-main)">{{ variant.sku || variant.id }}</div>
              <div class="text-xs text-(--text-secondary)">{{ formatVariant(variant.options_values) }}</div>
            </button>
          </div>
        </aside>

        <section class="md:col-span-2 p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-(--text-main)">Images</h3>
            <button type="button" class="text-sm text-(--text-secondary)" @click="$emit('update:modelValue', false)">Close</button>
          </div>
          <div data-testid="image-panel" class="space-y-2">
            <div
              v-for="(image, index) in selectedImages"
              :key="image.image_id"
              class="rounded-lg border border-(--border-color) p-2"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-(--text-main)">{{ image.image_id }}</span>
                <div class="flex items-center gap-2">
                  <span v-if="Number(image.is_primary) === 1" class="text-xs text-(--color-primary)">Primary</span>
                  <button type="button" :data-testid="`set-primary-${image.image_id}`" class="text-xs" @click="setPrimary(image.image_id)">Set Primary</button>
                  <button type="button" :data-testid="`move-up-${image.image_id}`" class="text-xs" @click="moveImage(index, index - 1)">Up</button>
                  <button type="button" :data-testid="`move-down-${image.image_id}`" class="text-xs" @click="moveImage(index, index + 1)">Down</button>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <input
              data-testid="new-image-id"
              v-model="newImageId"
              class="input flex-1"
              type="text"
              placeholder="Image ID"
            >
            <button data-testid="add-image" type="button" class="btn btn-primary" @click="addImage">Add</button>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
    modelValue: Boolean,
    variants: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(['update:modelValue', 'upload-image', 'set-primary', 'sort-images']);

const selectedVariantId = ref(props.variants[0]?.id || null);
const localImages = ref({});
const newImageId = ref('');

watch(
    () => props.variants,
    (variants) => {
        const next = {};
        variants.forEach((variant) => {
            next[variant.id] = (variant.images || []).map((image) => ({ ...image }));
        });
        localImages.value = next;
        if (!variants.find((v) => v.id === selectedVariantId.value)) {
            selectedVariantId.value = variants[0]?.id || null;
        }
    },
    { immediate: true, deep: true }
);

const selectedImages = computed(() => {
    if (!selectedVariantId.value) return [];
    return localImages.value[selectedVariantId.value] || [];
});

const formatVariant = (optionsValues) => {
    if (!optionsValues) return '';
    return Object.values(optionsValues).join(' / ');
};

const addImage = () => {
    if (!selectedVariantId.value || !newImageId.value) return;
    const imageId = newImageId.value.trim();
    if (!imageId) return;

    const target = localImages.value[selectedVariantId.value] || [];
    target.push({ image_id: imageId, is_primary: target.length === 0 ? 1 : 0 });
    localImages.value[selectedVariantId.value] = target;
    emit('upload-image', { variantId: selectedVariantId.value, imageId });
    newImageId.value = '';
};

const setPrimary = (imageId) => {
    const target = localImages.value[selectedVariantId.value] || [];
    localImages.value[selectedVariantId.value] = target.map((image) => ({
        ...image,
        is_primary: image.image_id === imageId ? 1 : 0,
    }));
    emit('set-primary', { variantId: selectedVariantId.value, imageId });
};

const moveImage = (fromIndex, toIndex) => {
    const target = [...(localImages.value[selectedVariantId.value] || [])];
    if (toIndex < 0 || toIndex >= target.length || fromIndex === toIndex) return;
    const [moved] = target.splice(fromIndex, 1);
    target.splice(toIndex, 0, moved);
    localImages.value[selectedVariantId.value] = target;
    emit('sort-images', {
        variantId: selectedVariantId.value,
        imageIds: target.map((image) => image.image_id),
    });
};
</script>
