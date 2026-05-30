<template>
  <div class="border-success/20 bg-(--color-success-bg) rounded-2xl border p-4 shadow-card">
    <div class="flex items-start gap-3">
      <div class="text-success flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--bg-card) shadow-sm">
        <AppIcon name="check-badge" class="size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-semibold text-(--text-main)">创建成功</p>
          <span class="rounded-full bg-(--bg-card) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)">
            {{ moduleLabel }}
          </span>
        </div>
        <p class="mt-2 text-sm leading-6 text-(--text-secondary)">{{ successText }}</p>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl bg-(--bg-card) p-3 shadow-sm">
        <p class="text-[11px] tracking-[0.08em] text-(--text-secondary) uppercase">创建结果</p>
        <p class="mt-1 text-sm font-medium text-(--text-main)">{{ entityLabel }}</p>
      </div>

      <div
        data-testid="result-destination"
        class="border-primary/20 bg-primary/6 rounded-xl border p-3 shadow-sm"
      >
        <p class="text-[11px] tracking-[0.08em] text-(--text-secondary) uppercase">前往查看</p>
        <p class="mt-1 text-sm font-medium text-(--text-main)">{{ moduleLabel }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const MODULE_LABELS = {
  orders: '订单管理',
  purchaseOrders: '采购单管理',
  products: '商品管理',
  customers: '客户管理',
  salespersons: '销售员管理',
};

const successText = computed(() => props.action?.successMessage || '已完成创建，请前往对应模块查看。');
const entityLabel = computed(() => props.action?.createdEntityLabel || props.action?.createdEntityId || '已创建记录');
const moduleLabel = computed(() => MODULE_LABELS[props.action?.targetModule] || '对应模块');
</script>
