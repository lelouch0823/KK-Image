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
          <AppIcon name="light-bulb" class="size-4" />
          {{ t('purchaseOrder.action.viewSuggestions') }}
        </button>
        <!-- 新建按钮 -->
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:opacity-90"
          @click="showCreateModal = true"
        >
          <AppIcon name="plus" class="size-4" />
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
              <AppIcon v-if="card.key === ''" name="bars-4" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
              <!-- 草稿 -->
              <AppIcon v-else-if="card.key === 'draft'" name="pencil-square" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
              <!-- 已下单 -->
              <AppIcon v-else-if="card.key === 'ordered'" name="clipboard-document-check" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
              <!-- 运输中 -->
              <AppIcon v-else-if="card.key === 'shipping'" name="truck" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
              <!-- 已到货 -->
              <AppIcon v-else-if="card.key === 'arrived'" name="cube" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
              <!-- 已结算 -->
              <AppIcon v-else-if="card.key === 'settled'" name="check-badge" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
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
              <th v-for="i in 5" :key="'th-sk-' + i" class="px-4 py-3">
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
              <td class="px-4 py-3.5"><div class="skeleton-shimmer h-4 w-20 rounded bg-[var(--bg-muted)]" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && list.length === 0" class="py-20 text-center">
        <AppIcon name="shopping-cart" class="mx-auto size-12 text-[var(--text-muted)]" />
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
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.form.remark') }}</th>
              <th class="px-4 py-3 font-semibold text-[var(--text-secondary)]">{{ t('purchaseOrder.table.createdAt') }}</th>
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
              <td class="px-4 py-3 text-[var(--text-secondary)] max-w-[150px] truncate" :title="po.remark">{{ po.remark || '-' }}</td>
              <td class="px-4 py-3 text-[var(--text-secondary)]">{{ formatDate(po.created_at) }}</td>
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

    <!-- ==================== 详情面板 (弹窗) ==================== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showDetail && detail" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- 背景遮罩 -->
          <div class="absolute inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="showDetail = false"></div>
          <!-- 面板 -->
          <div class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--color-modal-bg)] shadow-xl" style="max-height: calc(100vh - 3rem)">
            <div class="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
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
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <div class="flex h-full min-h-0 flex-col">
              <div class="flex-1 space-y-6 overflow-y-auto p-6">
                <!-- 状态可视化 (Stepper) -->
                <div class="mb-4">
                  <div class="relative flex items-center justify-between">
                    <div class="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-[var(--border-color)]"></div>
                    <div 
                      class="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-[var(--color-primary)] transition-all duration-500"
                      :style="{ width: getStepperProgress(detail.status) }"
                    ></div>
                    
                    <div v-for="step in stepsList" :key="step.value" class="relative z-10 flex flex-col items-center gap-2">
                      <div 
                        class="flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-300"
                        :class="getStepIconClasses(detail.status, step.value)"
                      >
                        <AppIcon v-if="isStepCompleted(detail.status, step.value)" name="check" class="size-3.5 text-[var(--text-inverse)]" stroke-width="3" />
                        <div v-else-if="detail.status === step.value" class="size-2 rounded-full bg-[var(--color-primary)]"></div>
                      </div>
                      <span class="text-xs font-medium" :class="detail.status === step.value ? 'text-[var(--text-main)]' : isStepCompleted(detail.status, step.value) ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'">
                        {{ step.label }}
                      </span>
                    </div>
                  </div>
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
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-sm font-semibold text-[var(--text-main)]">{{ t('purchaseOrder.detail.items') }} ({{ detail.items?.length || 0 }})</h3>
                  <div v-if="detail.status === 'draft'" class="flex items-center gap-2">
                    <button type="button" class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/10" @click="openOrderPicker('detail')">
                      <AppIcon name="plus" class="size-3.5" />
                      {{ t('purchaseOrder.action.linkOrders') }}
                    </button>
                    <button type="button" class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]" @click="openProductPicker('detail')">
                      <AppIcon name="plus" class="size-3.5" />
                      {{ t('purchaseOrder.action.addProduct') }}
                    </button>
                  </div>
                </div>
                <div v-if="detail.items && detail.items.length > 0" class="space-y-3">
                  <div
                    v-for="item in detail.items"
                    :key="item.id"
                    class="group flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--bg-hover)] sm:flex-row sm:items-center"
                  >
                    <div class="flex items-center gap-3">
                      <!-- 商品主图 -->
                      <div class="size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] shadow-sm">
                        <AppImage v-if="item.product_images?.[0]" :src="getFileUrl(item.product_images[0])" :alt="item.product_name" class="size-full object-cover" />
                        <div v-else class="flex size-full items-center justify-center">
                          <AppIcon name="photo" class="size-6 text-[var(--text-muted)]" />
                        </div>
                      </div>
                      
                      <!-- 商品信息 -->
                      <div class="flex flex-col gap-1">
                        <div class="flex cursor-pointer items-center gap-2 transition-colors hover:text-[var(--color-primary)]" @click="handleViewProductDetail(item.product_id)">
                          <span class="line-clamp-1 text-sm font-medium text-[var(--text-main)]" :title="item.product_name">{{ item.product_name || '—' }}</span>
                          <span v-if="item.product_brand" class="shrink-0 rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{{ item.product_brand }}</span>
                          <span v-if="detail.status === 'draft'" class="flex shrink-0 cursor-pointer items-center gap-0.5 text-xs text-[var(--color-danger)] opacity-0 transition-opacity group-hover:opacity-100" @click="handleDetailRemoveItem(item.id)">
                            <AppIcon name="trash" class="size-3" />
                            {{ t('common.delete') }}
                          </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <code class="rounded bg-[var(--bg-muted)] px-1 py-0.5 font-mono text-[10px]">{{ item.product_sku || '-' }}</code>
                          <span class="text-[var(--text-muted)]">·</span>
                          <span v-if="item.customer_order_no" class="inline-flex items-center gap-1 rounded bg-[var(--color-info)]/10 px-1 py-0.5 text-[10px] font-medium text-[var(--color-info)]">
                            <AppIcon name="shopping-bag" class="size-3" />
                            {{ item.customer_order_no }}
                          </span>
                          <span v-else class="inline-flex items-center gap-1 rounded bg-[var(--color-warning)]/10 px-1 py-0.5 text-[10px] font-medium text-[var(--color-warning)]">
                            <AppIcon name="building-storefront" class="size-3" />
                            {{ t('purchaseOrder.detail.publicStock') }}
                          </span>
                        </div>
                        <!-- Specs -->
                        <div v-if="item.product_specifications && Object.keys(item.product_specifications).length > 0" class="mt-0.5 flex flex-wrap gap-1">
                          <span v-for="(val, key) in item.product_specifications" :key="key" class="rounded border border-[var(--border-subtle)] bg-[var(--bg-page)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                            {{ key }}: {{ val }}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div v-if="detail.status === 'draft'" class="flex items-center justify-end gap-3 pl-12 sm:pl-0">
                      <div class="flex flex-col items-center">
                        <span class="mb-1 text-[10px] text-[var(--text-secondary)]">{{ t('purchaseOrder.table.quantity') }}</span>
                        <input type="number" min="1" v-model.number="item.quantity" @change="handleDetailUpdateItem(item.id, 'quantity', item.quantity)" class="w-16 rounded-md border border-[var(--border-color)] bg-[var(--bg-page)] px-2 py-1 text-center font-[Outfit] text-sm text-[var(--text-main)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                      </div>
                      <div class="flex flex-col items-center">
                        <span class="mb-1 text-[10px] text-[var(--text-secondary)]">{{ t('purchaseOrder.table.unitCost') }}</span>
                        <div class="relative">
                          <span class="absolute left-2 top-1.5 text-xs text-[var(--text-secondary)]">¥</span>
                          <input type="number" step="0.01" min="0" v-model.number="item.unit_cost" @change="handleDetailUpdateItem(item.id, 'unit_cost', item.unit_cost)" class="w-20 rounded-md border border-[var(--border-color)] bg-[var(--bg-page)] py-1 pl-5 pr-2 text-right font-[Outfit] text-sm text-[var(--text-main)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-right">
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
            
            <!-- Footer Fixed Action Bar -->
            <div class="flex items-center justify-between border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
              <div class="flex items-center gap-3">
                <!-- 左侧：次要/辅助操作 -->
                <button
                  v-if="nextStatuses.includes('cancelled')"
                  class="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10"
                  @click="handleStatusUpdate('cancelled')"
                >
                  {{ t('purchaseOrder.action.cancelOrder') }}
                </button>
              </div>
              
              <div class="flex items-center gap-3">
                <!-- 右侧：主要操作 -->
                <button
                  v-for="ns in nextStatuses.filter(s => s !== 'cancelled')"
                  :key="ns"
                  class="cursor-pointer rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:bg-[var(--color-primary)]/90 hover:shadow"
                  @click="handleStatusUpdate(ns)"
                >
                  {{ t('purchaseOrder.action.updateTo') }}: {{ statusConfig[ns]?.label || ns }}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ==================== 新建采购单 Modal (增强版) ==================== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="showCreateModal = false"></div>
          <div class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[var(--color-modal-bg)] shadow-xl" style="max-height: calc(100vh - 3rem)">
            <!-- 头部 -->
            <div class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
              <h2 class="text-lg font-bold text-[var(--text-main)]">{{ t('purchaseOrder.action.create') }}</h2>
              <button type="button" class="cursor-pointer rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" @click="showCreateModal = false">
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <!-- 可滚动主体 -->
            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div class="space-y-5">
                <!-- 基础信息 -->
                <div>
                  <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.remark') }}</label>
                  <input v-model="createForm.remark" type="text" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none" :placeholder="t('purchaseOrder.form.remarkPlaceholder')" />
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.estimatedShipping') }}</label>
                    <input v-model.number="createForm.estimated_shipping_cost" type="number" step="0.01" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.estimatedTariff') }}</label>
                    <input v-model.number="createForm.estimated_tariff_cost" type="number" step="0.01" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-[var(--text-secondary)]">{{ t('purchaseOrder.form.allocationMethod') }}</label>
                    <select v-model="createForm.allocation_method" class="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none">
                      <option value="by_quantity">{{ t('purchaseOrder.form.byQuantity') }}</option>
                      <option value="by_value">{{ t('purchaseOrder.form.byValue') }}</option>
                    </select>
                  </div>
                </div>

                <!-- 分隔线 + 采购商品列表 -->
                <div class="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
                  <!-- 列表头部 -->
                  <div class="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                    <h3 class="text-sm font-semibold text-[var(--text-main)]">
                      {{ t('purchaseOrder.form.itemList') }}
                      <span v-if="poItems.length > 0" class="ml-1 font-[Outfit] text-xs font-normal text-[var(--text-secondary)]">({{ poItems.length }})</span>
                    </h3>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/10"
                        @click="openOrderPicker('create')"
                      >
                        <AppIcon name="clipboard-document-list" class="size-3.5" />
                        {{ t('purchaseOrder.action.linkOrders') }}
                      </button>
                      <button
                        type="button"
                        class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
                        @click="openProductPicker('create')"
                      >
                        <AppIcon name="plus" class="size-3.5" />
                        {{ t('purchaseOrder.action.addProduct') }}
                      </button>
                    </div>
                  </div>

                  <!-- 空状态 -->
                  <div v-if="poItems.length === 0" class="flex flex-col items-center py-10">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
                      <AppIcon name="cube" class="size-7 text-[var(--text-muted)]" />
                    </div>
                    <p class="mt-3 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.form.noItems') }}</p>
                  </div>

                  <!-- 商品表格 -->
                  <div v-else class="overflow-x-auto">
                    <table class="w-full">
                      <thead>
                        <tr class="border-b border-[var(--border-subtle)] text-left text-xs font-medium text-[var(--text-secondary)]">
                          <th class="px-4 py-2.5">{{ t('purchaseOrder.table.product') }}</th>
                          <th class="px-4 py-2.5 text-center">{{ t('purchaseOrder.table.quantity') }}</th>
                          <th class="px-4 py-2.5 text-right">{{ t('purchaseOrder.table.unitCost') }}</th>
                          <th class="px-4 py-2.5 text-center">{{ t('purchaseOrder.form.source') }}</th>
                          <th class="w-10 px-2 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-[var(--border-subtle)]">
                        <tr v-for="(item, idx) in poItems" :key="idx" class="group transition-colors hover:bg-[var(--bg-hover)]">
                          <!-- 商品信息 -->
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-2.5">
                              <div class="size-8 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
                                <AppImage v-if="item.image" :src="'/file/' + item.image" class="size-full" />
                                <div v-else class="flex size-full items-center justify-center text-[var(--text-muted)]">
                                  <AppIcon name="photo" class="size-4" />
                                </div>
                              </div>
                              <div class="min-w-0">
                                <div class="truncate text-sm font-medium text-[var(--text-main)]">{{ item.product_name }}</div>
                                <div class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                  <span class="font-mono">{{ item.sku }}</span>
                                  <span v-if="item.brand">· {{ item.brand }}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <!-- 数量 (可编辑) -->
                          <td class="px-4 py-3 text-center">
                            <div class="flex flex-col items-center">
                              <input
                                v-model.number="item.quantity"
                                type="number"
                                min="1"
                                class="w-20 rounded-lg border px-2 py-1.5 text-center font-[Outfit] text-sm transition-colors focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                                :class="item.required_quantity && item.quantity < item.required_quantity
                                  ? 'border-[var(--color-danger)] text-[var(--color-danger)] bg-[var(--color-danger)]/5'
                                  : 'border-[var(--border-color)] text-[var(--text-main)] bg-[var(--bg-page)]'"
                              />
                              <span
                                v-if="item.required_quantity && item.quantity < item.required_quantity"
                                class="mt-1 text-[10px] font-medium text-[var(--color-danger)]"
                              >
                                {{ t('purchaseOrder.form.quantityWarning') }} ({{ item.required_quantity }})
                              </span>
                            </div>
                          </td>

                          <!-- 单价 (可编辑) -->
                          <td class="px-4 py-3 text-right">
                            <input
                              v-model.number="item.unit_cost"
                              type="number"
                              step="0.01"
                              min="0"
                              class="w-24 rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] px-2 py-1.5 text-right font-[Outfit] text-sm text-[var(--text-main)] transition-colors focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
                            />
                          </td>

                          <!-- 来源标签 -->
                          <td class="px-4 py-3 text-center">
                            <span
                              v-if="item.pre_order_id"
                              class="inline-flex items-center gap-1 rounded-full bg-[var(--color-info)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-info)]"
                            >
                            <AppIcon name="shopping-bag" class="size-3" />
                              {{ t('purchaseOrder.form.sourceOrder') }}
                            </span>
                            <span v-else class="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                              <AppIcon name="building-storefront" class="size-3" />
                              {{ t('purchaseOrder.form.sourceStock') }}
                            </span>
                          </td>

                          <!-- 删除按钮 -->
                          <td class="px-2 py-3">
                            <button
                              type="button"
                              class="cursor-pointer rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                              @click="removePoItem(idx)"
                            >
                                <AppIcon name="trash" class="size-4" />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="flex items-center justify-between border-t border-[var(--border-color)] px-6 py-4">
              <div class="text-sm text-[var(--text-secondary)]">
                <span v-if="poItems.length > 0">
                  {{ poItems.length }} {{ t('purchaseOrder.form.itemsCount') }} · {{ t('purchaseOrder.form.totalQty') }}: <strong class="font-[Outfit]">{{ totalCreateQty }}</strong>
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]" @click="showCreateModal = false">
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  :disabled="poItems.length === 0"
                  class="cursor-pointer rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="handleCreate"
                >
                  {{ t('common.create') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- 商品详情弹窗 -->
    <ProductDetailModal
      v-if="viewProductId"
      :show="!!viewProductId"
      :product-id="viewProductId"
      @close="viewProductId = null"
    />

    <!-- 二次确认弹窗 (数量不足) -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showShortageConfirm" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="showShortageConfirm = false"></div>
          <div class="relative w-full max-w-md rounded-2xl bg-[var(--color-modal-bg)] p-6 shadow-xl">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-[var(--color-warning)]/10">
                <AppIcon name="exclamation-triangle" class="size-5 text-[var(--color-warning)]" />
              </div>
              <h3 class="text-base font-bold text-[var(--text-main)]">{{ t('purchaseOrder.form.confirmShortageTitle') }}</h3>
            </div>
            <p class="mb-5 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.form.confirmShortage') }}</p>
            <div class="mb-5 max-h-40 overflow-y-auto rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-3">
              <div v-for="item in shortageItems" :key="`${item.product_id || 'p'}-${item.variant_id || 'v'}`" class="flex items-center justify-between py-1 text-sm">
                <span class="text-[var(--text-main)]">{{ item.product_name }}</span>
                <span class="font-[Outfit] text-[var(--color-danger)]">
                  {{ item.quantity }} / {{ item.required_quantity }}
                </span>
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <button type="button" class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" @click="showShortageConfirm = false">
                {{ t('common.cancel') }}
              </button>
              <button type="button" class="cursor-pointer rounded-xl bg-[var(--color-warning)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90" @click="executeCreate">
                {{ t('purchaseOrder.form.confirmCreate') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- 预定单 / 商品 选择弹窗 -->
    <OrderPickerModal :visible="showOrderPicker" :exclude-ids="excludeOrderIds" @close="showOrderPicker = false" @confirm="handleOrdersSelected" />
    <ProductPickerModal :visible="showProductPicker" :existing-brands="existingBrands" :exclude-ids="excludeProductIds" @close="showProductPicker = false" @confirm="handleProductsSelected" />

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
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <div v-if="suggestionsLoading" class="flex items-center justify-center py-12">
              <div class="size-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"></div>
            </div>
            <div v-else-if="suggestions.length === 0" class="py-12 text-center">
              <AppIcon name="light-bulb" class="mx-auto size-10 text-[var(--text-muted)]" />
              <p class="mt-3 text-sm text-[var(--text-secondary)]">{{ t('purchaseOrder.suggestions.empty') }}</p>
            </div>
            <div v-else class="max-h-96 space-y-2 overflow-y-auto">
              <div
                v-for="s in suggestions"
                :key="`${s.product_id}-${s.variant_id || 'no-variant'}`"
                class="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div class="flex items-center gap-3">
                  <input v-model="selectedSuggestions" :value="s" type="checkbox" class="size-4 cursor-pointer rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                  <div>
                    <div class="text-sm font-medium text-[var(--text-main)]">{{ s.product_name }}</div>
                    <div class="text-xs text-[var(--text-secondary)]">
                      {{ s.sku }} · {{ s.brand }}
                      <template v-if="s.variant_options && Object.keys(s.variant_options).length > 0">
                        · {{ Object.values(s.variant_options).join(' / ') }}
                      </template>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-xs">
                  <span class="font-semibold text-[var(--color-danger)]">{{ t('purchaseOrder.suggestions.shortage') }}: {{ s.shortage }}</span>
                  <span class="text-[var(--text-secondary)]">{{ t('purchaseOrder.suggestions.stock') }}: {{ s.stock_quantity }}</span>
                  <span class="font-[Outfit] text-[var(--text-secondary)]">成本 ¥{{ (s.variant_cost_price || s.cost_price || 0).toFixed(2) }}</span>
                  <span class="font-[Outfit] text-[var(--text-secondary)]">建议 ¥{{ (s.suggested_purchase_price || s.cost_price || 0).toFixed(2) }}</span>
                  <span v-if="s.last_purchase_price != null" class="font-[Outfit] text-[var(--text-secondary)]">
                    最近 ¥{{ Number(s.last_purchase_price).toFixed(2) }}
                  </span>
                  <span
                    v-if="s.price_delta != null"
                    class="font-[Outfit] font-semibold"
                    :class="s.price_delta > 0 ? 'text-[var(--color-warning)]' : s.price_delta < 0 ? 'text-[var(--color-success)]' : 'text-[var(--text-secondary)]'"
                  >
                    Δ {{ s.price_delta > 0 ? '+' : '' }}{{ Number(s.price_delta).toFixed(2) }}
                  </span>
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

const getFileUrl = (id) => `/file/${id}`;
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { validateOrderQuantity } from '@/utils/purchase-order-constraints';
import OrderPickerModal from '@/components/purchase-order/OrderPickerModal.vue';
import ProductPickerModal from '@/components/purchase-order/ProductPickerModal.vue';
import ProductDetailModal from '@/components/product/ProductDetailModal.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const viewProductId = ref(null);
const handleViewProductDetail = (id) => {
  viewProductId.value = id;
};


const { t } = useI18n();
const {
  list, total, loading, detail, detailLoading,
  suggestions, suggestionsLoading, stats,
  filters, statusConfig,
  loadList, loadStats, loadDetail,
  createPO, createFromOrders, updateStatus,
  loadSuggestions, addItems, removeItem, updateItem,
} = usePurchaseOrders();

const route = useRoute();
const router = useRouter();
const { loadProduct } = useProducts();
const { addToast } = useToast();

// ─── 本地状态 ────────────────────────────────────────

const showDetail = ref(false);
const showCreateModal = ref(false);
const showSuggestions = ref(false);
const selectedSuggestions = ref([]);

// ─── 新建采购单增强状态 ──────────────────────────────
const showOrderPicker = ref(false);
const showProductPicker = ref(false);
const showShortageConfirm = ref(false);
const pickerTarget = ref('create'); // 'create' or 'detail'

// 采购明细列表 (本地编辑用)
// 结构: { product_id, variant_id, product_name, sku, brand, image, quantity, unit_cost, pre_order_id?, order_no?, required_quantity? }
const poItems = reactive([]);

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
const stepsList = [
  { value: 'draft', label: t('purchaseOrder.status.draft') },
  { value: 'ordered', label: t('purchaseOrder.status.ordered') },
  { value: 'shipping', label: t('purchaseOrder.status.shipping') },
  { value: 'arrived', label: t('purchaseOrder.status.arrived') },
  { value: 'completed', label: t('purchaseOrder.status.completed') }
];

const getStepIndex = (status) => {
  return stepsList.findIndex(s => s.value === status);
};

const isStepCompleted = (currentStatus, stepStatus) => {
  if (currentStatus === 'cancelled') return false;
  return getStepIndex(currentStatus) > getStepIndex(stepStatus);
};

const getStepperProgress = (currentStatus) => {
  if (currentStatus === 'cancelled') return '0%';
  const currentIndex = getStepIndex(currentStatus);
  if (currentIndex <= 0) return '0%';
  return `${(currentIndex / (stepsList.length - 1)) * 100}%`;
};

const getStepIconClasses = (currentStatus, stepStatus) => {
  if (currentStatus === 'cancelled') {
    return 'border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-muted)]';
  }
  const currentIndex = getStepIndex(currentStatus);
  const stepIndex = getStepIndex(stepStatus);
  
  if (currentIndex > stepIndex) {
    return 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--text-inverse)]';
  } else if (currentIndex === stepIndex) {
    return 'border-[var(--color-primary)] bg-[var(--bg-card)]';
  } else {
    return 'border-[var(--border-strong)] bg-[var(--bg-muted)]';
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

// ─── 新建/编辑采购单 - 选择器打开 ──────────────────────
const openOrderPicker = (target = 'create') => { pickerTarget.value = target; showOrderPicker.value = true; };
const openProductPicker = (target = 'create') => { pickerTarget.value = target; showProductPicker.value = true; };

// 从预定单选择器接收选中的订单 → 转化为 poItems 行或直接添加到草稿
const handleOrdersSelected = async (orders) => {
  const itemsToAdd = [];
  for (const order of orders) {
    // 避免重复添加同一个订单
    const isDuplicate = pickerTarget.value === 'create'
      ? poItems.some(i => i.pre_order_id === order.id)
      : detail.value?.items?.some(i => i.pre_order_id === order.id);
    if (isDuplicate) continue;

    // 解析 current_data 获取商品详情
    let data = {};
    try {
      data = order.currentData || order.current_data
        ? (typeof (order.currentData || order.current_data) === 'string'
          ? JSON.parse(order.currentData || order.current_data)
          : (order.currentData || order.current_data))
        : {};
    } catch { /* 忽略 */ }

    itemsToAdd.push({
      product_id: order.productId || order.product_id || null,
      variant_id: order.variantId || order.variant_id || null,
      product_name: order.productName || data.name || '—',
      sku: data.variant_sku || data.spu || '—',
      brand: data.brand || order.brand || '',
      image: data.images?.[0] || null,
      quantity: order.quantity || 1,
      unit_cost: data.cost_price || data.price || 0,
      moq: order.moq || null,
      pack_size: order.pack_size || null,
      order_step: order.order_step || null,
      pre_order_id: order.id,
      order_no: order.orderNo || order.order_no || '',
      required_quantity: order.quantity || 1, // 预定需求量
    });
  }

  if (itemsToAdd.length === 0) return;
  const validItems = itemsToAdd.filter(i => i.product_id && i.variant_id);
  if (validItems.length === 0) return;

  if (pickerTarget.value === 'create') {
    poItems.push(...validItems);
  } else if (pickerTarget.value === 'detail' && detail.value) {
    // 详情草稿面板：直接调用接口添加明细
    const newItems = validItems.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      pre_order_id: i.pre_order_id,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    }));
    const success = await addItems(detail.value.id, newItems);
    if (success) {
      await loadDetail(detail.value.id);
      loadList();
      loadStats();
    }
  }
};

// 从商品选择器接收选中的商品 → 转化为 poItems 行或直接添加到草稿 (补货)
const handleProductsSelected = async (products) => {
  const itemsToAdd = [];
  for (const product of products) {
    const fullProduct = await loadProduct(product.id);
    const selectedVariant = (fullProduct?.variants || []).find(v => v.status === 'active') || (fullProduct?.variants || [])[0];
    if (!selectedVariant) continue;
    const isDuplicate = pickerTarget.value === 'create'
      ? poItems.some(i => i.variant_id === selectedVariant.id && !i.pre_order_id)
      : detail.value?.items?.some(i => i.variant_id === selectedVariant.id && !i.pre_order_id);
    if (isDuplicate) continue;

    let mainImage = null;
    try {
      const imgs = typeof fullProduct?.images === 'string' ? JSON.parse(fullProduct.images) : fullProduct?.images;
      mainImage = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
    } catch { /* 忽略 */ }

    itemsToAdd.push({
      product_id: fullProduct?.id || product.id,
      variant_id: selectedVariant.id,
      product_name: fullProduct?.name || product.name,
      sku: selectedVariant.sku || '—',
      brand: fullProduct?.brand || product.brand || '',
      image: mainImage,
      quantity: 1,
      unit_cost: selectedVariant.cost_price || 0,
      moq: selectedVariant.moq || null,
      pack_size: selectedVariant.pack_size || null,
      order_step: selectedVariant.order_step || null,
      pre_order_id: null,
      order_no: null,
      required_quantity: null, // 补货无需求限制
    });
  }

  if (itemsToAdd.length === 0) return;

  if (pickerTarget.value === 'create') {
    poItems.push(...itemsToAdd);
  } else if (pickerTarget.value === 'detail' && detail.value) {
    const newItems = itemsToAdd.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      pre_order_id: null,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    }));
    const success = await addItems(detail.value.id, newItems);
    if (success) {
      await loadDetail(detail.value.id);
      loadList();
      loadStats();
    }
  }
};

