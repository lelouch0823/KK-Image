<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-primary text-2xl font-bold tracking-tight">{{ t('sidebar.goodsOverview') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('goodsOverview.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] shadow-sm ring-1 ring-[var(--border-color)] transition-all hover:shadow-md"
        @click="exportCSV"
      >
        <AppIcon name="document-arrow-down" class="size-4" />
        {{ t('goodsOverview.export') }}
      </button>
    </div>

    <!-- ===== 管道概览卡片：骨架屏 or 真实数据 ===== -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <template v-if="loading && !summary">
        <!-- 骨架卡片 x4 -->
        <div
          v-for="i in 4" :key="'sk-card-' + i"
          class="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg sm:p-5"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-3">
              <div class="skeleton-shimmer h-3.5 w-16 rounded bg-[var(--bg-muted)]" />
              <div class="skeleton-shimmer h-8 w-12 rounded bg-[var(--bg-muted)]" />
            </div>
            <div class="skeleton-shimmer size-9 rounded-xl bg-[var(--bg-muted)] sm:size-10" />
          </div>
          <div class="mt-3 flex items-center gap-2">
            <div class="skeleton-shimmer h-3 w-20 rounded bg-[var(--bg-muted)]" />
            <div class="skeleton-shimmer h-3 w-12 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
      </template>

      <template v-else-if="summary">
        <!-- 待订货 -->
        <div class="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-5">
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <h3 class="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">{{ t('goodsOverview.pipeline.confirmed') }}</h3>
              <div class="mt-1.5 font-[Outfit] text-2xl font-bold tracking-tight text-[var(--text-main)] sm:mt-2 sm:text-3xl">
                {{ summary.byStatus.confirmed.products }}
              </div>
            </div>
            <div class="flex size-9 items-center justify-center rounded-xl bg-[var(--color-warning-bg)] text-[var(--color-warning)] transition-colors group-hover:bg-[var(--color-warning)] group-hover:text-white sm:size-10">
              <AppIcon name="clipboard-document-check" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
            </div>
          </div>
          <div class="relative z-10 mt-2 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.confirmed.count }) }}</span>
            <span class="text-[var(--text-muted)]">·</span>
            <span>{{ summary.byStatus.confirmed.qty }} {{ t('goodsOverview.unit') }}</span>
          </div>
          <div class="absolute -top-4 -right-4 -z-0 size-24 rounded-full bg-[var(--color-warning-bg)] opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>

        <!-- 生产中 -->
        <div class="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-5">
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <h3 class="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">{{ t('goodsOverview.pipeline.production') }}</h3>
              <div class="mt-1.5 font-[Outfit] text-2xl font-bold tracking-tight text-[var(--text-main)] sm:mt-2 sm:text-3xl">
                {{ summary.byStatus.production.products }}
              </div>
            </div>
            <div class="flex size-9 items-center justify-center rounded-xl bg-[var(--color-info-bg)] text-[var(--color-info)] transition-colors group-hover:bg-[var(--color-info)] group-hover:text-white sm:size-10">
              <AppIcon name="beaker" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
            </div>
          </div>
          <div class="relative z-10 mt-2 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.production.count }) }}</span>
            <span class="text-[var(--text-muted)]">·</span>
            <span>{{ summary.byStatus.production.qty }} {{ t('goodsOverview.unit') }}</span>
          </div>
          <div class="absolute -top-4 -right-4 -z-0 size-24 rounded-full bg-[var(--color-info-bg)] opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>

        <!-- 运输中 -->
        <div class="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-5">
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <h3 class="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">{{ t('goodsOverview.pipeline.shipping') }}</h3>
              <div class="mt-1.5 font-[Outfit] text-2xl font-bold tracking-tight text-[var(--text-main)] sm:mt-2 sm:text-3xl">
                {{ summary.byStatus.shipping.products }}
              </div>
            </div>
            <div class="flex size-9 items-center justify-center rounded-xl bg-[var(--color-purple-bg)] text-[var(--color-purple)] transition-colors group-hover:bg-[var(--color-purple)] group-hover:text-white sm:size-10">
              <AppIcon name="building-storefront" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
            </div>
          </div>
          <div class="relative z-10 mt-2 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.shipping.count }) }}</span>
            <span class="text-[var(--text-muted)]">·</span>
            <span>{{ summary.byStatus.shipping.qty }} {{ t('goodsOverview.unit') }}</span>
          </div>
          <div class="absolute -top-4 -right-4 -z-0 size-24 rounded-full bg-[var(--color-purple-bg)] opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>

        <!-- 已到货 -->
        <div class="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-5">
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <h3 class="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">{{ t('goodsOverview.pipeline.arrived') }}</h3>
              <div class="mt-1.5 font-[Outfit] text-2xl font-bold tracking-tight text-[var(--text-main)] sm:mt-2 sm:text-3xl">
                {{ summary.byStatus.arrived.products }}
              </div>
            </div>
            <div class="flex size-9 items-center justify-center rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success)] transition-colors group-hover:bg-[var(--color-success)] group-hover:text-white sm:size-10">
              <AppIcon name="check" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
            </div>
          </div>
          <div class="relative z-10 mt-2 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span>{{ t('goodsOverview.orderCount', { count: summary.byStatus.arrived.count }) }}</span>
            <span class="text-[var(--text-muted)]">·</span>
            <span>{{ summary.byStatus.arrived.qty }} {{ t('goodsOverview.unit') }}</span>
          </div>
          <div class="absolute -top-4 -right-4 -z-0 size-24 rounded-full bg-[var(--color-success-bg)] opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100"></div>
        </div>
      </template>
    </div>

    <!-- ===== 总需求 + 缺货摘要：骨架屏 or 真实数据 ===== -->
    <div v-if="loading && !summary" class="flex flex-wrap gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-3">
      <div class="skeleton-shimmer h-5 w-28 rounded bg-[var(--bg-muted)]" />
      <div class="h-5 w-px bg-[var(--border-color)]"></div>
      <div class="skeleton-shimmer h-5 w-24 rounded bg-[var(--bg-muted)]" />
      <div class="h-5 w-px bg-[var(--border-color)]"></div>
      <div class="skeleton-shimmer h-5 w-24 rounded bg-[var(--bg-muted)]" />
    </div>
    <div v-else-if="summary" class="flex flex-wrap gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-3">
      <div class="flex items-center gap-2">
        <span class="text-secondary text-sm">{{ t('goodsOverview.summary.totalProducts') }}:</span>
        <span class="text-primary font-semibold">{{ summary.totalProducts }}</span>
      </div>
      <div class="h-5 w-px bg-[var(--border-color)]"></div>
      <div class="flex items-center gap-2">
        <span class="text-secondary text-sm">{{ t('goodsOverview.summary.totalDemand') }}:</span>
        <span class="text-primary font-semibold">{{ summary.totalDemand }}</span>
      </div>
      <div class="h-5 w-px bg-[var(--border-color)]"></div>
      <div class="flex items-center gap-2">
        <span class="text-secondary text-sm">{{ t('goodsOverview.summary.shortageCount') }}:</span>
        <span class="font-semibold text-[var(--color-danger)]">{{ summary.shortageCount }}</span>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="flex flex-wrap items-center gap-3">
      <select
        v-model="filters.brand"
        class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
      >
        <option value="">{{ t('goodsOverview.filter.allBrands') }}</option>
        <option v-for="b in availableFilters.brands" :key="b" :value="b">{{ b }}</option>
      </select>

      <select
        v-model="filters.category"
        class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
      >
        <option value="">{{ t('goodsOverview.filter.allCategories') }}</option>
        <option v-for="c in availableFilters.categories" :key="c" :value="c">{{ c }}</option>
      </select>

      <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
        <input
          v-model="filters.shortageOnly"
          type="checkbox"
          class="size-4 rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
        />
        {{ t('goodsOverview.filter.shortageOnly') }}
      </label>

      <select
        v-model="filters.sort"
        class="ml-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
      >
        <option value="shortage">{{ t('goodsOverview.sort.shortage') }}</option>
        <option value="demand">{{ t('goodsOverview.sort.demand') }}</option>
        <option value="name">{{ t('goodsOverview.sort.name') }}</option>
        <option value="cost">{{ t('goodsOverview.sort.cost') }}</option>
      </select>
    </div>

    <!-- ===== 数据表格：骨架屏 or 真实数据 ===== -->
    <div class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <!-- 骨架表格 -->
      <div v-if="loading && items.length === 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
              <th v-for="i in 11" :key="'th-sk-' + i" class="px-4 py-3">
                <div class="skeleton-shimmer h-4 w-16 rounded bg-[var(--border-color)]" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            <tr v-for="r in 6" :key="'tr-sk-' + r">
              <td class="px-4 py-3.5">
                <div class="skeleton-shimmer h-4 w-28 rounded bg-[var(--bg-muted)]" />
              </td>
              <td class="px-4 py-3.5">
                <div class="skeleton-shimmer h-4 w-16 rounded bg-[var(--bg-muted)]" />
              </td>
              <td class="hidden px-4 py-3.5 md:table-cell">
                <div class="skeleton-shimmer h-4 w-14 rounded bg-[var(--bg-muted)]" />
              </td>
              <td v-for="c in 7" :key="'td-sk-' + r + '-' + c" class="px-4 py-3.5 text-center">
                <div class="skeleton-shimmer mx-auto h-4 w-8 rounded bg-[var(--bg-muted)]" />
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="skeleton-shimmer mx-auto h-5 w-12 rounded-full bg-[var(--bg-muted)]" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && items.length === 0" class="py-20 text-center">
        <AppIcon name="cube" class="mx-auto size-12 text-[var(--text-muted)]" />
        <p class="text-secondary mt-4 text-sm">{{ t('goodsOverview.empty') }}</p>
      </div>

      <!-- 表格 -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
              <th class="w-10 px-3 py-3">
                <input type="checkbox" :checked="isAllSelected" class="size-4 cursor-pointer rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" @change="toggleSelectAll" />
              </th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('goodsOverview.table.name') }}</th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('goodsOverview.table.sku') }}</th>
              <th class="hidden px-4 py-3 font-semibold text-[var(--text-secondary)] md:table-cell">{{ t('goodsOverview.table.brand') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--text-secondary)]">{{ t('goodsOverview.table.stock') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--color-warning)]">{{ t('goodsOverview.pipeline.confirmed') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--color-info)]">{{ t('goodsOverview.pipeline.production') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--color-purple)]">{{ t('goodsOverview.pipeline.shipping') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--color-success)]">{{ t('goodsOverview.pipeline.arrived') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--text-secondary)]">{{ t('goodsOverview.table.totalDemand') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--text-secondary)]">{{ t('goodsOverview.table.shortage') }}</th>
              <th class="hidden px-4 py-3 text-center font-semibold text-[var(--text-secondary)] lg:table-cell">{{ t('goodsOverview.table.unitCost') }}</th>
              <th class="hidden px-4 py-3 text-center font-semibold text-[var(--text-secondary)] lg:table-cell">{{ t('goodsOverview.table.freight') }}</th>
              <th class="hidden px-4 py-3 text-center font-semibold text-[var(--text-secondary)] lg:table-cell">{{ t('goodsOverview.table.landedCost') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--text-secondary)]">{{ t('goodsOverview.table.status') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            <tr
              v-for="item in items"
              :key="item.id"
              class="cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
              :class="{ 'bg-[var(--color-primary)]/5': isSelected(item) }"
            >
              <!-- 复选框 -->
              <td class="px-3 py-3">
                <input type="checkbox" :checked="isSelected(item)" class="size-4 cursor-pointer rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" @change="toggleSelect(item)" />
              </td>
              <!-- 商品名称 / 变体 -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div class="size-8 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
                    <AppImage v-if="item.images?.[0]" :src="'/file/' + item.images[0]" class="size-full" />
                    <div v-else class="flex size-full items-center justify-center text-[var(--text-muted)]">
                      <AppIcon name="photo" class="size-4" />
                    </div>
                  </div>
                  <div>
                    <div class="text-primary max-w-[150px] truncate font-medium" :title="item.name">{{ item.name }}</div>
                    <div v-if="item.variantLabel" class="max-w-[180px] truncate text-xs text-[var(--text-secondary)]" :title="item.variantLabel">
                      {{ item.variantLabel }}
                    </div>
                  </div>
                </div>
              </td>
              <!-- SKU -->
              <td class="px-4 py-3">
                <code class="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">{{ item.sku }}</code>
              </td>
              <!-- 品牌 -->
              <td class="hidden px-4 py-3 text-[var(--text-secondary)] md:table-cell">{{ item.brand || '-' }}</td>
              <!-- 库存 -->
              <td class="px-4 py-3 text-center font-medium text-[var(--text-main)]">{{ item.stockQuantity }}</td>
              <!-- 待订货 -->
              <td class="px-4 py-3 text-center">
                <span v-if="item.confirmedQty > 0" class="font-medium text-[var(--color-warning)]">{{ item.confirmedQty }}</span>
                <span v-else class="text-[var(--text-muted)]">-</span>
              </td>
              <!-- 生产中 -->
              <td class="px-4 py-3 text-center">
                <span v-if="item.productionQty > 0" class="font-medium text-[var(--color-info)]">{{ item.productionQty }}</span>
                <span v-else class="text-[var(--text-muted)]">-</span>
              </td>
              <!-- 运输中 -->
              <td class="px-4 py-3 text-center">
                <span v-if="item.shippingQty > 0" class="font-medium text-[var(--color-purple)]">{{ item.shippingQty }}</span>
                <span v-else class="text-[var(--text-muted)]">-</span>
              </td>
              <!-- 已到货 -->
              <td class="px-4 py-3 text-center">
                <span v-if="item.arrivedQty > 0" class="font-medium text-[var(--color-success)]">{{ item.arrivedQty }}</span>
                <span v-else class="text-[var(--text-muted)]">-</span>
              </td>
              <!-- 总需求 -->
              <td class="px-4 py-3 text-center font-semibold text-[var(--text-main)]">{{ item.totalDemand }}</td>
              <!-- 缺口 -->
              <td class="px-4 py-3 text-center">
                <span
                  :class="[
                    'font-bold',
                    item.shortage > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]',
                  ]"
                >
                  {{ item.shortage > 0 ? '+' + item.shortage : item.shortage }}
                </span>
              </td>
              <!-- 入货成本 -->
              <td class="hidden px-4 py-3 text-center font-[Outfit] text-[var(--text-secondary)] lg:table-cell">
                {{ item.avgUnitCost > 0 ? '¥' + item.avgUnitCost.toFixed(2) : '—' }}
              </td>
              <!-- 运费分摊 -->
              <td class="hidden px-4 py-3 text-center font-[Outfit] text-[var(--text-secondary)] lg:table-cell">
                {{ item.avgFreight > 0 ? '¥' + item.avgFreight.toFixed(2) : '—' }}
              </td>
              <!-- 到岸成本 -->
              <td class="hidden px-4 py-3 text-center lg:table-cell">
                <span v-if="item.landedCost > 0" class="font-[Outfit] font-semibold text-[var(--text-main)]">¥{{ item.landedCost.toFixed(2) }}</span>
                <span v-else class="text-[var(--text-muted)]">—</span>
              </td>
              <!-- 状态标签 -->
              <td class="px-4 py-3 text-center">
                <span
                  v-if="item.shortage > 0"
                  class="inline-flex items-center rounded-full bg-[var(--color-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]"
                >
                  {{ t('goodsOverview.status.shortage') }}
                </span>
                <span
                  v-else-if="item.stockQuantity < item.alertThreshold"
                  class="inline-flex items-center rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-warning)]"
                >
                  {{ t('goodsOverview.status.warning') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]"
                >
                  {{ t('goodsOverview.status.sufficient') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== 浮动操作栏 ===== -->
    <transition name="action-bar-slide-up">
      <div
        v-if="selectedItems.length > 0"
        class="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-3 shadow-2xl backdrop-blur-xl"
      >
        <span class="text-sm font-medium text-[var(--text-main)]">
          {{ t('goodsOverview.batch.selected', { count: selectedItems.length }) }}
        </span>
        <button
          class="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isCreatingPO"
          @click="handleCreatePO"
        >
          <AppIcon v-if="isCreatingPO" name="spinner" class="size-4 animate-spin text-white" />
          {{ t('goodsOverview.batch.createPO') }}
        </button>
        <button
          class="cursor-pointer rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          :disabled="isCreatingPO"
          @click="clearSelection"
        >
          {{ t('goodsOverview.batch.deselectAll') }}
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useGoodsOverview } from '@/composables/useGoodsOverview';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';


const { t } = useI18n();
const { addToast } = useToast();
const router = useRouter();
const {
  items, summary, loading, filters, availableFilters,
  selectedItems, isAllSelected, toggleSelect, toggleSelectAll, isSelected, clearSelection,
  exportCSV, createPOFromSelected, isCreatingPO, init,
} = useGoodsOverview();

const handleCreatePO = async () => {
  if (isCreatingPO.value) return;
  const result = await createPOFromSelected();
  if (result.success) {
    addToast({ type: 'success', message: t('goodsOverview.toast.poCreated') });
    router.push({ path: '/purchase-orders', query: { id: result.data.id } });
  } else {
    addToast({ type: 'error', message: result.error || '生成采购单失败' });
  }
};

// 使用 onActivated 代替 onMounted，确保在 keep-alive 环境下
// 每次导航进入该页面时都会重新拉取最新数据
onActivated(() => {
  init();
});
</script>

<style scoped>
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
  animation: shimmer 1.8s infinite;
}
[data-theme='light'] .skeleton-shimmer::after {
  background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.04) 50%, transparent 100%);
}
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none;
    display: none;
  }
}

/* 浮动操作栏入场动画 */
.action-bar-slide-up-enter-active,
.action-bar-slide-up-leave-active {
  transition: all 0.3s ease;
}
.action-bar-slide-up-enter-from,
.action-bar-slide-up-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}
</style>
