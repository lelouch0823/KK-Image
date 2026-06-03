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
            class="size-16 shrink-0 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted)"
          >
            <AppImage
              v-if="order.mainImage"
              :src="order.mainImage"
              :alt="order.name || order.orderNo"
              :blurhash="order.mainImageBlurhash"
              fit="cover"
              class="order-card-image size-full"
              rounded="none"
            />
            <div v-else class="flex size-full items-center justify-center">
              <AppIcon name="photo" class="size-6 stroke-[1.5] text-(--text-secondary)/30" />
            </div>
          </div>

          <!-- 信息 -->
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="flex min-w-0 flex-1 items-center gap-2 truncate pr-2 font-bold text-(--text-main)">
                <span class="block truncate" :title="order.productName || '-'">{{ order.productName || '-' }}</span>
                <span
                  v-if="order.hasNewFeedback"
                  class="bg-danger size-2.5 shrink-0 animate-pulse rounded-full border-2 border-(--bg-card)"
                ></span>
              </div>
              <div class="shrink-0" @click.stop>
                <slot name="status" :order="order"></slot>
              </div>
            </div>
            <div class="mt-1.5 truncate text-xs font-medium text-(--text-secondary)" :title="`${order.salesperson?.name || ''} ${order.salesperson?.store ? '· ' + order.salesperson?.store : ''}`">
              {{ order.salesperson?.name }} <template v-if="order.salesperson?.store">· {{ order.salesperson?.store }}</template>
            </div>
            <div class="mt-1 truncate font-mono text-xs text-(--text-secondary)/60 select-all" :title="order.orderNo">
              {{ order.orderNo }}
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <template #footer>
          <div class="flex items-center justify-between" @click.stop>
            <span class="text-xs text-(--text-secondary)/50">{{
              formatDate(order.createdAt, { hour: undefined, minute: undefined })
            }}</span>
            <AppButton
              variant="secondary"
              size="sm"
              class="bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              @click="$emit('edit', order)"
            >
              {{ t('order.manage.editOrder') }}
            </AppButton>
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
import AppButton from '@/components/ui/AppButton.vue';
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

</script>
