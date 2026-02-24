<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-primary text-2xl font-bold tracking-tight">{{ t('purchaseOrder.title') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('purchaseOrder.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- 智能建议按钮 -->
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] shadow-sm ring-1 ring-[var(--border-color)] transition-all hover:shadow-md"
          @click="showSuggestions = true"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          {{ t('purchaseOrder.action.viewSuggestions') }}
        </button>
        <!-- 新建按钮 -->
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:opacity-90"
          @click="showCreateModal = true"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          {{ t('purchaseOrder.action.create') }}
        </button>
      </div>
    </div>

    <!-- ===== 统计卡片：骨架屏 or 真实数据 ===== -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <template v-if="loading && !stats">
        <!-- 骨架卡片 ×6 -->
        <div
          v-for="i in 6" :key="'sk-card-' + i"
          class="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg sm:p-5"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-3">
              <div class="skeleton-shimmer h-3.5 w-16 rounded bg-[var(--bg-muted)]" />
              <div class="skeleton-shimmer h-8 w-12 rounded bg-[var(--bg-muted)]" />
            </div>
            <div class="skeleton-shimmer size-9 rounded-xl bg-[var(--bg-muted)] sm:size-10" />
          </div>
        </div>
      </template>

      <template v-else-if="stats">
        <div
          v-for="card in statCards"
          :key="card.key"
          class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
          :class="{ 'ring-2 ring-[var(--color-primary)]/20': filters.status === card.key }"
          @click="filters.status = filters.status === card.key ? '' : card.key"
        >
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <h3 class="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">{{ card.label }}</h3>
              <div class="mt-1.5 font-[Outfit] text-2xl font-bold tracking-tight text-[var(--text-main)] sm:mt-2 sm:text-3xl">
                {{ card.count }}
              </div>
            </div>
            <div
              class="flex size-9 items-center justify-center rounded-xl transition-colors sm:size-10"
              :style="{ backgroundColor: card.iconBg, color: card.iconColor }"
            >
              <!-- 全部 -->
              <svg v-if="card.key === ''" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
              </svg>
              <!-- 草稿 -->
              <svg v-else-if="card.key === 'draft'" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              <!-- 已下单 -->
              <svg v-else-if="card.key === 'ordered'" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
              <!-- 运输中 -->
              <svg v-else-if="card.key === 'shipping'" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path>
              </svg>
              <!-- 已到货 -->
              <svg v-else-if="card.key === 'arrived'" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
              <!-- 已结算 -->
              <svg v-else class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <!-- 光晕背景 -->
          <div
            class="absolute -top-4 -right-4 -z-0 size-24 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
            :style="{ backgroundColor: card.iconBg }"
          ></div>
        </div>
      </template>
    </div>

    <!-- ===== 状态筛选标签 ===== -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        class="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
        :class="filters.status === tab.value
          ? 'bg-[var(--color-primary)] text-[var(--text-inverse)] shadow-sm'
          : 'text-[var(--text-secondary)] bg-[var(--bg-muted)] hover:bg-[var(--bg-hover)]'"
        @click="filters.status = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ===== 采购单列表 ===== -->
    <div class="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <!-- 骨架表格 -->
      <div v-if="loading && list.length === 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
              <th v-for="i in 7" :key="'th-sk-' + i" class="px-4 py-3">
                <div class="skeleton-shimmer h-4 w-16 rounded bg-[var(--border-color)]" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            <tr v-for="r in 5" :key="'tr-sk-' + r">
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-4 w-28 rounded bg-[var(--bg-muted)]" /></td>
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-5 w-16 rounded-full bg-[var(--bg-muted)]" /></td>
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-4 w-8 rounded bg-[var(--bg-muted)]" /></td>
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-4 w-20 rounded bg-[var(--bg-muted)]" /></td>
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-4 w-16 rounded bg-[var(--bg-muted)]" /></td>
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-4 w-20 rounded bg-[var(--bg-muted)]" /></td>
              <td class="px-4 py-3.5 text-right"><div class="skeleton-shimmer ml-auto h-4 w-14 rounded bg-[var(--bg-muted)]" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && list.length === 0" class="py-20 text-center">
        <svg class="mx-auto size-12 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"></path>
        </svg>
        <p class="text-secondary mt-4 text-sm">{{ t('purchaseOrder.empty') }}</p>
      </div>

      <!-- 表格 -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.table.poNo') }}</th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.table.status') }}</th>
              <th class="px-4 py-3 text-center font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.table.itemCount') }}</th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.table.totalGoodsCost') }}</th>
              <th class="hidden px-4 py-3 font-semibold text-[var(--text-secondary)] md:table-cell">{{ t('purchaseOrder.table.estimatedShipping') }}</th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.table.createdAt') }}</th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-subtle)]">
            <tr
              v-for="po in list"
              :key="po.id"
              class="cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
              @click="openDetail(po.id)"
            >
              <td class="px-4 py-3">
                <code class="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]">{{ po.po_no }}</code>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :style="{
                    color: statusConfig[po.status]?.color || 'inherit',
                    backgroundColor: statusConfig[po.status]?.bg || 'var(--bg-muted)',
                  }"
                >
                  {{ statusConfig[po.status]?.label || po.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-center font-medium text-[var(--text-main)]">{{ po.item_count || 0 }}</td>
              <td class="px-4 py-3 font-[Outfit] font-medium text-[var(--text-main)]">¥{{ (po.total_goods_cost || 0).toFixed(2) }}</td>
              <td class="hidden px-4 py-3 text-[var(--text-secondary)] md:table-cell">¥{{ (po.estimated_shipping_cost || 0).toFixed(2) }}</td>
              <td class="px-4 py-3 text-[var(--text-secondary)]">{{ formatDate(po.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--bg-active)]"
                  @click.stop="openDetail(po.id)"
                >
                  {{ t('common.viewDetails') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div v-if="total > filters.limit" class="flex items-center justify-between border-t border-[var(--border-color)] px-4 py-3">
        <p class="text-secondary text-sm">
          {{ t('purchaseOrder.pagination.total', { count: total }) }}
        </p>
        <div class="flex items-center gap-2">
          <button
            :disabled="filters.page <= 1"
            class="cursor-pointer rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            @click="filters.page--; loadList()"
          >
            ← {{ t('purchaseOrder.pagination.prev') }}
          </button>
          <button
            :disabled="filters.page * filters.limit >= total"
            class="cursor-pointer rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            @click="filters.page++; loadList()"
          >
            {{ t('purchaseOrder.pagination.next') }} →
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 详情面板 (侧滑) ==================== -->
    <Teleport to="body">
      <transition name="slide">
        <div v-if="showDetail && detail" class="fixed inset-0 z-50 flex justify-end">
          <!-- 背景遮罩 -->
          <div class="absolute inset-0 bg-[var(--color-overlay-blur)] backdrop-blur-sm" @click="showDetail = false"></div>
          <!-- 面板 -->
          <div class="relative w-full max-w-2xl overflow-y-auto bg-[var(--bg-page)] shadow-2xl">
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
              <div>
                <h2 class="text-lg font-bold text-[var(--text-main)]">{{ detail.po_no }}</h2>
                <span
                  class="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :style="{
                    color: statusConfig[detail.status]?.color || 'inherit',
                    backgroundColor: statusConfig[detail.status]?.bg || 'var(--bg-muted)',
                  }"
                >
                  {{ statusConfig[detail.status]?.label || detail.status }}
                </span>
              </div>
              <button class="cursor-pointer rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" @click="showDetail = false">
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div class="space-y-6 p-6">
              <!-- 状态操作按钮 -->
              <div v-if="nextStatuses.length > 0" class="flex flex-wrap gap-2">
                <button
                  v-for="ns in nextStatuses"
                  :key="ns"
                  class="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                  :class="ns === 'cancelled'
                    ? 'border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]'
                    : 'bg-[var(--color-primary)] text-[var(--text-inverse)] hover:opacity-90'"
                  @click="handleStatusUpdate(ns)"
                >
                  {{ t('purchaseOrder.action.updateStatus') }}: {{ statusConfig[ns]?.label || ns }}
                </button>
              </div>

              <!-- 费用信息 -->
              <div class="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
                <h3 class="mb-3 text-sm font-semibold text-[var(--text-main)]">{{ t('purchaseOrder.detail.costInfo') }}</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs text-[var(--text-secondary)]">{{ t('purchaseOrder.form.estimatedShipping') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-[var(--text-main)]">¥{{ (detail.estimated_shipping_cost || 0).toFixed(2) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-[var(--text-secondary)]">{{ t('purchaseOrder.form.estimatedTariff') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-[var(--text-main)]">¥{{ (detail.estimated_tariff_cost || 0).toFixed(2) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-[var(--text-secondary)]">{{ t('purchaseOrder.table.actualShipping') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-[var(--text-main)]">
                      {{ detail.actual_shipping_cost != null ? `¥${detail.actual_shipping_cost.toFixed(2)}` : '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-[var(--text-secondary)]">{{ t('purchaseOrder.table.actualTariff') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-[var(--text-main)]">
                      {{ detail.actual_tariff_cost != null ? `¥${detail.actual_tariff_cost.toFixed(2)}` : '—' }}
                    </div>
                  </div>
                </div>
                <!-- 分摊方式 -->
                <div class="mt-3 flex items-center gap-2 text-xs">
                  <span class="text-[var(--text-secondary)]">{{ t('purchaseOrder.form.allocationMethod') }}:</span>
                  <span class="font-medium text-[var(--text-main)]">
                    {{ detail.allocation_method === 'by_value' ? t('purchaseOrder.form.byValue') : t('purchaseOrder.form.byQuantity') }}
                  </span>
                </div>
              </div>

              <!-- 明细列表 -->
              <div class="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
                <h3 class="mb-3 text-sm font-semibold text-[var(--text-main)]">{{ t('purchaseOrder.detail.items') }} ({{ detail.items?.length || 0 }})</h3>
                <div v-if="detail.items && detail.items.length > 0" class="space-y-3">
                  <div
                    v-for="item in detail.items"
                    :key="item.id"
                    class="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex size-10 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                        <svg class="size-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                        </svg>
                      </div>
                      <div>
                        <div class="text-sm font-medium text-[var(--text-main)]">{{ item.product_name || '—' }}</div>
                        <div class="text-xs text-[var(--text-secondary)]">
                          {{ item.product_sku || '' }}
                          <span v-if="item.customer_order_no" class="ml-2 text-[var(--color-info)]">→ {{ item.customer_order_no }}</span>
                          <span v-else class="ml-2 text-[var(--color-warning)]">{{ t('purchaseOrder.detail.publicStock') }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="font-[Outfit] text-sm font-medium text-[var(--text-main)]">×{{ item.quantity }} · ¥{{ (item.unit_cost || 0).toFixed(2) }}</div>
                      <div v-if="item.allocated_freight > 0 || item.allocated_tariff > 0" class="text-xs text-[var(--text-secondary)]">
                        {{ t('purchaseOrder.allocation.freight') }} ¥{{ (item.allocated_freight || 0).toFixed(2) }}
                        + {{ t('purchaseOrder.allocation.tariff') }} ¥{{ (item.allocated_tariff || 0).toFixed(2) }}
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else class="py-4 text-center text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.emptyItems') }}</p>
              </div>

              <!-- 备注 -->
              <div v-if="detail.remark" class="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
                <h3 class="mb-2 text-sm font-semibold text-[var(--text-main)]">{{ t('purchaseOrder.form.remark') }}</h3>
                <p class="text-sm text-[var(--text-secondary)]">{{ detail.remark }}</p>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ==================== 新建采购单 Modal ==================== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="showCreateModal = false"></div>
          <div class="relative w-full max-w-lg rounded-2xl bg-[var(--color-modal-bg)] p-6 shadow-xl">
            <h2 class="mb-4 text-lg font-bold text-[var(--text-main)]">{{ t('purchaseOrder.action.create') }}</h2>
            <div class="space-y-4">
              <div>
                <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.remark') }}</label>
                <input
                  v-model="createForm.remark"
                  type="text"
                  class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
                  :placeholder="t('purchaseOrder.form.remarkPlaceholder')"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.estimatedShipping') }}</label>
                  <input v-model.number="createForm.estimated_shipping_cost" type="number" step="0.01" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none" />
                </div>
                <div>
                  <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.estimatedTariff') }}</label>
                  <input v-model.number="createForm.estimated_tariff_cost" type="number" step="0.01" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none" />
                </div>
              </div>
              <div>
                <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.allocationMethod') }}</label>
                <select v-model="createForm.allocation_method" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none">
                  <option value="by_quantity">{{ t('purchaseOrder.form.byQuantity') }}</option>
                  <option value="by_value">{{ t('purchaseOrder.form.byValue') }}</option>
                </select>
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                @click="showCreateModal = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                class="cursor-pointer rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:opacity-90"
                @click="handleCreate"
              >
                {{ t('common.create') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ==================== 智能建议 Modal ==================== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showSuggestions" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="showSuggestions = false"></div>
          <div class="relative w-full max-w-3xl rounded-2xl bg-[var(--color-modal-bg)] p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold text-[var(--text-main)]">{{ t('purchaseOrder.suggestions.title') }}</h2>
                <p class="mt-0.5 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.suggestions.subtitle') }}</p>
              </div>
              <button class="cursor-pointer rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" @click="showSuggestions = false">
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div v-if="suggestionsLoading" class="flex items-center justify-center py-12">
              <div class="size-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"></div>
            </div>
            <div v-else-if="suggestions.length === 0" class="py-12 text-center">
              <svg class="mx-auto size-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
              <p class="mt-3 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.suggestions.empty') }}</p>
            </div>
            <div v-else class="max-h-96 space-y-2 overflow-y-auto">
              <div
                v-for="s in suggestions"
                :key="s.product_id"
                class="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div class="flex items-center gap-3">
                  <input v-model="selectedSuggestions" :value="s" type="checkbox" class="size-4 cursor-pointer rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                  <div>
                    <div class="text-sm font-medium text-[var(--text-main)]">{{ s.product_name }}</div>
                    <div class="text-xs text-[var(--text-secondary)]">{{ s.sku }} · {{ s.brand }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-xs">
                  <span class="font-semibold text-[var(--color-danger)]">{{ t('purchaseOrder.suggestions.shortage') }}: {{ s.shortage }}</span>
                  <span class="text-[var(--text-secondary)]">{{ t('purchaseOrder.suggestions.stock') }}: {{ s.stock_quantity }}</span>
                  <span class="font-[Outfit] text-[var(--text-secondary)]">¥{{ (s.cost_price || 0).toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <div v-if="suggestions.length > 0" class="mt-4 flex justify-end gap-3">
              <button
                class="cursor-pointer rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="selectedSuggestions.length === 0"
                @click="handleCreateFromSuggestions"
              >
                {{ t('purchaseOrder.suggestions.addSelected') }} ({{ selectedSuggestions.length }})
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onActivated, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';

const { t } = useI18n();
const {
  list, total, loading, detail, detailLoading,
  suggestions, suggestionsLoading, stats,
  filters, statusConfig,
  loadList, loadStats, loadDetail,
  createPO, createFromOrders, updateStatus,
  loadSuggestions,
} = usePurchaseOrders();

// ─── 本地状态 ────────────────────────────────────────

const showDetail = ref(false);
const showCreateModal = ref(false);
const showSuggestions = ref(false);
const selectedSuggestions = ref([]);

const createForm = reactive({
  remark: '',
  estimated_shipping_cost: 0,
  estimated_tariff_cost: 0,
  allocation_method: 'by_quantity',
});

// ─── 计算属性 ────────────────────────────────────────

const statCards = computed(() => {
  if (!stats.value) return [];
  return [
    { key: '', label: t('purchaseOrder.filter.all'), count: stats.value.total || 0, iconColor: 'var(--text-secondary)', iconBg: 'var(--bg-muted)' },
    { key: 'draft', label: t('purchaseOrder.status.draft'), count: stats.value.draft_count || 0, iconColor: 'var(--text-secondary)', iconBg: 'var(--bg-muted)' },
    { key: 'ordered', label: t('purchaseOrder.status.ordered'), count: stats.value.ordered_count || 0, iconColor: 'var(--color-warning)', iconBg: 'var(--color-warning-bg)' },
    { key: 'shipping', label: t('purchaseOrder.status.shipping'), count: stats.value.shipping_count || 0, iconColor: 'var(--color-purple)', iconBg: 'var(--color-purple-bg)' },
    { key: 'arrived', label: t('purchaseOrder.status.arrived'), count: stats.value.arrived_count || 0, iconColor: 'var(--color-info)', iconBg: 'var(--color-info-bg)' },
    { key: 'completed', label: t('purchaseOrder.status.completed'), count: stats.value.completed_count || 0, iconColor: 'var(--color-success)', iconBg: 'var(--color-success-bg)' },
  ];
});

const statusTabs = computed(() => [
  { value: '', label: t('purchaseOrder.filter.all') },
  { value: 'draft', label: t('purchaseOrder.status.draft') },
  { value: 'ordered', label: t('purchaseOrder.status.ordered') },
  { value: 'shipping', label: t('purchaseOrder.status.shipping') },
  { value: 'arrived', label: t('purchaseOrder.status.arrived') },
  { value: 'completed', label: t('purchaseOrder.status.completed') },
]);

// 当前采购单可跳转的下一个状态
const nextStatuses = computed(() => {
  if (!detail.value) return [];
  const map = {
    draft: ['ordered', 'cancelled'],
    ordered: ['shipping', 'cancelled'],
    shipping: ['arrived'],
    arrived: ['completed'],
  };
  return map[detail.value.status] || [];
});

// ─── 方法 ────────────────────────────────────────────

const formatDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
};

const openDetail = async (id) => {
  showDetail.value = true;
  await loadDetail(id);
};

const handleCreate = async () => {
  const result = await createPO({ ...createForm });
  if (result) {
    showCreateModal.value = false;
    createForm.remark = '';
    createForm.estimated_shipping_cost = 0;
    createForm.estimated_tariff_cost = 0;
    createForm.allocation_method = 'by_quantity';
    loadList();
    loadStats();
  }
};

const handleStatusUpdate = async (newStatus) => {
  if (!detail.value) return;
  const success = await updateStatus(detail.value.id, newStatus);
  if (success) {
    await loadDetail(detail.value.id);
    loadList();
    loadStats();
  }
};

const handleCreateFromSuggestions = async () => {
  // 将建议中的客户订单汇总
  const allOrderIds = selectedSuggestions.value.flatMap(s => s.order_ids || []);
  if (allOrderIds.length === 0) return;

  const result = await createFromOrders(allOrderIds, {
    allocation_method: 'by_quantity',
  });
  if (result) {
    showSuggestions.value = false;
    selectedSuggestions.value = [];
    loadList();
    loadStats();
  }
};

// ─── 生命周期 ────────────────────────────────────────

// 使用 onActivated 代替 onMounted，确保在 keep-alive 环境下
// 每次导航进入该页面时都会重新拉取最新数据
onActivated(async () => {
  await Promise.all([loadList(), loadStats()]);
});

// 筛选变化时自动重新加载列表
watch(() => filters.status, () => {
  filters.page = 1;
  loadList();
});

// 打开建议弹窗时自动加载
watch(showSuggestions, (v) => {
  if (v) loadSuggestions();
});
</script>

<style scoped>
/* 骨架屏 shimmer 动画 */
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

/* 侧滑动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
