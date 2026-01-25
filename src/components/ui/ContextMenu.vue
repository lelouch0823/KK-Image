<template>
  <transition name="fade">
    <div
      v-if="modelValue"
      class="shadow-glass fixed z-50 max-w-[240px] min-w-[160px] overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]/90 p-1 ring-1 ring-black/5 backdrop-blur-md dark:bg-[var(--bg-card)]/95"
      :style="menuStyle"
      @contextmenu.prevent
    >
      <div v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div v-if="item.type === 'separator'" class="my-1 border-t border-[var(--border-color)]"></div>

        <!-- Menu Item -->
        <button
          v-else
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
          :class="{
            'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]': item.danger,
            'text-secondary hover:text-primary': !item.danger,
            'cursor-not-allowed opacity-50': item.disabled
          }"
          :disabled="item.disabled"
          @click="handleClick(item)"
        >
          <component :is="item.icon" v-if="item.icon" class="size-4" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
  </transition>

  <!-- Overlay to close menu on click outside -->
  <div
    v-if="modelValue"
    class="fixed inset-0 z-40 bg-transparent"
    @click="close"
    @contextmenu.prevent="close"
  ></div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  x: {
    type: Number,
    default: 0,
  },
  y: {
    type: Number,
    default: 0,
  },
  items: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'select']);

// Mobile-friendly adjustment: if x is close to right edge, move it left.
// Simple inline style calculation or computed property.
const menuStyle = computed(() => {
    // Simple basic boundary check could be complex without element ref.
    // For now, let's just default to clientX/Y but cap max-width.
    // A better approach is usually to interpret x/y as 'anchor' and translate if needed.
    // But CSS `right: something` vs `left` is easier if we know screen width.
    
    // Quick Fix: If x > window.innerWidth * 0.6, align to right.
    const isRightSide = props.x > (typeof window !== 'undefined' ? window.innerWidth * 0.6 : 500);
    const isBottomSide = props.y > (typeof window !== 'undefined' ? window.innerHeight * 0.6 : 500);
    
    return {
        top: isBottomSide ? 'auto' : `${props.y}px`,
        bottom: isBottomSide ? `${window.innerHeight - props.y}px` : 'auto',
        left: isRightSide ? 'auto' : `${props.x}px`,
        right: isRightSide ? `${window.innerWidth - props.x}px` : 'auto',
    }
});

const close = () => {
  emit('update:modelValue', false);
};

const handleClick = (item) => {
  if (item.disabled) return;
  if (item.action) {
    item.action();
  }
  emit('select', item);
  close();
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
