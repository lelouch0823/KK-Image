<template>
  <!-- 背景遮罩 -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="visible" class="fixed inset-0 z-[60] bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="$emit('close')"></div>
    </transition>

    <!-- 弹窗主体 -->
    <transition name="modal-slide">
      <div v-if="visible" class="fixed inset-0 z-[61] flex items-center justify-center p-4 sm:p-6">
        <div class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--color-modal-bg)] shadow-2xl" style="max-height: calc(100vh - 3rem)">
          <!-- 头部 -->
          <div class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
            <div>
              <h2 class="text-lg font-bold text-[var(--text-main)]">{{ t('purchaseOrder.selection.orderTitle') }}</h2>
              <p class="mt-0.5 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.selection.orderSubtitle') }}</p>
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              @click="$emit('close')"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- 搜索栏 -->
          <div class="border-b border-[var(--border-subtle)] px-6 py-3">
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input
                v-model="searchQuery"
                type="text"
                class="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] py-2.5 pr-4 pl-10 text-sm text-[var(--text-main)] transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                :placeholder="t('purchaseOrder.selection.searchOrder')"
              />
            </div>
          </div>

          <!-- 列表区域 -->
          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <!-- 加载骨架 -->
            <div v-if="loading" class="space-y-3">
              <div v-for="i in 4" :key="'sk-' + i" class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-4">
                <div class="skeleton-shimmer size-5 rounded bg-[var(--bg-muted)]"></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton-shimmer h-4 w-32 rounded bg-[var(--bg-muted)]"></div>
                  <div class="skeleton-shimmer h-3 w-48 rounded bg-[var(--bg-muted)]"></div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center py-12">
              <div class="flex size-16 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
                <svg class="size-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <p class="mt-4 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.selection.emptyOrders') }}</p>
            </div>

            <!-- 订单列表 -->
            <div v-else class="space-y-2">
              <!-- 全选 -->
              <label
                class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  :indeterminate="isPartiallySelected"
                  class="size-4 cursor-pointer rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  @change="toggleSelectAll"
                />
                {{ isAllSelected ? t('purchaseOrder.selection.deselectAll') : t('purchaseOrder.selection.selectAll') }}
                <span class="ml-auto font-[Outfit] text-xs">{{ filteredOrders.length }}</span>
              </label>

              <!-- 订单卡片 -->
              <label
                v-for="order in filteredOrders"
                :key="order.id"
                class="group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-200"
                :class="isSelected(order.id)
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-color)] hover:bg-[var(--bg-hover)]'"
              >
                <input
                  type="checkbox"
                  :checked="isSelected(order.id)"
                  class="mt-0.5 size-4 cursor-pointer rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  @change="toggleSelect(order)"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <code class="truncate rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]">{{ order.orderNo }}</code>
                    <span class="shrink-0 font-[Outfit] text-sm font-medium text-[var(--text-main)]">×{{ order.quantity || 1 }}</span>
                  </div>
                  <div class="mt-1.5 truncate text-sm font-medium text-[var(--text-main)]">{{ order.productName || '—' }}</div>
                  <div class="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span v-if="order.customer?.name" class="flex items-center gap-1">
                      <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                      {{ order.customer.name }}
                    </span>
                    <span v-if="order.brand" class="rounded bg-[var(--bg-muted)] px-1.5 py-0.5">{{ order.brand }}</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="flex items-center justify-between border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
            <span v-if="selected.length > 0" class="text-sm text-[var(--text-secondary)]">
              {{ t('purchaseOrder.selection.selectedCount', { count: selected.length }) }}
            </span>
            <span v-else></span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                @click="$emit('close')"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                :disabled="selected.length === 0"
                class="cursor-pointer rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                @click="confirm"
              >
                {{ t('common.confirm') }} ({{ selected.length }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
/**
 * 预定单选择弹窗 (OrderPickerModal)
 * ====================================
 *
 * 列出所有 confirmed 状态的客户订单，支持搜索 + 多选。
 * 选中后 emit('confirm', orders) 返回完整的订单对象数组。
 *
 * @module components/purchase-order/OrderPickerModal
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';

const props = defineProps({
  /** 控制弹窗可见性 */
  visible: { type: Boolean, default: false },
  /** 已经被选中的订单 ID (排除重复选择) */
  excludeIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'confirm']);

const { t } = useI18n();
const { loadOrders, orders, loading } = useOrders();

// ─── 状态 ────────────────────────────────────────────
const searchQuery = ref('');
const selected = ref([]);

// ─── 前端过滤 ────────────────────────────────────────
const filteredOrders = computed(() => {
  let list = orders.value || [];

  // 排除已在采购单中的订单
  if (props.excludeIds.length > 0) {
    const excludeSet = new Set(props.excludeIds);
    list = list.filter(o => !excludeSet.has(o.id));
  }

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(o =>
      (o.orderNo || '').toLowerCase().includes(q) ||
      (o.productName || '').toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q)
    );
  }

  return list;
});

// ─── 全选逻辑 ────────────────────────────────────────
const isAllSelected = computed(() =>
  filteredOrders.value.length > 0 && selected.value.length === filteredOrders.value.length
);
const isPartiallySelected = computed(() =>
  selected.value.length > 0 && selected.value.length < filteredOrders.value.length
);

const isSelected = (id) => selected.value.some(o => o.id === id);

const toggleSelect = (order) => {
  const idx = selected.value.findIndex(o => o.id === order.id);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(order);
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selected.value = [];
  } else {
    selected.value = [...filteredOrders.value];
  }
};

// ─── 确认操作 ────────────────────────────────────────
const confirm = () => {
  emit('confirm', [...selected.value]);
  emit('close');
};

// ─── 弹窗打开时加载数据 ─────────────────────────────
watch(() => props.visible, async (val) => {
  if (val) {
    selected.value = [];
    searchQuery.value = '';
    await loadOrders({ status: 'confirmed', limit: 100 });
  }
});
</script>

<style scoped>
/* 弹窗进入动画 */
.modal-slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-slide-leave-active { transition: all 0.2s ease-in; }
.modal-slide-enter-from { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-slide-leave-to { opacity: 0; transform: scale(0.97); }

/* 背景淡入 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 骨架屏闪烁 */
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  animation: shimmer 1.8s infinite;
}
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
</style>
