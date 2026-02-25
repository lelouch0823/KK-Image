<template>
  <div class="w-[300px] mx-auto group">
    <div class="rounded-xl p-3 dark:bg-neutral-900 bg-white shadow-sm hover:shadow-md transition-all duration-300 border border-neutral-200 dark:border-neutral-800">
      
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

      <div class="text-neutral-900 dark:text-neutral-100 pt-4">
        <!-- Title and Favorite Actions -->
        <div class="flex justify-between items-start gap-2">
          <slot name="title" :title="title">
            <h1 class="font-semibold text-xl leading-tight line-clamp-2 flex-grow">{{ title }}</h1>
          </slot>
          
          <slot name="favorite-action" :is-favorite="isFavorite" :toggle="toggleFavorite">
            <button
              class="text-2xl transition-transform duration-300 active:scale-125 focus:outline-none flex-shrink-0"
              :class="[isFavorite ? 'scale-110 text-red-500' : 'text-neutral-400 dark:text-neutral-500 hover:scale-110 hover:text-red-400']"
              @click.stop="toggleFavorite"
              aria-label="Toggle Favorite"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                stroke-width="1.5" 
                stroke="currentColor" 
                class="w-6 h-6 transition-colors duration-300"
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
            <p class="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
              {{ description }}
            </p>
          </slot>
        </div>

        <!-- Price and Variants -->
        <div class="flex justify-between items-center py-3 mt-1 border-t border-neutral-100 dark:border-neutral-800">
          <slot name="price" :price="currentPrice" :current-variant="currentVariant">
            <span class="font-bold text-2xl tracking-tight">
              {{ formatPrice(currentPrice) }}
            </span>
          </slot>

          <slot name="variants" :variants="variants" :current-variant="currentVariant" :select="selectVariant">
            <div class="flex gap-2 items-center flex-wrap justify-end" v-if="variants && variants.length > 0">
              <button
                v-for="(variant, index) in variants"
                :key="variant.id || index"
                @click.stop="selectVariant(variant)"
                class="relative w-7 h-7 rounded-full grid place-content-center transition-all focus:outline-none"
                :class="isVariantSelected(variant) ? 'border-2 border-neutral-900 dark:border-white scale-110' : 'border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'"
                :title="variant.label || variant.name"
                :aria-label="`Select color ${variant.label || variant.name}`"
              >
                <span
                  class="w-5 h-5 rounded-full inline-block shadow-inner"
                  :style="{ backgroundColor: variant.color }"
                ></span>
              </button>
            </div>
          </slot>
        </div>

        <!-- Action Button -->
        <slot name="action" :current-variant="currentVariant">
          <button 
            class="w-full mt-2 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 focus:ring-neutral-900 dark:focus:ring-white active:scale-[0.98]"
            :class="actionButtonClass"
            @click.stop="handleAction"
            :disabled="disabled"
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
