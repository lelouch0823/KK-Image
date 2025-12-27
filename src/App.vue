<template>
  <div class="flex h-screen overflow-hidden bg-[var(--bg-page)] font-sans text-[var(--text-main)]">
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
import { computed } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import Header from '@/components/layout/Header.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import { useView } from '@/composables/useView';

// 导入视图组件
import Dashboard from '@/views/Dashboard.vue';
import FileManager from '@/views/FileManager/index.vue';
import Stats from '@/views/Stats.vue';

const { currentView } = useView();

const currentComponent = computed(() => {
  switch (currentView.value) {
    case 'dashboard': return Dashboard;
    case 'files': return FileManager; // 合并了 albums, files
    case 'stats': return Stats;
    default: return Dashboard;
  }
});
</script>
