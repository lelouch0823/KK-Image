<template>
  <div class="relative inline-flex" 
    @mouseenter="handleMouseEnter" 
    @mouseleave="handleMouseLeave"
    @focusin="handleFocus"
    @focusout="handleBlur"
    @keydown.esc="hide"
  >
    <div ref="triggerRef" :aria-describedby="tooltipId">
      <slot></slot>
    </div>
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="isVisible && content" 
           :id="tooltipId"
           role="tooltip"
           class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-50">
        {{ content }}
        <!-- Arrow -->
        <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  delay: {
    type: Number,
    default: 2000
  }
});

const isVisible = ref(false);
const triggerRef = ref(null);
const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
let timer = null;

const show = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    isVisible.value = true;
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
