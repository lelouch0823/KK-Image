<template>
  <header
    class="flex h-(--header-height) shrink-0 items-center justify-between border-b border-(--border-color) bg-(--bg-card) px-4 lg:px-6"
  >
    <div class="flex items-center gap-3">
      <!-- 移动端汉堡菜单按钮 -->
      <AppButton
        variant="ghost"
        size="sm"
        :aria-label="t('sidebar.expand')"
        class="text-secondary -ml-2 !h-9 !w-9 !gap-0 !px-0 lg:hidden [&_span]:hidden"
        @click="$emit('openSidebar')"
      >
        <template #icon-left>
          <AppIcon name="bars-3" class="size-5" />
        </template>
      </AppButton>
      <h1 class="text-primary text-lg font-semibold lg:text-xl">{{ viewTitle }}</h1>
    </div>
    <div class="flex items-center gap-2 lg:gap-4">
      <!-- 移动端搜索按钮 -->
      <AppButton
        variant="ghost"
        size="sm"
        :aria-label="t('header.searchPlaceholder')"
        class="text-secondary !h-9 !w-9 !gap-0 !px-0 lg:hidden [&_span]:hidden"
        @click="openMobileSearch"
      >
        <template #icon-left>
          <AppIcon name="magnifying-glass" class="size-5" />
        </template>
      </AppButton>

      <!-- 搜索框 (桌面端) -->
      <div class="hidden lg:block">
        <SearchInput
          v-model="searchQuery"
          :placeholder="t('header.searchPlaceholder')"
          size="sm"
          input-class="w-64 !bg-(--bg-page)"
          :debounce="300"
        />
      </div>

      <!-- 命令面板快捷入口 (桌面端) -->
      <AppButton
        variant="ghost"
        size="sm"
        class="hidden items-center gap-1.5 border border-(--border-color) text-(--text-muted) lg:flex"
        :title="t('commandPalette.shortcut')"
        @click="openCommandPalette"
      >
        <AppIcon name="magnifying-glass" class="size-3.5" />
        <kbd class="font-mono text-xs">⌘K</kbd>
      </AppButton>
      <!-- 通知铃铛 (桌面端) -->
      <div v-if="notificationsSupported" ref="notificationRef" class="relative">
        <AppButton
          v-if="!permissionDenied"
          variant="white"
          size="sm"
          :aria-label="t('header.notifications')"
          class="relative !h-9 !w-9 !gap-0 !px-0 [&_span]:hidden"
          :class="{ 'bg-(--bg-hover)': showNotifications }"
          @click="toggleNotifications"
        >
          <template #icon-left>
            <AppIcon name="bell" class="text-secondary size-5" />
          </template>
          <!-- 红点 -->
          <span
            v-if="unreadCount > 0"
            class="bg-danger absolute top-1.5 right-1.5 size-2 rounded-full border border-(--bg-card)"
          ></span>
        </AppButton>
        <AppButton
          v-else
          variant="white"
          size="sm"
          class="relative !h-9 !w-9 !gap-0 !px-0 border-warning/25 bg-(--color-warning-bg) text-(--color-warning-text) [&_span]:hidden"
          :title="permissionDeniedReason || t('notification.readPermissionDenied')"
          disabled
        >
          <template #icon-left>
            <AppIcon name="lock-closed" class="size-5" />
          </template>
        </AppButton>

        <!-- 下拉弹窗 (PC端) -->
        <Transition
          v-if="!permissionDenied"
          enter-active-class="transition duration-150 ease-out-expo"
          enter-from-class="transform scale-[0.97] opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-100"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-[0.98] opacity-0"
        >
          <div
            v-if="showNotifications"
            class="absolute top-full right-0 z-50 mt-2 origin-top-right shadow-lg"
          >
            <NotificationList :close="() => (showNotifications = false)" />
          </div>
        </Transition>
      </div>

      <!-- 主题切换按钮 -->
      <AppButton
        variant="white"
        size="sm"
        :aria-label="isDark ? t('header.lightMode') : t('header.darkMode')"
        class="!h-9 !w-9 !gap-0 !px-0 [&_span]:hidden"
        :title="isDark ? t('header.lightMode') : t('header.darkMode')"
        @click="toggleTheme"
      >
        <template #icon-left>
          <AppIcon v-if="isDark" name="sun" class="text-secondary size-5" />
          <AppIcon v-else name="moon" class="text-secondary size-5" />
        </template>
      </AppButton>

      <!-- 语言切换按钮（中/英） -->
      <AppButton
        variant="white"
        size="sm"
        :aria-label="t('header.switchLanguage')"
        :title="t('header.switchLanguage')"
        class="!h-9 !w-9 !gap-0 !px-0 text-xs !font-semibold"
        @click="toggleLocale"
      >
        <template #icon-left>
          <AppIcon name="globe" class="text-secondary size-4" />
        </template>
        <span class="text-secondary">{{ isEnglish ? '中' : 'EN' }}</span>
      </AppButton>

      <!-- AI 助手按钮 -->
      <AppButton
        v-if="canUseAI"
        :aria-label="t('ai.assistant')"
        :title="t('ai.assistant')"
        variant="white"
        size="sm"
        class="group relative !h-9 !w-9 !gap-0 !px-0 transition-all hover:border-primary/30 hover:bg-primary/5 [&_span]:hidden"
        :class="{ 'bg-primary/10 border-primary/50 text-primary': isOpen }"
        @click="toggleAI"
      >
        <template #icon-left>
          <AppIcon
            name="bolt"
            class="size-5 transition-transform group-hover:scale-110"
            :class="{ 'text-primary': isOpen, 'text-secondary': !isOpen }"
          />
        </template>
      </AppButton>

      <!-- 刷新按钮 -->
      <AppButton
        variant="white"
        size="sm"
        :aria-label="t('header.refresh')"
        :title="t('header.refresh')"
        class="!h-9 !w-9 !gap-0 !px-0 disabled:opacity-50 [&_span]:hidden"
        @click="handleRefresh"
      >
        <template #icon-left>
          <AppIcon name="arrow-path" class="text-secondary size-4" />
        </template>
      </AppButton>
    </div>

    <!-- 移动端搜索遮罩 (Search Overlay) -->
    <transition name="fade">
      <div
        v-if="showMobileSearch"
        class="absolute inset-0 z-50 flex items-center bg-(--bg-card) px-4 lg:hidden"
      >
        <div class="flex-1">
          <SearchInput
            ref="mobileSearchInputRef"
            v-model="searchQuery"
            :placeholder="t('header.searchPlaceholder')"
            input-class="!bg-(--bg-page)"
            :debounce="300"
            @clear="closeMobileSearch"
          />
        </div>
        <AppButton variant="link" class="text-secondary ml-3" @click="closeMobileSearch">
          {{ t('common.cancel') }}
        </AppButton>
      </div>
    </transition>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import { useNotifications } from '@/composables/useNotifications';
