<template>
  <div class="space-y-3">
    <!-- 加载状态 -->
    <template v-if="loading">
      <div
        v-for="i in 5"
        :key="i"
        class="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
      >
        <div class="space-y-3">
          <div class="flex justify-between">
            <div class="h-4 w-1/3 rounded bg-[var(--bg-muted)]"></div>
            <div class="h-4 w-1/4 rounded bg-[var(--bg-muted)]"></div>
          </div>
          <div class="h-3 w-1/2 rounded bg-[var(--bg-muted)]"></div>
          <div class="h-3 w-2/3 rounded bg-[var(--bg-muted)]"></div>
        </div>
      </div>
    </template>

    <!-- 客户卡片 -->
    <template v-else-if="data.length > 0">
      <div
        v-for="customer in data"
        :key="customer.id"
        class="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm transition-all active:scale-[0.98] active:bg-[var(--bg-hover)] active:shadow-none"
        @click="$emit('detail', customer)"
      >
        <div class="flex flex-col gap-3 p-4">
          <!-- 头部信息: 姓名与公司 -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2 font-bold text-[var(--text-main)]">
                {{ customer.name }}
              </div>
              <div class="mt-1 text-xs font-medium text-[var(--text-secondary)]">
                {{ customer.company || '-' }}
              </div>
            </div>
            <!-- 编辑按钮 (Top Right) -->
            <button
               class="rounded-full p-2 text-[var(--text-secondary)] active:bg-[var(--bg-muted)]"
               @click.stop="$emit('edit', customer)"
            >
               <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
               </svg>
            </button>
          </div>

          <!-- 联系方式 -->
          <div class="space-y-1 text-xs text-[var(--text-secondary)]">
             <div v-if="customer.phone" class="flex items-center gap-2">
                <svg class="size-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span>{{ customer.phone }}</span>
             </div>
             <div v-if="customer.email" class="flex items-center gap-2">
                <svg class="size-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span>{{ customer.email }}</span>
             </div>
          </div>
          
           <!-- 标签 -->
           <div v-if="customer.tags && customer.tags.length > 0" class="flex flex-wrap gap-1.5 pt-1">
              <span
                v-for="tag in customer.tags"
                :key="tag"
                class="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
              >
                {{ tag }}
              </span>
           </div>

        </div>

        <!-- 底部操作栏 -->
        <div
          class="flex items-center justify-between border-t border-[var(--border-color)] bg-[var(--bg-muted)]/30 px-4 py-3"
          @click.stop
        >
          <span class="text-xs text-[var(--text-secondary)]/50">{{
            formatDate(customer.createdAt)
          }}</span>
          <!-- 可以放置更多操作，目前点击卡片看详情，右上角编辑 -->
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="users" :title="t('customer.manage.empty')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';

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
