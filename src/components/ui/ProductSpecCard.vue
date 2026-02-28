<template>
  <div class="group mx-auto w-[300px]">
    <div class="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      
      <!-- Image Region -->
      <slot name="image" :current-variant="currentVariant">
        <div class="relative overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <img
            :src="currentImage"
            :alt="title"
            class="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style="clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);"
          />
          
          <!-- Badges (Optional Slot) -->
          <div class="absolute top-2 left-2 flex flex-col gap-1">
            <slot name="badges" :current-variant="currentVariant"></slot>
          </div>
        </div>
      </slot>

      <div class="pt-4 text-neutral-900 dark:text-neutral-100">
        <!-- Title and Favorite Actions -->
        <div class="flex items-start justify-between gap-2">
          <slot name="title" :title="title">
            <h1 class="line-clamp-2 flex-grow text-xl leading-tight font-semibold">{{ title }}</h1>
          </slot>
          
          <slot name="favorite-action" :is-favorite="isFavorite" :toggle="toggleFavorite">
            <button
              class="flex-shrink-0 text-2xl transition-transform duration-300 focus:outline-none active:scale-125"
              :class="[isFavorite ? 'scale-110 text-red-500' : 'text-neutral-400 hover:scale-110 hover:text-red-400 dark:text-neutral-500']"
              aria-label="Toggle Favorite"
              @click.stop="toggleFavorite"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                stroke-width="1.5" 
                stroke="currentColor" 
                class="size-6  transition-colors duration-300"
                :class="isFavorite ? 'fill-current' : 'fill-none'"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
          </slot>
        </div>

        <!-- Description -->
        <div class="mt-2 min-h-[40px]">
          <slot name="description" :description="description">
            <p class="line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
              {{ description }}
            </p>
          </slot>
        </div>

        <!-- Price and Variants -->
        <div class="mt-1 flex items-center justify-between border-t border-neutral-100 py-3 dark:border-neutral-800">
          <slot name="price" :price="currentPrice" :current-variant="currentVariant">
            <span class="text-2xl font-bold tracking-tight">
              {{ formatPrice(currentPrice) }}
            </span>
          </slot>

          <slot name="variants" :variants="variants" :current-variant="currentVariant" :select="selectVariant">
            <div v-if="variants && variants.length > 0" class="flex flex-wrap items-center justify-end gap-2">
              <button
                v-for="(variant, index) in variants"
                :key="variant.id || index"
                class="relative grid size-7  place-content-center rounded-full transition-all focus:outline-none"
                :class="isVariantSelected(variant) ? 'scale-110 border-2 border-neutral-900 dark:border-white' : 'border border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'"
                :title="variant.label || variant.name"
                :aria-label="`Select color ${variant.label || variant.name}`"
                @click.stop="selectVariant(variant)"
              >
                <span
                  class="inline-block size-5  rounded-full shadow-inner"
                  :style="{ backgroundColor: variant.color }"
                ></span>
              </button>
            </div>
          </slot>
        </div>

        <!-- Action Button -->
        <slot name="action" :current-variant="currentVariant">
          <button 
            class="mt-2 w-full rounded-lg py-3 font-medium transition-all duration-200 focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98] dark:focus:ring-white dark:focus:ring-offset-neutral-900"
            :class="actionButtonClass"
            :disabled="disabled"
            @click.stop="handleAction"
          >
            {{ actionText }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  // Basic Info
  title: {
    type: String,
    default: 'Product Item'
  },
  description: {
    type: String,
    default: 'Discover the perfect blend of style and comfort.'
  },
  basePrice: {
    type: [Number, String],
    default: 0
  },
  image: {
    type: String,
    default: ''
  },
  
  // Customization
  currencyPrefix: {
    type: String,
    default: '$'
  },
  actionText: {
    type: String,
    default: 'Add to cart'
  },
  actionButtonClass: {
    type: String,
    default: 'text-white bg-neutral-900 hover:bg-neutral-800 dark:text-black dark:bg-white dark:hover:bg-neutral-200'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  
  // Variants Array
  // Expected structure: [{ id: 1, color: '#ff0000', image: 'url', price: 49, label: 'Red' }, ...]
  variants: {
    type: Array,
    default: () => []
  },
  
  // v-model equivalents
  modelValue: {
    type: Object,
    default: null
  },
  isFavorite: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'update:isFavorite', 'change', 'action', 'favorite-toggle']);

// Internal state for selected variant if not controlled externally
const internalVariant = ref(props.modelValue || (props.variants && props.variants.length > 0 ? props.variants[0] : null));

// Sync with external v-model if it changes
watch(() => props.modelValue, (newVal) => {
  if (newVal !== undefined) {
    internalVariant.value = newVal;
  }
}, { deep: true });

// Computed properties
const currentVariant = computed(() => internalVariant.value || {});

const currentImage = computed(() => {
  return currentVariant.value.image || props.image || '';
});

const currentPrice = computed(() => {
  return currentVariant.value.price !== undefined ? currentVariant.value.price : props.basePrice;
});

// Methods
const isVariantSelected = (variant) => {
  if (!internalVariant.value) return false;
  return internalVariant.value.id === variant.id || 
         (internalVariant.value.color === variant.color && !variant.id);
};

const selectVariant = (variant) => {
  if (props.disabled) return;
  
  internalVariant.value = variant;
  emit('update:modelValue', variant);
  emit('change', variant);
};

const toggleFavorite = () => {
  if (props.disabled) return;
  
  const newState = !props.isFavorite;
  emit('update:isFavorite', newState);
  emit('favorite-toggle', newState);
};

const handleAction = () => {
  if (props.disabled) return;
  emit('action', currentVariant.value);
};

const formatPrice = (value) => {
  const numPrice = Number(value);
  if (isNaN(numPrice)) return `${props.currencyPrefix}${value}`;
  
  // Check if it's an integer
  if (numPrice % 1 === 0) {
    return `${props.currencyPrefix}${numPrice}`;
  }
  return `${props.currencyPrefix}${numPrice.toFixed(2)}`;
};
</script>
