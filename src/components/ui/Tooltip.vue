<template>
  <div
    class="relative inline-flex"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @focusin="handleFocus"
    @focusout="handleBlur"
  >
    <div ref="trigger" :aria-describedby="tooltipId">
      <slot></slot>
    </div>

    <Teleport to="body">
      <transition
        enter-active-class="transition ease-out-expo duration-200"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="isVisible && content"
          :id="tooltipId"
          ref="content"
          role="tooltip"
          :style="positionStyle"
          class="pointer-events-none fixed z-[9999] rounded-lg bg-(--text-main) px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-(--bg-card) shadow-lg"
        >
          {{ content }}
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onUnmounted, computed, nextTick, useTemplateRef } from 'vue';
import { generateRandomId } from '@/utils/common';

const props = defineProps({
  content: {
    type: String,
    required: true,
  },
  delay: {
    type: Number,
    default: 500,
  }, // Reduced delay for better UX
  position: {
    type: String,
    default: 'top',
    validator: (value) => ['top', 'bottom', 'left', 'right'].includes(value),
  },
});

const isVisible = ref(false);
const triggerRef = useTemplateRef('trigger');
const contentRef = useTemplateRef('content');
const tooltipId = generateRandomId('tooltip');
let timer = null;

const tooltipPosition = ref({ top: 0, left: 0 });

const updatePosition = async () => {
  if (!triggerRef.value) return;

  // Wait for content render
  await nextTick();

  const triggerRect = triggerRef.value.getBoundingClientRect();
  const contentRect = contentRef.value
    ? contentRef.value.getBoundingClientRect()
    : { width: 0, height: 0 };

  // Default position: Top Center
  let top = triggerRect.top - (contentRect.height || 30) - 8;
  let left = triggerRect.left + triggerRect.width / 2 - (contentRect.width || 0) / 2;

  // Viewport bound check
  // If top overflow, move to bottom
  if (top < 0) {
    top = triggerRect.bottom + 8;
  }

  // Left boundary
  if (left < 0) left = 4;

  // Right boundary
  if (left + contentRect.width > window.innerWidth) {
    left = window.innerWidth - contentRect.width - 4;
  }

  tooltipPosition.value = { top, left };
};

const positionStyle = computed(() => ({
  top: `${tooltipPosition.value.top}px`,
  left: `${tooltipPosition.value.left}px`,
}));

const show = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    isVisible.value = true;
    updatePosition();
  }, props.delay);
};

const hide = () => {
  clearTimeout(timer);
  isVisible.value = false;
};

// Event Handlers
const handleMouseEnter = () => show();
const handleMouseLeave = () => hide();
const handleFocus = () => show();
const handleBlur = () => hide();

// Cleanup
onUnmounted(() => {
  clearTimeout(timer);
});
</script>
