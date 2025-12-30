<template>
  <header class="h-[var(--header-height)] bg-white border-b border-[var(--border-color)] flex items-center justify-between px-4 lg:px-6 shrink-0">
    <div class="flex items-center gap-3">
      <!-- 移动端汉堡菜单按钮 -->
      <button 
        @click="$emit('openSidebar')"
        class="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--bg-hover)] text-secondary"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>
      <h1 class="text-lg lg:text-xl font-semibold text-primary">{{ viewTitle }}</h1>
    </div>
    <div class="flex items-center gap-2 lg:gap-4">
      <!-- 搜索框 (桌面端) -->
      <div class="relative hidden lg:block">
        <input type="text" :placeholder="t('header.searchPlaceholder')" v-model="searchQuery"
          class="w-64 h-9 pl-9 pr-4 text-sm border border-[var(--border-color)] rounded-lg bg-[var(--bg-page)] focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all" />
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
      <!-- 通知铃铛 (桌面端) -->
      <div v-if="notificationsSupported" class="relative" ref="notificationRef">
        <button 
          @click="toggleNotifications"
          class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors relative"
          :class="{ 'bg-[var(--bg-hover)]': showNotifications }"
        >
          <svg class="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <!-- 红点 -->
          <span v-if="unreadCount > 0" class="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-danger)] rounded-full border border-white"></span>
        </button>

        <!-- 下拉弹窗 (PC端) -->
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div 
            v-if="showNotifications"
            class="absolute right-0 top-full mt-2 z-50 origin-top-right shadow-2xl"
          >
            <NotificationList :close="() => showNotifications = false" />
          </div>
        </Transition>
      </div>

      <!-- 刷新按钮 -->
      <button @click="handleRefresh" :title="t('header.refresh')" class="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
        <svg class="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useView } from '@/composables/useView';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import { useNotifications } from '@/composables/useNotifications';
import NotificationList from '@/components/common/NotificationList.vue';
import { onClickOutside } from '@vueuse/core';

defineEmits(['openSidebar']);

const { viewTitle, setView } = useView(); // setView unused here but destructured
const { t } = useI18n();
const { searchQuery } = useSearch();
const { unreadCount, startPolling, stopPolling } = useNotifications();

const showNotifications = ref(false);
const notificationRef = ref(null);
const notificationsSupported = ref(true); // 可以根据路由判断是否显示，目前全显示

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
