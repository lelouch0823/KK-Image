<template>
  <!-- 移动端背景遮罩 -->
  <div 
    v-if="isOpen" 
    class="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
    @click="closeSidebar"
  ></div>

  <aside 
    :class="[
      'bg-white border-r border-[var(--border-color)] flex flex-col shrink-0 z-50 transition-all duration-300',
      // 桌面端：根据折叠状态切换宽度
      isCollapsed ? 'lg:w-[72px]' : 'lg:w-[var(--sidebar-width)]',
      'lg:relative lg:translate-x-0',
      // 移动端：抽屉式，默认隐藏
      'fixed inset-y-0 left-0 w-72',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    ]"
  >
    <!-- Logo -->
    <div class="h-[var(--header-height)] flex items-center justify-between px-4 border-b border-[var(--border-color)]">
      <div class="flex items-center overflow-hidden">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-white font-bold text-sm shrink-0">
          KK
        </div>
        <transition name="fade-slide">
          <span v-if="!isCollapsed" class="ml-3 text-lg font-bold text-primary tracking-tight whitespace-nowrap">KK-Image</span>
        </transition>
      </div>
      <div class="flex items-center gap-1">
        <!-- 桌面端折叠按钮 -->
        <button 
          @click="toggleCollapse"
          class="hidden lg:flex p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-secondary hover:text-primary transition-colors"
          :title="isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
        >
          <svg 
            class="w-5 h-5 transition-transform duration-300" 
            :class="isCollapsed ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>
          </svg>
        </button>

        <!-- 移动端关闭按钮 -->
        <button @click="closeSidebar" class="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 菜单 -->
    <nav class="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
      <div class="mb-6">
        <transition name="fade">
          <div v-if="!isCollapsed" class="px-3 mb-2 text-xs font-semibold text-secondary uppercase tracking-wider">{{ t('sidebar.menu') }}</div>
        </transition>
        <button v-for="item in menuItems" :key="item.key" @click="handleMenuClick(item.key)"
          :title="isCollapsed ? item.label : ''"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1"
          :class="[
            currentView === item.key ? 'bg-[var(--bg-active)] text-primary' : 'text-secondary hover:bg-[var(--bg-hover)] hover:text-primary',
            isCollapsed ? 'justify-center' : ''
          ]">
          <span v-html="item.icon" class="w-5 h-5 shrink-0"></span>
          <transition name="fade-slide">
            <span v-if="!isCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
          </transition>
        </button>
      </div>

      <div>
        <transition name="fade">
          <div v-if="!isCollapsed" class="px-3 mb-2 text-xs font-semibold text-secondary uppercase tracking-wider">{{ t('sidebar.manage') }}</div>
        </transition>
        <button @click="handleLogout"
          :title="isCollapsed ? t('sidebar.logout') : ''"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)] transition-colors',
            isCollapsed ? 'justify-center' : ''
          ]">
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <transition name="fade-slide">
            <span v-if="!isCollapsed" class="whitespace-nowrap">{{ t('sidebar.logout') }}</span>
          </transition>
        </button>
      </div>
    </nav>



    <!-- 用户信息 -->
    <div class="p-4 border-t border-[var(--border-color)]">
      <div class="flex items-center gap-3" :class="isCollapsed ? 'justify-center' : ''">
        <div class="w-9 h-9 rounded-full bg-[var(--bg-muted)] flex items-center justify-center text-sm font-semibold text-secondary shrink-0">
          A</div>
        <transition name="fade-slide">
          <div v-if="!isCollapsed" class="flex-1 min-w-0">
            <div class="text-sm font-medium text-primary truncate">Admin</div>
            <div class="text-xs text-secondary">{{ t('sidebar.role') }}</div>
          </div>
        </transition>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useView } from '@/composables/useView';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';

const { currentView, setView } = useView();
const { t } = useI18n();
const { logout } = useAuth();
const { addToast } = useToast();

// 移动端侧边栏状态
const isOpen = ref(false);

// 桌面端折叠状态（持久化到 localStorage）
const isCollapsed = ref(false);

const STORAGE_KEY = 'sidebar-collapsed';

onMounted(() => {
  // 从 localStorage 恢复折叠状态
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    isCollapsed.value = saved === 'true';
  }
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem(STORAGE_KEY, isCollapsed.value.toString());
};

const openSidebar = () => {
  isOpen.value = true;
};

const closeSidebar = () => {
  isOpen.value = false;
};

// 菜单点击：切换视图并关闭侧边栏
const handleMenuClick = (key) => {
  setView(key);
  closeSidebar();
};

// 暴露给 Header 组件调用
defineExpose({ openSidebar });

const menuItems = computed(() => [
  { key: 'dashboard', label: t('sidebar.dashboard'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>' },
  { key: 'files', label: t('sidebar.files'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>' },
  { key: 'spaces', label: t('sidebar.spaces'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>' },
  { key: 'orders', label: t('order.manage.title'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>' },
  { key: 'customers', label: t('customer.manage.title'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>' },
  { key: 'salespersons', label: t('salesperson.title'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>' },
  { key: 'stats', label: t('sidebar.stats'), icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>' }
]);

const handleLogout = async () => {
    await logout();
    addToast({ message: t('auth.logout') + ' Success', type: 'success' });
    window.location.reload();
};
</script>

<style scoped>
/* 淡出滑动动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

