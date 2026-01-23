<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 overflow-hidden"
    aria-labelledby="slide-over-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="absolute inset-0 overflow-hidden">
      <!-- 背景遮罩 -->
      <div
        class="bg-opacity-75 absolute inset-0 bg-gray-500 transition-opacity"
        aria-hidden="true"
        @click="close"
      ></div>

      <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          class="pointer-events-auto flex h-full w-full sm:w-screen sm:max-w-md transform flex-col bg-[var(--bg-card)] shadow-xl transition duration-500 ease-in-out sm:duration-700"
        >
          <CustomerDetailContent 
            :customer="customer"
            @close="close"
            @refresh="$emit('refresh')"
            @edit="(c) => $emit('edit', c)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import CustomerDetailContent from './CustomerDetailContent.vue';

const props = defineProps({
  modelValue: Boolean,
  customer: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue', 'refresh', 'edit']);

const close = () => {
  emit('update:modelValue', false);
};
</script>
