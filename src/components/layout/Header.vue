<template>
  <header
    class="flex h-(--header-height) shrink-0 items-center justify-between border-b border-(--border-color) bg-(--bg-card) px-4 lg:px-6"
  >
    <div class="flex items-center gap-3">
      <!-- 移动端汉堡菜单按钮 -->
      <AppButton
        variant="ghost"
        size="sm"
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
          input-class="h-9 w-64 !bg-(--bg-page)"
          :debounce="0"
        />
      </div>
      <!-- 通知铃铛 (桌面端) -->
      <div v-if="notificationsSupported" ref="notificationRef" class="relative">
        <AppButton
          v-if="!permissionDenied"
          variant="white"
          size="sm"
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
            class="bg-danger absolute top-1.5 right-1.5 size-2 rounded-full border border-white"
          ></span>
        </AppButton>
        <AppButton
          v-else
          variant="white"
          size="sm"
          class="relative !h-9 !w-9 !gap-0 !px-0 border-amber-300 bg-amber-50 text-amber-700 [&_span]:hidden"
          :title="permissionDeniedReason || '通知读取权限不足'"
          disabled
        >
          <template #icon-left>
            <AppIcon name="lock-closed" class="size-5" />
          </template>
        </AppButton>

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
      <AppButton
        variant="white"
        size="sm"
        class="!h-9 !w-9 !gap-0 !px-0 [&_span]:hidden"
        :title="isDark ? '切换亮色模式' : '切换暗色模式'"
        @click="toggleTheme"
      >
        <template #icon-left>
          <AppIcon v-if="isDark" name="sun" class="text-secondary size-5" />
          <AppIcon v-else name="moon" class="text-secondary size-5" />
        </template>
      </AppButton>

      <!-- AI 助手按钮 -->
      <AppButton
        v-if="canUseAI"
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
      <div v-if="showMobileSearch" class="absolute inset-0 z-50 flex items-center bg-(--bg-card) px-4 lg:hidden">
        <div class="flex-1">
            <SearchInput
              ref="mobileSearchInputRef"
              v-model="searchQuery"
              :placeholder="t('header.searchPlaceholder')"
              input-class="h-10 !bg-(--bg-page)"
              :debounce="0"
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
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import { useNotifications } from '@/composables/useNotifications';
import NotificationList from '@/components/common/NotificationList.vue';
import { onClickOutside } from '@vueuse/core';
import { useAI } from '@/composables/useAI';
import { useAccessControl } from '@/composables/useAccessControl';
import { useTheme } from '@/composables/useTheme';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SearchInput from '@/components/ui/SearchInput.vue';

defineEmits(['openSidebar']);

const route = useRoute();
// 从路由 meta 获取页面标题
const viewTitle = computed(() => route.meta?.title || '管理后台');
const { t } = useI18n();
const { searchQuery } = useSearch();
const { unreadCount, startPolling, stopPolling, setAdminMode, permissionDenied, permissionDeniedReason } = useNotifications();
const { isOpen, toggle: toggleAI } = useAI();
const { hasPermission, loadPermissions } = useAccessControl();
const { isDark, toggleTheme } = useTheme();

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
