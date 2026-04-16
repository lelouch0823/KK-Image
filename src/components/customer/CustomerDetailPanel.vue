<template>
  <Modal
    :model-value="modelValue"
    size="lg"
    body-class="!p-0"
    @update:model-value="handleModelValueUpdate"
    @close="close"
  >
    <CustomerDetailContent
      class="min-h-[70vh] sm:min-h-[36rem]"
      :customer="customer"
      @close="close"
      @refresh="$emit('refresh')"
      @edit="(c) => $emit('edit', c)"
    />
  </Modal>
</template>

<script setup>
import Modal from '@/components/ui/Modal.vue';
import CustomerDetailContent from './CustomerDetailContent.vue';

defineProps({
  modelValue: Boolean,
  customer: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue', 'refresh', 'edit']);

const close = () => {
  emit('update:modelValue', false);
};

const handleModelValueUpdate = (nextValue) => {
  emit('update:modelValue', nextValue);
};
</script>
