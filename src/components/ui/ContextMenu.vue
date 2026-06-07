<template>
  <transition name="fade" @after-enter="onAfterEnter">
    <div
      v-if="modelValue"
      ref="menuRef"
      class="shadow-glass fixed z-50 max-w-[240px] min-w-[160px] overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-card)/90 p-1 ring-1 ring-(--border-color)/40 backdrop-blur-md dark:bg-(--bg-card)/95"
      :style="menuStyle"
      role="menu"
      @contextmenu.prevent
      @keydown="handleKeydown"
    >
      <template v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div
          v-if="item.type === 'separator'"
          class="my-1 border-t border-(--border-color)"
          role="separator"
        ></div>

        <!-- Menu Item -->
        <button
          v-else
          :ref="(el) => setItemRef(el, index)"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-hover)"
          :class="{
            'text-danger hover:bg-(--color-danger-bg)': item.danger,
            'text-secondary hover:text-primary': !item.danger,
            'cursor-not-allowed opacity-50': item.disabled,
          }"
          role="menuitem"
          tabindex="-1"
          :disabled="item.disabled"
          @click="handleClick(item)"
        >
          <component :is="item.icon" v-if="item.icon" class="size-4" />
          <span>{{ item.label }}</span>
        </button>
      </template>
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
import { computed, ref, nextTick, watch } from 'vue';

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

const menuRef = ref(null);
const itemRefs = ref([]);
const focusedIndex = ref(-1);

// 收集可操作（非 disabled、非 separator）的菜单项索引列表
const actionableIndices = computed(() =>
  props.items
    .map((item, index) => (item.type !== 'separator' && !item.disabled ? index : -1))
    .filter((i) => i !== -1)
);

const setItemRef = (el, index) => {
  if (el) {
    itemRefs.value[index] = el;
  }
};

// 聚焦指定索引的菜单项
const focusItem = (index) => {
  focusedIndex.value = index;
  nextTick(() => {
    itemRefs.value[index]?.focus();
  });
};

// 菜单打开后自动聚焦第一个可操作项
const onAfterEnter = () => {
  itemRefs.value = [];
  if (actionableIndices.value.length > 0) {
    focusItem(actionableIndices.value[0]);
  }
};

// 监听菜单关闭，重置状态
watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      focusedIndex.value = -1;
      itemRefs.value = [];
    }
  }
);

// 键盘导航处理
const handleKeydown = (e) => {
  const indices = actionableIndices.value;
  if (indices.length === 0) return;

  switch (e.key) {
    case 'ArrowDown': {
      e.preventDefault();
      const currentPos = indices.indexOf(focusedIndex.value);
      const nextPos = currentPos < indices.length - 1 ? currentPos + 1 : 0;
      focusItem(indices[nextPos]);
      break;
    }
    case 'ArrowUp': {
      e.preventDefault();
      const currentPos = indices.indexOf(focusedIndex.value);
      const prevPos = currentPos > 0 ? currentPos - 1 : indices.length - 1;
      focusItem(indices[prevPos]);
      break;
    }
    case 'Enter':
    case ' ': {
      e.preventDefault();
      const item = props.items[focusedIndex.value];
      if (item && !item.disabled) {
        handleClick(item);
      }
      break;
    }
    case 'Escape': {
      e.preventDefault();
      close();
      break;
    }
  }
};

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
  };
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
