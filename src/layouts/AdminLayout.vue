<template>
  <div class="flex h-screen overflow-hidden bg-(--bg-page) font-sans text-(--text-main)">
    <!-- 侧边栏 -->
    <Sidebar ref="sidebarRef" />

    <!-- 主内容区 -->
    <main class="relative flex flex-1 flex-col overflow-hidden">
      <Header @open-sidebar="sidebarRef?.openSidebar?.()" />

      <!-- 路由视图（带错误边界） -->
      <div class="scrollbar-thin relative flex-1 overflow-y-auto p-4 sm:p-6">
        <AppErrorBoundary @back="$router.push('/admin/dashboard')">
          <router-view v-slot="{ Component, route }">
            <transition name="slide-up" mode="out-in">
              <keep-alive :max="10">
                <component :is="Component" :key="route.fullPath" />
              </keep-alive>
            </transition>
          </router-view>
        </AppErrorBoundary>
      </div>
    </main>

    <!-- 全局 Modal 挂载点 -->
    <div id="modal-root"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import Header from '@/components/layout/Header.vue';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';

const sidebarRef = ref(null);
</script>
