<template>
  <div class="min-h-screen bg-neutral-50 p-8 dark:bg-neutral-950">
    <div class="mx-auto max-w-4xl">
      <h2 class="mb-8 text-3xl font-bold text-neutral-900 dark:text-white">Product Spec Card Demo</h2>
      
      <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        
        <!-- Default Usage -->
        <div>
          <h3 class="mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200">1. Default Usage</h3>
          <ProductSpecCard
            v-model="selectedVariant1"
            v-model:is-favorite="isFavorite1"
            title="Nike Air Max 270"
            description="Legendary style refined for the streets. Features maximum cushioning for all-day comfort."
            :variants="variants1"
            action-text="Add to cart"
            @action="handleAddToCart"
          >
            <!-- Custom badges -->
            <template #badges>
              <span class="rounded bg-black px-2 py-1 text-xs font-bold text-white dark:bg-white dark:text-black">NEW</span>
            </template>
          </ProductSpecCard>
          
          <div class="mt-4 overflow-auto rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <p><strong>Selected:</strong> {{ selectedVariant1?.label }}</p>
            <p><strong>Favorite:</strong> {{ isFavorite1 }}</p>
          </div>
        </div>

        <!-- Custom Styling & Slots -->
        <div>
          <h3 class="mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200">2. Custom Styling & Slots</h3>
          <ProductSpecCard
            v-model="selectedVariant2"
            v-model:is-favorite="isFavorite2"
            title="Apple Watch Series 9"
            base-price="399"
            :variants="[]"
            action-text="Pre-order Now"
            action-button-class="bg-blue-600 hover:bg-blue-700 text-white"
            @action="handleAddToCart"
          >
            <!-- Override description slot -->
            <template #description>
              <div class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                <ul class="list-disc space-y-1 pl-4">
                  <li>Always-On Retina display</li>
                  <li>S9 SiP</li>
                  <li>Blood oxygen app</li>
                </ul>
              </div>
            </template>
            
            <!-- Override image slot -->
            <template #image>
              <div class="relative flex h-64 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <svg class="size-24 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="absolute top-2 right-2">
                  <span class="rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">Sale</span>
                </div>
              </div>
            </template>
          </ProductSpecCard>
        </div>

        <!-- Read Only / Disabled -->
        <div>
          <h3 class="mb-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200">3. Disabled State</h3>
          <ProductSpecCard
            v-model="selectedVariant3"
            title="Sony WH-1000XM5"
            description="Industry leading noise canceling headphones. Out of stock currently."
            :variants="variants3"
            action-text="Out of Stock"
            action-button-class="bg-neutral-300 text-neutral-500 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600"
            :disabled="true"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ProductSpecCard from './ProductSpecCard.vue';

// Demo 1 State
const variants1 = ref([
  { id: 'v1', label: 'Crimson Red', color: '#dc2626', price: 129.99, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000' },
  { id: 'v2', label: 'Ocean Blue', color: '#2563eb', price: 129.99, image: 'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&q=80&w=1000' },
  { id: 'v3', label: 'Midnight Black', color: '#171717', price: 139.99, image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&q=80&w=1000' },
]);
const selectedVariant1 = ref(variants1.value[0]);
const isFavorite1 = ref(false);

// Demo 2 State
const selectedVariant2 = ref(null);
const isFavorite2 = ref(true);

// Demo 3 State
const variants3 = ref([
  { id: 'v4', label: 'Silver', color: '#e5e7eb', price: 348.00 },
  { id: 'v5', label: 'Black', color: '#000000', price: 348.00 }
]);
const selectedVariant3 = ref(variants3.value[1]);

const handleAddToCart = (variant) => {
  alert(`Added to cart: ${variant?.label || 'Default variant'} at $${variant?.price || 'base price'}`);
};
</script>
