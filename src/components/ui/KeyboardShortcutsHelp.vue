<template>
  <Modal
    v-model="isOpen"
    :title="t('keyboardShortcuts.title')"
    size="2xl"
    body-class="!p-0"
  >
    <!-- 快捷键列表 -->
    <div class="divide-y divide-(--border-color)">
      <div
        v-for="group in groupedShortcuts"
        :key="group.category"
        class="px-6 py-4"
      >
        <!-- 分类标题 -->
        <h3
          class="mb-3 text-xs font-semibold uppercase tracking-wider"
          :style="{ color: 'var(--text-muted)' }"
        >
          {{ group.label }}
        </h3>

        <!-- 快捷键列表 -->
        <div class="space-y-2">
          <div
            v-for="shortcut in group.items"
            :key="shortcut.id"
            class="flex items-center justify-between"
          >
            <span class="text-sm" :style="{ color: 'var(--text-main)' }">
              {{ shortcut.description }}
            </span>
            <div class="flex items-center gap-1">
              <!-- 修饰键 -->
              <kbd
                v-for="mod in getModifiers(shortcut)"
                :key="mod"
                class="inline-flex h-6 min-w-[24px] items-center justify-center rounded bg-(--bg-muted) px-1.5 text-xs font-mono"
                :style="{ color: 'var(--text-secondary)' }"
              >
                {{ mod }}
              </kbd>
              <!-- 主键 -->
              <kbd
                class="inline-flex h-6 min-w-[24px] items-center justify-center rounded bg-(--bg-muted) px-1.5 text-xs font-mono"
                :style="{ color: 'var(--text-secondary)' }"
              >
                {{ formatKey(shortcut.key) }}
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部提示 -->
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <p class="text-xs" :style="{ color: 'var(--text-muted)' }">
          {{ t('keyboardShortcuts.description') }}
        </p>
        <AppButton variant="ghost" size="sm" @click="close">
          {{ t('common.cancel') }}
        </AppButton>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';

const { t } = useI18n();
const { shortcuts, enabled } = useKeyboardShortcuts();

// 帮助弹窗状态（通过快捷键系统控制）
const isOpen = defineModel({ type: Boolean, default: false });

// 分类顺序
const categoryOrder = ['general', 'navigation', 'actions', 'editing'];

// 按分类分组的快捷键
const groupedShortcuts = computed(() => {
  const groups = new Map();

  // 初始化分组
  for (const cat of categoryOrder) {
    groups.set(cat, []);
  }

  // 将快捷键分组
  for (const shortcut of shortcuts.value) {
    const cat = shortcut.category || 'general';
    if (groups.has(cat)) {
      groups.get(cat).push(shortcut);
    }
  }

  // 转换为数组，过滤空分组
  return categoryOrder
    .filter((cat) => groups.get(cat).length > 0)
    .map((cat) => ({
      category: cat,
      label: t(`keyboardShortcuts.category.${cat}`),
      items: groups.get(cat),
    }));
});

// 获取修饰键显示文本
const getModifiers = (shortcut) => {
  const mods = [];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  if (shortcut.modifiers.meta) {
    mods.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.modifiers.ctrl) {
    mods.push('Ctrl');
  }
  if (shortcut.modifiers.shift) {
    mods.push('Shift');
  }
  if (shortcut.modifiers.alt) {
    mods.push(isMac ? '⌥' : 'Alt');
  }
  return mods;
};

// 格式化按键显示
const formatKey = (key) => {
  const keyMap = {
    '/': '/',
    '?': '?',
    escape: 'Esc',
    enter: 'Enter',
    ' ': 'Space',
  };
  return keyMap[key] || key.toUpperCase();
};

const close = () => {
  isOpen.value = false;
};
</script>