// 删除单条明细
const removePoItem = (idx) => {
  poItems.splice(idx, 1);
};

// 计算属性
const totalCreateQty = computed(() => poItems.reduce((sum, i) => sum + (i.quantity || 0), 0));
const shortageItems = computed(() => poItems.filter(i => i.required_quantity && i.quantity < i.required_quantity));
const excludeOrderIds = computed(() => {
  const items = pickerTarget.value === 'detail' && detail.value ? (detail.value.items || []) : poItems;
  return items.filter(i => i.pre_order_id).map(i => i.pre_order_id);
});
const excludeProductIds = computed(() => {
  const items = pickerTarget.value === 'detail' && detail.value ? (detail.value.items || []) : poItems;
  return items.filter(i => !i.pre_order_id && i.product_id).map(i => i.product_id);
});
const existingBrands = computed(() => {
  const items = pickerTarget.value === 'detail' && detail.value ? (detail.value.items || []) : poItems;
  return [...new Set(items.map(i => i.brand).filter(Boolean))];
});

// 详情明细编辑处理
const handleDetailUpdateItem = async (itemId, field, value) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await updateItem(detail.value.id, itemId, { [field]: value });
  if (success) {
    await loadDetail(detail.value.id);
    loadList();
    loadStats();
  }
};

const handleDetailRemoveItem = async (itemId) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await removeItem(detail.value.id, itemId);
  if (success) {
    await loadDetail(detail.value.id);
    loadList();
    loadStats();
  }
};

