<template>
  <!-- 移动端背景遮罩 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
    @click="closeSidebar"
  ></div>

  <aside
    :class="[
      'z-50 flex shrink-0 flex-col border-r border-(--border-color) bg-(--bg-card) transition-all duration-300',
      // 桌面端：根据折叠状态切换宽度
      isCollapsed ? 'lg:w-[72px]' : 'lg:w-(--sidebar-width)',
      'lg:relative lg:translate-x-0',
      // 移动端：抽屉式，默认隐藏
      'fixed inset-y-0 left-0 w-72',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Logo -->
    <div
      class="flex h-(--header-height) items-center justify-between border-b border-(--border-color) px-4"
    >
      <div class="flex items-center overflow-hidden">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-black text-sm font-bold text-white"
        >
          KK
        </div>
        <transition name="fade-slide">
          <span
            v-if="!isCollapsed"
            class="text-primary ml-3 text-lg font-bold tracking-tight whitespace-nowrap"
            >kk-life</span
          >
        </transition>
      </div>
      <div class="flex items-center gap-1">
        <!-- 桌面端折叠按钮 -->
        <button
          type="button"
          class="text-secondary hidden rounded-lg p-1.5 transition-colors hover:text-primary hover:bg-(--bg-hover) lg:flex"
          :title="isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
          @click="toggleCollapse"
        >
          <AppIcon
            name="chevron-double-left"
            class="size-5 transition-transform duration-300"
            :class="isCollapsed ? 'rotate-180' : ''"
          />
        </button>

        <!-- 移动端关闭按钮 -->
        <button
          type="button"
          class="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-hover) lg:hidden"
          @click="closeSidebar"
        >
          <AppIcon name="x-mark" class="size-5" />
        </button>
      </div>
    </div>

    <!-- 菜单 -->
    <nav class="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
      <div class="mb-6">
        <transition name="fade">
          <div
            v-if="!isCollapsed"
            class="text-secondary mb-2 px-3 text-xs font-semibold tracking-wider uppercase"
          >
            {{ t('sidebar.menu') }}
          </div>
        </transition>
        <button
          v-for="item in visibleMenuItems"
          :key="item.key"
          type="button"
          :title="isCollapsed ? item.label : ''"
          class="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          :class="[
            currentView === item.key
              ? 'text-primary bg-primary/5 ring-primary/10 font-semibold shadow-sm ring-1'
              : 'text-secondary hover:text-primary hover:bg-(--bg-hover)',
            isCollapsed ? 'justify-center' : '',
          ]"
          @click="handleMenuClick(item.key)"
        >
          <AppIcon :name="item.icon" class="size-5 shrink-0" />
          <transition name="fade-slide">
            <span v-if="!isCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
          </transition>
        </button>
      </div>

      <div>
        <transition name="fade">
          <div
            v-if="!isCollapsed"
            class="text-secondary mb-2 px-3 text-xs font-semibold tracking-wider uppercase"
          >
            {{ t('sidebar.manage') }}
          </div>
        </transition>
        <button
          type="button"
          :title="isCollapsed ? t('sidebar.logout') : ''"
          :class="[
            'text-secondary flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-(--color-danger-bg) hover:text-danger',
            isCollapsed ? 'justify-center' : '',
          ]"
          @click="handleLogout"
        >
          <AppIcon name="arrow-right-on-rectangle" class="size-5 shrink-0" />
          <transition name="fade-slide">
            <span v-if="!isCollapsed" class="whitespace-nowrap">{{ t('sidebar.logout') }}</span>
          </transition>
        </button>
      </div>
    </nav>

    <!-- 用户信息 -->
    <div class="border-t border-(--border-color) p-4">
      <div class="flex items-center gap-3" :class="isCollapsed ? 'justify-center' : ''">
        <div
          class="text-secondary flex size-9 shrink-0 items-center justify-center rounded-full bg-(--bg-muted) text-sm font-semibold uppercase"
        >
          {{ currentUser?.name ? currentUser.name.charAt(0) : 'U' }}
        </div>
        <transition name="fade-slide">
          <div v-if="!isCollapsed" class="min-w-0 flex-1">
            <div class="text-primary truncate text-sm font-medium">{{ currentUser?.name || t('sidebar.role') }}</div>
            <div class="text-secondary text-xs capitalize">{{ currentUser?.role || t('sidebar.role') }}</div>
          </div>
        </transition>
      </div>
    </div>
  </aside>

  <!-- 退出确认弹窗 -->
  <ConfirmDialog
    v-model="showLogoutConfirm"
    type="danger"
    :title="t('common.logoutConfirmTitle')"
    :message="t('common.logoutConfirmMessage')"
    :confirm-text="t('sidebar.logout')"
    :loading="logoutLoading"
    @confirm="confirmLogout"
  />
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const { logout, currentUser } = useAuth();
const { addToast } = useToast();

