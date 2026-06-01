<template>
  <!-- 根路由组件 -->
  <router-view v-slot="{ Component }">
    <Transition name="fade-page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </router-view>

  <!-- 全局 Toast -->
  <ToastContainer />

  <!-- 全局上传进度面板 -->
  <UploadProgress />

  <!-- PWA 更新提示 -->
  <ReloadPrompt />

  <!-- 全局 AI 助手 -->
  <AIChatWidget />

  <!-- 全局命令面板 (⌘K) -->
  <CommandPalette />

  <!-- 全局键盘快捷键帮助弹窗 (?) -->
  <KeyboardShortcutsHelp v-model="showShortcutsHelp" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import UploadProgress from '@/components/ui/UploadProgress.vue';
import ReloadPrompt from '@/components/ReloadPrompt.vue';
import AIChatWidget from '@/components/common/AIChatWidget.vue';
import CommandPalette from '@/components/ui/CommandPalette.vue';
import KeyboardShortcutsHelp from '@/components/ui/KeyboardShortcutsHelp.vue';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useCommandPalette } from '@/composables/useCommandPalette';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { register, unregister, attachListener, detachListener } = useKeyboardShortcuts();
const { toggle: toggleCommandPalette } = useCommandPalette();

// 快捷键帮助弹窗状态
const showShortcutsHelp = ref(false);

// ---------- 注册默认快捷键 ----------

// ? 键 - 显示/隐藏快捷键帮助
register(
  'help-toggle',
  '?',
  () => {
    showShortcutsHelp.value = !showShortcutsHelp.value;
  },
  {
    description: t('keyboardShortcuts.shortcuts.toggleHelp'),
    category: 'general',
    i18nKey: 'keyboardShortcuts.shortcuts.toggleHelp',
  },
);

// Mod+K - 打开命令面板（与现有命令面板集成）
register(
  'command-palette',
  'Mod+k',
  () => {
    toggleCommandPalette();
  },
  {
    description: t('keyboardShortcuts.shortcuts.commandPalette'),
    category: 'general',
    i18nKey: 'keyboardShortcuts.shortcuts.commandPalette',
  },
);

// Escape - 关闭弹窗（文档性质，实际由 Modal.vue 处理）
register(
  'escape-close',
  'Escape',
  () => {
    // Escape 的实际关闭逻辑由 Modal.vue 自行处理
    // 此处仅用于在帮助弹窗中展示该快捷键
  },
  {
    description: t('keyboardShortcuts.shortcuts.closeModal'),
    category: 'general',
    overrideDefault: true,
    i18nKey: 'keyboardShortcuts.shortcuts.closeModal',
  },
);

// ---------- 生命周期 ----------

onMounted(() => {
  attachListener();
});

onUnmounted(() => {
  detachListener();
  // 注销 App 级别的快捷键
  unregister('help-toggle');
  unregister('command-palette');
  unregister('escape-close');
});

// 认证检查由路由守卫处理
</script>
