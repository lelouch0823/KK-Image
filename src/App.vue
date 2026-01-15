<template>
  <!-- 根路由组件 -->
  <router-view />

  <!-- 全局 Toast -->
  <ToastContainer />

  <!-- 全局上传进度面板 -->
  <UploadProgress />

  <!-- PWA 更新提示 -->
  <ReloadPrompt />

  <!-- 全局 AI 助手 -->
  <AIChatWidget />
</template>

<script setup>
import ToastContainer from '@/components/ui/ToastContainer.vue';
import UploadProgress from '@/components/ui/UploadProgress.vue';
import ReloadPrompt from '@/components/ReloadPrompt.vue';
import AIChatWidget from '@/components/common/AIChatWidget.vue';

// 认证检查由路由守卫处理
</script>
