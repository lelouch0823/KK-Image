<template>
  <Modal
    :model-value="modelValue"
    :size="size"
    :closable="closable"
    :close-on-backdrop="closeOnBackdrop"
    :labelled-by="title ? overlayTitleId : ''"
    body-class="!p-0"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div data-overlay-scaffold :data-overlay-layout="layout" class="flex min-h-0 flex-1 flex-col">
      <header
        v-if="title || description || eyebrow || $slots.header || $slots.headerActions"
        data-overlay-header
        class="flex flex-col gap-4 border-b border-(--border-color) px-6 py-5"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <slot name="header">
              <p
                v-if="eyebrow"
                class="text-xs font-semibold tracking-[0.14em] text-(--text-muted) uppercase"
              >
                {{ eyebrow }}
              </p>
              <h2 :id="overlayTitleId" class="text-xl font-semibold text-(--text-main)">
                {{ title }}
              </h2>
              <p v-if="description" class="mt-1 text-sm leading-6 text-(--text-secondary)">
                {{ description }}
              </p>
            </slot>
          </div>
          <div
            v-if="$slots.headerActions"
            data-overlay-header-actions
            class="flex shrink-0 items-center gap-2"
          >
            <slot name="headerActions" />
          </div>
        </div>
      </header>

      <div data-overlay-body class="min-h-0 flex-1 overflow-y-auto px-6 py-5" :class="bodyClass">
        <slot />
      </div>

      <footer
        v-if="$slots.footer"
        data-overlay-footer
        class="border-t border-(--border-color) bg-(--bg-muted)/35 px-6 py-4"
        :class="footerClass"
      >
        <slot name="footer" />
      </footer>
    </div>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import Modal from '@/components/ui/Modal.vue';

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  eyebrow: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: '3xl',
  },
  layout: {
    type: String,
    default: 'dialog',
  },
  bodyClass: {
    type: String,
    default: '',
  },
  footerClass: {
    type: String,
    default: '',
  },
  closable: {
    type: Boolean,
    default: true,
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['update:modelValue', 'close']);
const overlayTitleId = ref(`overlay-scaffold-title-${Math.random().toString(36).slice(2, 10)}`);
</script>