// 创建采购单
const handleCreate = async () => {
  if (poItems.length === 0) return;

  // 如果有数量低于需求的，弹出二次确认
  if (shortageItems.value.length > 0) {
    showShortageConfirm.value = true;
    return;
  }

  await executeCreate();
};

const executeCreate = async () => {
  showShortageConfirm.value = false;

  for (const item of poItems) {
    const result = validateOrderQuantity(item.quantity || 1, {
      moq: item.moq || 1,
      packSize: item.pack_size || 1,
      orderStep: item.order_step || 1,
    });
    if (!result.valid) {
      addToast({
        type: 'warning',
        message: `${item.product_name} 数量不满足规则，建议数量 ${result.suggestedQuantity}`,
      });
      return;
    }
  }

  // Step 1: 创建空采购单
  const result = await createPO({ ...createForm });
  if (!result) return;

  // Step 2: 批量添加明细
  const items = poItems.map(item => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    pre_order_id: item.pre_order_id || null,
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
  }));

  if (items.length > 0) {
    await addItems(result.id, items);
  }

  // Reset
  showCreateModal.value = false;
  createForm.remark = '';
  createForm.estimated_shipping_cost = 0;
  createForm.estimated_tariff_cost = 0;
  createForm.allocation_method = 'by_quantity';
  poItems.splice(0, poItems.length); // 清空
  loadList();
  loadStats();
};



const handleCreateFromSuggestions = async () => {
  // 将建议中的预订单汇总
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

  if (route.query.id) {
    const targetId = route.query.id;
    // 使用 replace 移除 URL 上的参数防止反复触发打开详情
    let newQuery = { ...route.query };
    delete newQuery.id;
    router.replace({ path: route.path, query: newQuery });
    
    // 打开关联的详情弹窗
    openDetail(targetId);
  }
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
