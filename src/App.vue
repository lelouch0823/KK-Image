<template>
  <!-- Loading 状态 -->
  <div v-if="isLoading" class="flex h-screen items-center justify-center bg-gray-50">
    <div class="flex flex-col items-center gap-4">
      <div class="size-12 animate-spin rounded-full border-b-2 border-gray-900"></div>
      <p class="text-gray-500">{{ t('common.verifying') }}</p>
    </div>
  </div>

  <div
    v-else
    class="flex h-screen overflow-hidden bg-[var(--bg-page)] font-sans text-[var(--text-main)]"
  >
    <!-- 侧边栏 -->
    <Sidebar ref="sidebarRef" />

    <!-- 主内容区 -->
    <main class="relative flex flex-1 flex-col overflow-hidden">
      <Header @open-sidebar="sidebarRef?.openSidebar?.()" />

      <!-- 动态组件视图 -->
      <div class="scrollbar-thin relative flex-1 overflow-y-auto p-6">
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

    <!-- 全局上传进度面板 -->
    <UploadProgress />

    <!-- PWA 更新提示 -->
    <ReloadPrompt />
  </div>
</template>

<script setup>
import { computed, ref, onBeforeMount } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import Header from '@/components/layout/Header.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import UploadProgress from '@/components/ui/UploadProgress.vue';
import ReloadPrompt from '@/components/ReloadPrompt.vue';
import { useView } from '@/composables/useView';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';

// 导入视图组件
import Dashboard from '@/views/Dashboard.vue';
import FileManager from '@/views/FileManager/index.vue';
import SpaceManager from '@/views/SpaceManager/index.vue';
import Stats from '@/views/Stats.vue';
import OrderManager from '@/components/OrderManager.vue';
import SalespersonManager from '@/components/SalespersonManager.vue';
import Customers from '@/views/Customers.vue';
import Settings from '@/views/Settings.vue';

const { currentView } = useView();
const { t } = useI18n();
const { checkAuth, isLoading } = useAuth();

// Sidebar ref for mobile toggle
const sidebarRef = ref(null);

const currentComponent = computed(() => {
  switch (currentView.value) {
    case 'dashboard':
      return Dashboard;
    case 'files':
      return FileManager;
    case 'spaces':
      return SpaceManager;
    case 'stats':
      return Stats;
    case 'salespersons':
      return SalespersonManager;
    case 'orders':
      return OrderManager;
    case 'customers':
      return Customers;
    case 'settings':
      return Settings;
    default:
      return Dashboard;
  }
});

// Edge Middleware 已在服务器端验证 JWT
// 如果用户能看到此页面，说明已通过验证
// 这里仅用于获取用户信息更新 UI 状态
onBeforeMount(async () => {
  await checkAuth();
});
</script>
