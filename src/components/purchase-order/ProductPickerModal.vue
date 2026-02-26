<template>
  <!-- 背景遮罩 -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="visible" class="fixed inset-0 z-60 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    </transition>

    <!-- 弹窗主体 -->
    <transition name="modal-slide">
      <div v-if="visible" class="fixed inset-0 z-[61] flex items-center justify-center p-4 sm:p-6">
        <div class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-(--color-modal-bg) shadow-2xl" style="max-height: calc(100vh - 3rem)">
          <!-- 头部 -->
          <div class="flex items-center justify-between border-b border-(--border-color) px-6 py-4">
            <div>
              <h2 class="text-lg font-bold text-main">{{ t('purchaseOrder.selection.productTitle') }}</h2>
              <p class="mt-0.5 text-sm text-secondary">{{ t('purchaseOrder.selection.productSubtitle') }}</p>
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-lg p-2 text-secondary transition-colors hover:bg-(--bg-hover)"
              @click="$emit('close')"
            >
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>

          <!-- 搜索栏 -->
          <div class="border-b border-(--border-subtle) px-6 py-3">
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
                <AppIcon name="magnifying-glass" class="size-4" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                class="w-full rounded-xl border border-(--border-color) bg-(--bg-page) py-2.5 pr-4 pl-10 text-sm text-main transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                :placeholder="t('purchaseOrder.selection.searchProduct')"
                @input="debouncedSearch"
              />
            </div>
          </div>

          <!-- 列表区域 -->
          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <!-- 加载骨架 -->
            <div v-if="loading" class="space-y-3">
              <div v-for="i in 4" :key="'sk-' + i" class="flex items-center gap-3 rounded-xl border border-(--border-subtle) p-4">
                <div class="skeleton-shimmer size-5 rounded bg-(--bg-muted)"></div>
                <div class="skeleton-shimmer size-10 rounded-lg bg-(--bg-muted)"></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton-shimmer h-4 w-32 rounded bg-(--bg-muted)"></div>
                  <div class="skeleton-shimmer h-3 w-48 rounded bg-(--bg-muted)"></div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else-if="sortedProducts.length === 0" class="flex flex-col items-center justify-center py-12">
              <div class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-muted)">
                <AppIcon name="cube" class="size-8 text-muted" />
              </div>
              <p class="mt-4 text-sm text-secondary">{{ t('common.noData') }}</p>
            </div>

            <!-- 商品列表 -->
            <div v-else class="space-y-2">
              <!-- 推荐标签 (如果有同品牌推荐) -->
              <div v-if="recommendedProducts.length > 0 && !searchQuery" class="mb-3">
                <div class="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                  <AppIcon name="light-bulb" class="size-3.5" />
                  {{ t('purchaseOrder.selection.recommendedBrand') }}
                </div>
              </div>

              <!-- 商品卡片 -->
              <label
                v-for="product in sortedProducts"
                :key="product.id"
                class="group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-200"
                :class="isSelected(product.id)
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-(--border-subtle) hover:border-(--border-color) hover:bg-(--bg-hover)'"
              >
                <input
                  type="checkbox"
                  :checked="isSelected(product.id)"
                  class="size-4 cursor-pointer rounded border-(--border-color) text-primary focus:ring-primary"
                  @change="toggleSelect(product)"
                />

                <!-- 商品图片 -->
                <div class="size-10 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)">
                  <AppImage
                    v-if="getMainImage(product)"
                    :src="getFileUrl(getMainImage(product))"
                    fit="cover"
                    class="size-full"
                  />
                  <div v-else class="flex size-full items-center justify-center text-muted">
                    <AppIcon name="photo" class="size-5" />
                  </div>
                </div>

                <!-- 商品信息 -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-sm font-medium text-main">{{ product.name }}</span>
                    <span class="shrink-0 font-[Outfit] text-xs text-secondary">¥{{ (product.cost_price || product.price || 0).toFixed(2) }}</span>
                  </div>
                  <div class="mt-0.5 flex items-center gap-2 text-xs text-secondary">
                    <span class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono">{{ product.spu }}</span>
                    <span v-if="product.brand">{{ product.brand }}</span>
                    <span v-if="product.category" class="truncate">· {{ product.category }}</span>
                  </div>
                </div>

                <!-- 推荐标记 -->
                <div
                  v-if="isRecommended(product)"
                  class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                >
                  推荐
                </div>
              </label>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="flex items-center justify-between border-t border-(--border-color) bg-(--bg-card) px-6 py-4">
            <span v-if="selected.length > 0" class="text-sm text-secondary">
              {{ t('purchaseOrder.selection.selectedCount', { count: selected.length }) }}
            </span>
            <span v-else></span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-(--bg-hover)"
                @click="$emit('close')"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                :disabled="selected.length === 0"
                class="cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-inverse shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
 * 商品选择弹窗 (ProductPickerModal)
 * ====================================
 *
 * 列出所有商品，支持搜索 + 多选。
 * 同品牌商品优先推荐（基于已选商品的品牌列表）。
 *
 * @module components/purchase-order/ProductPickerModal
 */

