<template>
  <!-- 根路由组件 -->
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
</template>

<script setup>
import ToastContainer from '@/components/ui/ToastContainer.vue';
import UploadProgress from '@/components/ui/UploadProgress.vue';
import ReloadPrompt from '@/components/ReloadPrompt.vue';
import AIChatWidget from '@/components/common/AIChatWidget.vue';
import CommandPalette from '@/components/ui/CommandPalette.vue';

// 认证检查由路由守卫处理
</script>
