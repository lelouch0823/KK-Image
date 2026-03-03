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
              </div>
              <div class="mt-1 text-xs font-medium text-(--text-secondary)">
                {{ customer.company || '-' }}
              </div>
            </div>
            <!-- 编辑按钮 (Top Right) -->
            <button
               class="rounded-full p-2 text-(--text-secondary) active:bg-(--bg-muted)"
               @click.stop="$emit('edit', customer)"
            >
               <AppIcon name="pencil-square" class="size-4" />
            </button>
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
                class="rounded bg-(--bg-muted) px-2 py-0.5 text-[10px] text-(--text-secondary)"
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
</script>