import { ref, computed, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  /** 控制弹窗可见性 */
  visible: { type: Boolean, default: false },
  /** 已有商品的品牌列表（用于优先推荐） */
  existingBrands: { type: Array, default: () => [] },
  /** 已选商品 ID 列表（排除重复选择） */
  excludeIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'confirm']);

const { t } = useI18n();
const { products, loading, loadProducts } = useProducts();

// ─── 状态 ────────────────────────────────────────────
const searchQuery = ref('');
const selected = ref([]);

// ─── 搜索防抖 ────────────────────────────────────────
const doSearch = async () => {
  await loadProducts({ search: searchQuery.value, limit: 30, page: 1 });
};
const debouncedSearch = useDebounceFn(doSearch, 300);

// ─── 过滤 + 排序 ────────────────────────────────────
const filteredProducts = computed(() => {
  let list = products.value || [];
  // 排除已选商品
  if (props.excludeIds.length > 0) {
    const excludeSet = new Set(props.excludeIds);
    list = list.filter(p => !excludeSet.has(p.id));
  }
  return list;
});

const recommendedProducts = computed(() => {
  if (props.existingBrands.length === 0) return [];
  const brandSet = new Set(props.existingBrands.map(b => b?.toLowerCase()));
  return filteredProducts.value.filter(p => brandSet.has(p.brand?.toLowerCase()));
});

const isRecommended = (product) => {
  if (props.existingBrands.length === 0) return false;
  const brandSet = new Set(props.existingBrands.map(b => b?.toLowerCase()));
  return brandSet.has(product.brand?.toLowerCase());
};

// 排序逻辑：推荐的同品牌商品置顶
const sortedProducts = computed(() => {
  const list = [...filteredProducts.value];
  if (props.existingBrands.length === 0) return list;

  const brandSet = new Set(props.existingBrands.map(b => b?.toLowerCase()));
  return list.sort((a, b) => {
    const aMatch = brandSet.has(a.brand?.toLowerCase()) ? 0 : 1;
    const bMatch = brandSet.has(b.brand?.toLowerCase()) ? 0 : 1;
    return aMatch - bMatch;
  });
});

// ─── 选择逻辑 ────────────────────────────────────────
const isSelected = (id) => selected.value.some(p => p.id === id);

const toggleSelect = (product) => {
  const idx = selected.value.findIndex(p => p.id === product.id);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(product);
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
    await loadProducts({ limit: 30, page: 1 });
  }
});

// ─── 图片工具 ────────────────────────────────────────
const getFileUrl = (id) => `/file/${id}`;
const getMainImage = (product) => {
  try {
    if (!product.images) return null;
    const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    return Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
  } catch { return null; }
};
</script>

<style scoped>
.modal-slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-slide-leave-active { transition: all 0.2s ease-in; }
.modal-slide-enter-from { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-slide-leave-to { opacity: 0; transform: scale(0.97); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

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
