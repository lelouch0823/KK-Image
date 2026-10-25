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
  const gap = 8;

  let top;
  let left;

  switch (props.position) {
    case 'bottom':
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - (contentRect.width || 0) / 2;
      // 底部溢出时翻回上方
      if (top + (contentRect.height || 0) > window.innerHeight) {
        top = triggerRect.top - (contentRect.height || 0) - gap;
      }
      break;
    case 'left':
      top = triggerRect.top + triggerRect.height / 2 - (contentRect.height || 0) / 2;
      left = triggerRect.left - (contentRect.width || 0) - gap;
      // 左侧溢出时翻到右侧
      if (left < 0) {
        left = triggerRect.right + gap;
      }
      break;
    case 'right':
      top = triggerRect.top + triggerRect.height / 2 - (contentRect.height || 0) / 2;
      left = triggerRect.right + gap;
      // 右侧溢出时翻到左侧
      if (left + (contentRect.width || 0) > window.innerWidth) {
        left = triggerRect.left - (contentRect.width || 0) - gap;
      }
      break;
    case 'top':
    default:
      top = triggerRect.top - (contentRect.height || 0) - gap;
      left = triggerRect.left + triggerRect.width / 2 - (contentRect.width || 0) / 2;
      // 顶部溢出时翻到下方
      if (top < 0) {
        top = triggerRect.bottom + gap;
      }
      break;
  }

  // 上下边界钳制
  if (top < 0) top = 4;
  if (top + (contentRect.height || 0) > window.innerHeight) {
    top = Math.max(4, window.innerHeight - (contentRect.height || 0) - 4);
  }

  // 左右边界钳制
  if (left < 0) left = 4;
  if (left + (contentRect.width || 0) > window.innerWidth) {
    left = window.innerWidth - (contentRect.width || 0) - 4;
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
