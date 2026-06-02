<template>
  <div v-if="recentViews.length > 0" class="mb-4">
    <!-- 标题栏：折叠切换 + 清空按钮 -->
    <div class="mb-2 flex items-center justify-between px-3">
      <button
        class="text-muted flex items-center gap-1 text-[11px] font-medium tracking-wider uppercase transition-colors hover:text-(--text-main)"
        @click="isCollapsed = !isCollapsed"
      >
        <AppIcon
          name="chevron-right"
          class="size-3 transition-transform duration-200"
          :class="isCollapsed ? '' : 'rotate-90'"
        />
        {{ t('sidebar.recentViews') }}
      </button>
      <button
        v-if="!isCollapsed"
        class="text-muted hover:text-danger text-[11px] transition-colors"
        @click="handleClear"
      >
        {{ t('sidebar.clearRecent') }}
      </button>
    </div>

    <!-- 访问列表 -->
    <transition name="fade">
      <div v-if="!isCollapsed" class="space-y-0.5">
        <div
          v-for="item in displayItems"
          :key="`${item.type}-${item.id}`"
          class="group flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-150 hover:bg-(--bg-hover)"
          :title="item.title"
          @click="navigateTo(item)"
        >
          <AppIcon :name="iconMap[item.type]" class="size-4 shrink-0 text-(--text-muted)" />
          <span class="min-w-0 flex-1 truncate text-(--text-secondary) group-hover:text-(--text-main)">
            {{ item.title }}
          </span>
          <span class="text-muted shrink-0 text-xs">
            {{ formatRelativeTime(item.timestamp) }}
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useRecentViews } from '@/composables/useRecentViews';
import AppIcon from '@/components/ui/AppIcon.vue';

const router = useRouter();
const { t } = useI18n();
const { recentViews, clearRecentViews } = useRecentViews();

// 折叠状态（默认展开）
const isCollapsed = ref(false);

// 最多显示 5 条
const displayItems = computed(() => recentViews.value.slice(0, 5));

// 类型 -> 图标映射
const iconMap = {
  order: 'clipboard-document-list',
  product: 'cube',
  customer: 'users',
};

// 类型 -> 路由路径映射
const routeMap = {
  order: '/admin/orders',
  product: '/admin/products',
  customer: '/admin/customers',
};

/**
 * 导航到详情页
 * 通过 query 参数传递 id，由目标页面的 watch 处理打开详情弹窗
 */
const navigateTo = (item) => {
  const basePath = routeMap[item.type];
  if (!basePath) return;
  router.push({ path: basePath, query: { id: item.id } });
};

/**
 * 格式化相对时间
 */
const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return t('common.justNow');
  if (minutes < 60) return t('common.minutesAgo', { count: minutes });
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  return t('common.daysAgo', { count: days });
};

/**
 * 清空所有记录（带确认）
 */
const handleClear = () => {
  clearRecentViews();
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms var(--ease-in-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
