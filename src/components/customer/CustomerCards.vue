<template>
  <div class="space-y-3">
    <!-- 加载状态 -->
    <template v-if="loading">
      <Skeleton template="list-card" :count="5" />
    </template>

    <!-- 客户卡片 -->
    <template v-else-if="data.length > 0">
      <AppCard
        v-for="customer in data"
        :key="customer.id"
        clickable
        @click="$emit('detail', customer)"
      >
        <div class="flex flex-col gap-3">
          <!-- 头部信息: 姓名与公司 -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2 font-bold text-(--text-main)">
                {{ customer.name }}
                <!-- RFM 分段徽章 -->
                <span
                  v-if="customer.segment && customer.segment !== 'new'"
                  class="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-bold"
                  :class="segmentClasses(customer.segment)"
                >
                  {{ t(`customer.detail.segment${segmentLabelMap[customer.segment]}`) }}
                </span>
              </div>
              <div class="mt-1 text-xs font-medium text-(--text-secondary)">
                {{ customer.company || '-' }}
              </div>
            </div>
            <!-- 编辑按钮 (Top Right) -->
            <AppButton
               variant="ghost"
               size="sm"
               class="rounded-full !h-8 !w-8 !px-0"
               @click.stop="$emit('edit', customer)"
            >
               <template #icon-left>
                 <AppIcon name="pencil-square" class="size-4" />
               </template>
            </AppButton>
          </div>

          <!-- 联系方式 -->
          <div class="space-y-1 text-xs text-(--text-secondary)">
             <div v-if="customer.phone" class="flex items-center gap-2">
                <AppIcon name="phone" class="size-3.5 shrink-0" />
                <span>{{ customer.phone }}</span>
             </div>
             <div v-if="customer.email" class="flex items-center gap-2">
                <AppIcon name="envelope" class="size-3.5 shrink-0" />
                <span>{{ customer.email }}</span>
             </div>
          </div>
          
           <!-- 标签 -->
           <div v-if="customer.tags && customer.tags.length > 0" class="flex flex-wrap gap-1.5 pt-1">
              <span
                v-for="tag in customer.tags"
                :key="tag"
                class="rounded bg-(--bg-muted) px-2 py-0.5 text-xs text-(--text-secondary)"
              >
                {{ tag }}
              </span>
           </div>

        </div>

        <!-- 底部操作栏 -->
        <template #footer>
          <div class="flex items-center justify-between" @click.stop>
            <span class="text-xs text-(--text-secondary)/50">{{
              formatDate(customer.createdAt)
            }}</span>
            <!-- 可以放置更多操作，目前点击卡片看详情，右上角编辑 -->
          </div>
        </template>
      </AppCard>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="users" :title="t('customer.manage.empty')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  data: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['detail', 'edit']);

const { t } = useI18n();

// RFM 分段标签映射
const segmentLabelMap = {
  vip: 'Vip',
  active: 'Active',
  'at-risk': 'AtRisk',
  lost: 'Lost',
  new: 'New',
};

// RFM 分段样式
const segmentClasses = (segment) => {
  const map = {
    vip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'at-risk': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    lost: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return map[segment] || map.new;
};
</script>
