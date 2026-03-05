<template>
  <header
    class="flex h-(--header-height) shrink-0 items-center justify-between border-b border-(--border-color) bg-(--bg-card) px-4 lg:px-6"
  >
    <div class="flex items-center gap-3">
      <!-- 移动端汉堡菜单按钮 -->
      <button
        class="text-secondary -ml-2 rounded-lg p-2 hover:bg-(--bg-hover) lg:hidden"
        @click="$emit('openSidebar')"
      >
        <AppIcon name="bars-3" class="size-5" />
      </button>
      <h1 class="text-primary text-lg font-semibold lg:text-xl">{{ viewTitle }}</h1>
    </div>
    <div class="flex items-center gap-2 lg:gap-4">
      <!-- 移动端搜索按钮 -->
      <button
        class="text-secondary flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-(--bg-hover) lg:hidden"
        @click="openMobileSearch"
      >
        <AppIcon name="magnifying-glass" class="size-5" />
      </button>

      <!-- 搜索框 (桌面端) -->
      <div class="relative hidden lg:block">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('header.searchPlaceholder')"
          class="h-9 w-64 rounded-lg border border-(--border-color) bg-(--bg-page) pr-4 pl-9 text-sm transition-all focus:border-gray-300 focus:ring-2 focus:ring-gray-200 focus:outline-none"
        />
        <AppIcon name="magnifying-glass" class="text-secondary absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      </div>
      <!-- 通知铃铛 (桌面端) -->
      <div v-if="notificationsSupported" ref="notificationRef" class="relative">
        <button
          v-if="!permissionDenied"
          class="relative flex size-9 items-center justify-center rounded-lg border border-(--border-color) transition-colors hover:bg-(--bg-hover)"
          :class="{ 'bg-(--bg-hover)': showNotifications }"
          @click="toggleNotifications"
        >
          <AppIcon name="bell" class="text-secondary size-5" />
          <!-- 红点 -->
          <span
            v-if="unreadCount > 0"
            class="bg-danger absolute top-1.5 right-1.5 size-2 rounded-full border border-white"
          ></span>
        </button>
        <button
          v-else
          class="relative flex size-9 cursor-not-allowed items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-700"
          :title="permissionDeniedReason || '通知读取权限不足'"
          disabled
        >
          <AppIcon name="lock-closed" class="size-5" />
        </button>

        <!-- 下拉弹窗 (PC端) -->
        <Transition
          v-if="!permissionDenied"
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div
            v-if="showNotifications"
            class="absolute top-full right-0 z-50 mt-2 origin-top-right shadow-2xl"
          >
            <NotificationList :close="() => (showNotifications = false)" />
          </div>
        </Transition>
      </div>

      <!-- 主题切换按钮 -->
      <button
        class="flex size-9 items-center justify-center rounded-lg border border-(--border-color) transition-colors hover:bg-(--bg-hover)"
        :title="isDark ? '切换亮色模式' : '切换暗色模式'"
        @click="toggleTheme"
      >
        <!-- Sun Icon (Show in Dark Mode) -->
        <AppIcon v-if="isDark" name="sun" class="text-secondary size-5" />
        <!-- Moon Icon (Show in Light Mode) -->
        <AppIcon v-else name="moon" class="text-secondary size-5" />
      </button>

      <!-- AI 助手按钮 -->
      <button
        :title="t('ai.assistant')"
        class="group relative flex size-9 items-center justify-center rounded-lg border border-(--border-color) transition-all hover:bg-primary/5 hover:border-primary/30"
        :class="{ 'bg-primary/10 border-primary/50 text-primary': isOpen }"
        @click="toggleAI"
      >
        <AppIcon
          name="bolt"
          class="size-5 transition-transform group-hover:scale-110"
          :class="{ 'text-primary': isOpen, 'text-secondary': !isOpen }"
        />
      </button>

      <!-- 刷新按钮 -->
      <button
        :title="t('header.refresh')"
        class="flex size-9 items-center justify-center rounded-lg border border-(--border-color) transition-colors hover:bg-(--bg-hover) disabled:opacity-50"
        @click="handleRefresh"
      >
        <AppIcon name="arrow-path" class="text-secondary size-4" />
      </button>
    </div>
    
    <!-- 移动端搜索遮罩 (Search Overlay) -->
    <transition name="fade">
      <div v-if="showMobileSearch" class="absolute inset-0 z-50 flex items-center bg-(--bg-card) px-4 lg:hidden">
        <div class="relative flex-1">
            <input
            ref="mobileSearchInputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="t('header.searchPlaceholder')"
            class="h-10 w-full rounded-lg border border-(--border-color) bg-(--bg-page) pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            @keydown.esc="closeMobileSearch"
            @blur="!searchQuery && closeMobileSearch()"
            />
            <AppIcon name="magnifying-glass" class="text-secondary absolute top-1/2 left-3 size-5 -translate-y-1/2" />
        </div>
        <button class="text-secondary ml-3 p-2 font-medium" @click="closeMobileSearch">
            {{ t('common.cancel') }}
        </button>
      </div>
    </transition>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import { useNotifications } from '@/composables/useNotifications';
import NotificationList from '@/components/common/NotificationList.vue';
import { onClickOutside } from '@vueuse/core';
import { useAI } from '@/composables/useAI';
import { useTheme } from '@/composables/useTheme';
import AppIcon from '@/components/ui/AppIcon.vue';

defineEmits(['openSidebar']);

const route = useRoute();
// 从路由 meta 获取页面标题
const viewTitle = computed(() => route.meta?.title || '管理后台');
const { t } = useI18n();
const { searchQuery } = useSearch();
const { unreadCount, startPolling, stopPolling, permissionDenied, permissionDeniedReason } = useNotifications();
const { isOpen, toggle: toggleAI } = useAI();
const { isDark, toggleTheme } = useTheme();

const showNotifications = ref(false);
const notificationRef = ref(null);
const notificationsSupported = ref(true); // 可以根据路由判断是否显示，目前全显示

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
    searchQuery.value = ''; // Optional: clear on close? Or keep? Let's keep it consistent with desktop (don't clear)
};

// 点击外部关闭
onClickOutside(notificationRef, () => {
  showNotifications.value = false;
});

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
};

const handleRefresh = () => {
  window.location.reload();
};

onMounted(() => {
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>
