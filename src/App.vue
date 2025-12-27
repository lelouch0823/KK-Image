<template>
  <!-- Loading 状态 -->
  <div v-if="isLoading" class="flex h-screen items-center justify-center bg-gray-50">
    <div class="flex flex-col items-center gap-4">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      <p class="text-gray-500">正在验证身份...</p>
    </div>
  </div>

  <div v-else class="flex h-screen overflow-hidden bg-[var(--bg-page)] font-sans text-[var(--text-main)]">
    <!-- 侧边栏 -->
    <Sidebar />

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col overflow-hidden relative">
      <Header />
      
      <!-- 动态组件视图 -->
      <div class="flex-1 overflow-y-auto scrollbar-thin p-6 relative">
        <transition name="fade" mode="out-in">
          <keep-alive>
            <component :is="currentComponent" />
          </keep-alive>
        </transition>
      </div>
    </main>

    <!-- 全局 Toast -->
    <ToastContainer />
    
    <!-- 全局 Modal 挂载点 -->
    <div id="modal-root"></div>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, watch } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import Header from '@/components/layout/Header.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import { useView } from '@/composables/useView';
import { useAuth } from '@/composables/useAuth';

// 导入视图组件
import Dashboard from '@/views/Dashboard.vue';
import FileManager from '@/views/FileManager/index.vue';
import Stats from '@/views/Stats.vue';

const { currentView } = useView();
const { checkAuth, isAuthenticated, isLoading } = useAuth();

const currentComponent = computed(() => {
  switch (currentView.value) {
    case 'dashboard': return Dashboard;
    case 'files': return FileManager; // 合并了 albums, files
    case 'stats': return Stats;
    default: return Dashboard;
  }
});

// 全局认证守卫
onBeforeMount(async () => {
    console.log('App.vue: Starting auth check...');
    const isAuth = await checkAuth();
    console.log('App.vue: Auth check result:', isAuth);
    
    if (!isAuth) {
        console.log('App.vue: Redirecting to login...');
        // 重定向到登录页
        window.location.href = '/login';
    } else {
        console.log('App.vue: Auth success, rendering admin interface.');
    }
});
</script>
