<template>
  <!-- 移动端背景遮罩 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-(--color-overlay-dim) transition-opacity lg:hidden"
    @click="closeSidebar"
  ></div>

  <aside
    :class="[
      'z-50 flex shrink-0 flex-col border-r border-(--border-color) bg-(--bg-card) transition-all duration-300 ease-out-expo',
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
          class="bg-primary text-(--text-inverse) flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold shadow-sm"
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
        <AppButton
          variant="ghost"
          size="sm"
          :aria-label="isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
          class="text-secondary hidden !h-8 !w-8 !gap-0 !px-0 hover:text-primary lg:flex [&_span]:hidden"
          :title="isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
          @click="toggleCollapse"
        >
          <template #icon-left>
            <AppIcon
              name="chevron-double-left"
              class="size-5 transition-transform duration-300"
              :class="isCollapsed ? 'rotate-180' : ''"
            />
          </template>
        </AppButton>

        <!-- 移动端关闭按钮 -->
        <AppButton
          variant="ghost"
          size="sm"
          :aria-label="t('common.close')"
          class="text-(--text-muted) !h-8 !w-8 !gap-0 !px-0 lg:hidden [&_span]:hidden"
          @click="closeSidebar"
        >
          <template #icon-left>
            <AppIcon name="x-mark" class="size-5" />
          </template>
        </AppButton>
      </div>
    </div>

    <!-- 菜单 -->
    <nav class="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
      <div class="mb-6">
        <transition name="fade">
          <div
            v-if="!isCollapsed"
            class="text-(--text-muted) mb-2 px-3 text-xs font-medium tracking-wider uppercase"
          >
            {{ t('sidebar.menu') }}
          </div>
        </transition>
        <AppButton
          v-for="item in visibleMenuItems"
          :key="item.key"
          variant="ghost"
          size="sm"
          block
          :title="isCollapsed ? item.label : ''"
          :class="menuItemClass(item.key)"
          @click="handleMenuClick(item.key)"
        >
          <template #icon-left>
            <AppIcon :name="item.icon" class="size-5 shrink-0" />
          </template>
          <transition name="fade-slide">
            <span v-if="!isCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
          </transition>
        </AppButton>
      </div>

      <!-- 最近访问（仅展开时显示） -->
      <transition name="fade">
        <RecentViews v-if="!isCollapsed" />
      </transition>

      <div>
        <transition name="fade">
          <div
            v-if="!isCollapsed"
            class="text-(--text-muted) mb-2 px-3 text-xs font-medium tracking-wider uppercase"
          >
            {{ t('sidebar.manage') }}
          </div>
        </transition>
        <AppButton
          variant="ghost"
          size="sm"
          block
          :title="isCollapsed ? t('sidebar.logout') : ''"
          :class="[
            'text-secondary !h-auto !justify-start !px-3 !py-2.5 text-sm font-medium hover:text-danger hover:bg-(--color-danger-bg)',
            isCollapsed ? '!justify-center' : '',
          ]"
          @click="handleLogout"
        >
          <template #icon-left>
            <AppIcon name="arrow-right-on-rectangle" class="size-5 shrink-0" />
          </template>
          <transition name="fade-slide">
            <span v-if="!isCollapsed" class="whitespace-nowrap">{{ t('sidebar.logout') }}</span>
          </transition>
        </AppButton>
      </div>
    </nav>

    <!-- 用户信息 -->
    <div class="border-t border-(--border-color) p-4">
      <div class="flex items-center gap-3" :class="isCollapsed ? 'justify-center' : ''">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold"
        >
          {{ currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U' }}
        </div>
        <transition name="fade-slide">
          <div v-if="!isCollapsed" class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-(--text-main)">
              {{ currentUser?.name || t('sidebar.role') }}
            </div>
            <div class="text-(--text-muted) text-xs capitalize">
              {{ currentUser?.role || t('sidebar.role') }}
            </div>
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
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useAccessControl } from '@/composables/useAccessControl';
import { useToast } from '@/composables/useToast';
import {
  getAdminFeaturePath,
  getSidebarAdminFeatures,
  inferAdminFeatureKeyFromPath,
} from '@/config/admin-features';
import { getItem, setItem } from '@/utils/storage';
import AppButton from '@/components/ui/AppButton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import RecentViews from '@/components/layout/RecentViews.vue';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const { logout, currentUser } = useAuth();
const { hasPermission, loadPermissions, permissionsLoaded, clearPermissions } = useAccessControl();
const { addToast } = useToast();

// 当前视图 key (从路由路径推断)
const currentView = computed(() => {
  return inferAdminFeatureKeyFromPath(route.path);
});

// 移动端侧边栏状态
const isOpen = ref(false);

// 桌面端折叠状态（持久化到 localStorage）
const isCollapsed = ref(false);

const STORAGE_KEY = 'sidebar-collapsed';

onMounted(() => {
  // 从 localStorage 恢复折叠状态
  const saved = getItem(STORAGE_KEY);
  if (saved !== null) {
    isCollapsed.value = saved === 'true';
  }
});

watch(
  () => currentUser.value?.id,
  async (id) => {
    if (!id) {
      clearPermissions();
      return;
    }
    await loadPermissions({ force: true });
  },
  { immediate: true }
);

// 菜单项样式
const menuItemClass = (key) => {
  const isActive = currentView.value === key;
  const base = 'mb-1 !h-auto !justify-start !px-3 !py-2.5 text-sm font-medium transition-all duration-200 border-l-2 -ml-0.5 pl-[14px]';
  const active = isActive
    ? 'text-primary bg-primary/8 font-semibold shadow-sm border-primary'
    : 'text-secondary hover:text-main hover:bg-(--bg-hover) border-transparent';
  const collapsed = isCollapsed.value ? '!justify-center !border-l-0 !ml-0 !pl-3' : '';
  return [base, active, collapsed];
};

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
  setItem(STORAGE_KEY, isCollapsed.value.toString());
};

const openSidebar = () => {
  isOpen.value = true;
};

const closeSidebar = () => {
  isOpen.value = false;
};

// 菜单点击：使用 router 导航并关闭侧边栏
const handleMenuClick = (key) => {
  router.push(getAdminFeaturePath(key));
  closeSidebar();
};

// 暴露给 Header 组件调用
defineExpose({ openSidebar });

const menuItems = computed(() => [
  ...getSidebarAdminFeatures().map((feature) => ({
    key: feature.key,
    label: t(feature.labelKey),
    icon: feature.icon,
    permission: feature.permission,
  })),
]);

// 过滤包含用户对应权限的菜单
const visibleMenuItems = computed(() => {
  return menuItems.value.filter((item) => {
    if (!item.permission) return true;
    if (!permissionsLoaded.value) return false;
    return hasPermission(item.permission);
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
    opacity var(--transition-smooth),
    transform var(--transition-smooth);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms var(--ease-in-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