// 当前视图 key (从路由路径推断)
const currentView = computed(() => {
  const path = route.path;
  if (path.startsWith('/admin/')) {
    return path.replace('/admin/', '');
  }
  return 'dashboard';
});

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

// 菜单点击：使用 router 导航并关闭侧边栏
const handleMenuClick = (key) => {
  router.push(`/admin/${key}`);
  closeSidebar();
};

// 暴露给 Header 组件调用
defineExpose({ openSidebar });

const menuItems = computed(() => [
  {
    key: 'dashboard',
    label: t('sidebar.dashboard'),
    icon: 'squares-2x2',
  },
  {
    key: 'files',
    label: t('sidebar.files'),
    icon: 'folder',
    // All roles can see files except some edge cases, assuming typical ones based on router
    roles: ['admin', 'manager', 'sales', 'viewer']
  },
  {
    key: 'spaces',
    label: t('sidebar.spaces'),
    icon: 'rectangle-group',
    roles: ['admin', 'manager', 'sales', 'viewer']
  },
  {
    key: 'products',
    label: t('views.products'),
    icon: 'cube',
    roles: ['admin', 'manager', 'sales', 'viewer']
  },
  {
    key: 'orders',
    label: t('order.manage.title'),
    icon: 'clipboard-document-list',
    roles: ['admin', 'manager', 'sales']
  },
  {
    key: 'goods-overview',
    label: t('sidebar.goodsOverview'),
    icon: 'building-storefront',
    roles: ['admin', 'manager']
  },
  {
    key: 'purchase-orders',
    label: t('purchaseOrder.title'),
    icon: 'shopping-cart',
    roles: ['admin', 'manager']
  },
  {
    key: 'customers',
    label: t('customer.manage.title'),
    icon: 'users',
    roles: ['admin', 'manager']
  },
  {
    key: 'salespersons',
    label: t('salesperson.title'),
    icon: 'briefcase',
    roles: ['admin', 'manager']
  },
  {
    key: 'stats',
    label: t('sidebar.stats'),
    icon: 'chart-bar',
    roles: ['admin', 'manager', 'viewer']
  },
  {
    key: 'settings',
    label: t('settings.title'),
    icon: 'cog-8-tooth',
    roles: ['admin']
  },
  {
    key: 'audit-logs',
    label: t('router.audit_logs'),
    icon: 'document-text',
    roles: ['admin']
  }
]);

// 过滤包含用户对应权限的菜单
const visibleMenuItems = computed(() => {
  const userRole = currentUser.value?.role;
  
  return menuItems.value.filter(item => {
    // 如果没有 roles 属性，默认所有人都可见
    if (!item.roles || item.roles.length === 0) return true;
    
    // 如果当前并未加载完毕 role，默认显示最基础的无权限页面或通过后端401保障安全
    // 为了防止菜单闪现为空白，对于需要权限的菜单项，只有明确 role 后才进行过滤
    if (!userRole) return false;
    
    return item.roles.includes(userRole);
  });
});

const showLogoutConfirm = ref(false);
const logoutLoading = ref(false);

const handleLogout = () => {
  showLogoutConfirm.value = true;
};

const confirmLogout = async () => {
  logoutLoading.value = true;
  try {
    await logout();
    addToast({ message: t('auth.logout'), type: 'success' });
    // 使用 router 导航到登录页
    router.push('/login');
  } catch (e) {
    console.error(e);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    logoutLoading.value = false;
    showLogoutConfirm.value = false;
  }
};
</script>

<style scoped>
/* 淡出滑动动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
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
