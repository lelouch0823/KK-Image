<template>
  <div class="space-y-3">
    <!-- 加载状态 -->
    <template v-if="loading">
      <Skeleton template="list-card" :count="5" />
    </template>

    <!-- 订单卡片 -->
    <template v-else-if="data.length > 0">
      <AppCard
        v-for="order in data"
        :key="order.id"
        clickable
        class="group"
        @click="$emit('detail', order)"
      >
        <div class="flex gap-3">
          <!-- 主图 -->
          <div
            class="border-(--border-color) bg-(--bg-muted) size-16 shrink-0 overflow-hidden rounded-lg border"
          >
            <AppImage 
              v-if="order.mainImage" 
              :src="order.mainImage" 
              :blurhash="order.mainImageBlurhash"
              fit="cover"
              class="order-card-image size-full"
              rounded="none"
            />
            <div v-else class="flex size-full items-center justify-center">
              <AppIcon name="photo" class="text-(--text-secondary)/30 stroke-[1.5] size-6" />
            </div>
          </div>

          <!-- 信息 -->
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="text-(--text-main) flex min-w-0 flex-1 items-center gap-2 truncate pr-2 font-bold">
                <span class="block truncate" :title="order.productName || '-'">{{ order.productName || '-' }}</span>
                <span
                  v-if="order.hasNewFeedback"
                  class="bg-danger border-(--bg-card) size-2.5 shrink-0 animate-pulse rounded-full border-2"
                ></span>
              </div>
              <div class="shrink-0" @click.stop>
                <slot name="status" :order="order"></slot>
              </div>
            </div>
            <div class="text-(--text-secondary) mt-1.5 truncate text-xs font-medium" :title="`${order.salesperson?.name || ''} ${order.salesperson?.store ? '· ' + order.salesperson?.store : ''}`">
              {{ order.salesperson?.name }} <template v-if="order.salesperson?.store">· {{ order.salesperson?.store }}</template>
            </div>
            <div class="text-(--text-secondary)/60 mt-1 select-all truncate font-mono text-xs" :title="order.orderNo">
              {{ order.orderNo }}
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <template #footer>
          <div class="flex items-center justify-between" @click.stop>
            <span class="text-(--text-secondary)/50 text-xs">{{
              formatTime(order.createdAt)
            }}</span>
            <button
              class="bg-primary/5 text-primary hover:bg-primary/10 rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-90"
              @click="$emit('edit', order)"
            >
              {{ t('order.manage.editOrder') }}
            </button>
          </div>
        </template>
      </AppCard>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="file" :title="t('order.portal.emptyOrders')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppCard from '@/components/ui/AppCard.vue';

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

const formatTime = (timestamp) => formatDate(timestamp, { hour: undefined, minute: undefined });
</script>