import NotificationList from '@/components/common/NotificationList.vue';
import { onClickOutside } from '@vueuse/core';
import { useAI } from '@/composables/useAI';
import { useAccessControl } from '@/composables/useAccessControl';
import { useTheme } from '@/composables/useTheme';
import { useCommandPalette } from '@/composables/useCommandPalette';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { useToast } from '@/composables/useToast';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SearchInput from '@/components/ui/SearchInput.vue';

defineEmits(['openSidebar']);

const route = useRoute();
// 从路由 meta 获取页面标题
const viewTitle = computed(() => route.meta?.title || t('common.adminPanel', '管理后台'));
const { t, locale, setLocale } = useI18n();
const isEnglish = computed(() => locale.value === 'en-US');
const toggleLocale = () => {
  setLocale(isEnglish.value ? 'zh-CN' : 'en-US');
};
const { searchQuery } = useSearch();
const {
  notifications,
  unreadCount,
  startPolling,
  stopPolling,
  setAdminMode,
  permissionDenied,
  permissionDeniedReason,
} = useNotifications();
// 单一通知轮询路径：startPolling（全量列表 + 未读数 + 权限处理）是唯一的自动轮询，
// 不再并行启动 useNotificationStream 的 /poll 轮询（同一资源双倍请求）；
// 新通知提醒改为监听未读数增长
const { addToast } = useToast();
let lastSeenUnreadCount = -1;
watch(unreadCount, (count) => {
  // 首次载入（lastSeenUnreadCount 仍为 -1）只记录基线，不提醒
  if (lastSeenUnreadCount >= 0 && count > lastSeenUnreadCount) {
    const latest = notifications.value[0];
    addToast({
      message: latest?.title || t('notification.newFeedback'),
      type: 'info',
    });
  }
  lastSeenUnreadCount = count;
});
const { isOpen, toggle: toggleAI } = useAI();
const { hasPermission, loadPermissions } = useAccessControl();
const { isDark, toggleTheme } = useTheme();
const { open: openCommandPalette } = useCommandPalette();
const { publishRefresh } = useAppRefreshBus();

const showNotifications = ref(false);
const notificationRef = ref(null);
const notificationsSupported = ref(true); // 可以根据路由判断是否显示，目前全显示
const canUseAI = ref(false);

// 移动端搜索状态
const showMobileSearch = ref(false);
const mobileSearchInputRef = ref(null);

const openMobileSearch = async () => {
  showMobileSearch.value = true;
  await nextTick();
  mobileSearchInputRef.value?.focus();
};

const closeMobileSearch = () => {
  showMobileSearch.value = false;
};

// 点击外部关闭
onClickOutside(notificationRef, () => {
  showNotifications.value = false;
});

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
};

const handleRefresh = () => {
  // 空 module 表示全局刷新，各视图通过 subscribeModule('', handler) 订阅
  publishRefresh({ module: '' });
};

onMounted(async () => {
  await loadPermissions();
  canUseAI.value = hasPermission('stats:read');
  setAdminMode();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>
