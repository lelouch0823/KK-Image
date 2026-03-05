<template>
  <div class="space-y-6">
    <div v-if="errorCode === 'FORBIDDEN'" class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8">
      <PermissionDeniedState
        title="采购单权限不足"
        :description="error || '当前账号没有采购单读取权限，请联系管理员分配 purchase_orders:read。'"
        required-permission="products:manage"
        @retry="loadList"
      />
    </div>
    <template v-else>
    <!-- 页面标题与操作 -->
    <AppFilterBar
      :title="t('purchaseOrder.title')"
      :subtitle="t('purchaseOrder.subtitle')"
    >
      <template #actions>
        <!-- 智能建议按钮 -->
        <AppButton
          variant="secondary"
          :text="t('purchaseOrder.action.viewSuggestions')"
          icon="light-bulb"
          @click="showSuggestions = true"
        />
        <!-- 新建按钮 -->
        <AppButton
          variant="primary"
          :text="t('purchaseOrder.action.create')"
          icon="plus"
          @click="showCreateModal = true"
        />
      </template>

      <!-- 状态筛选 -->
      <template #filters>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton
            v-for="tab in statusTabs"
            :key="tab.value"
            size="sm"
            :variant="filters.status === tab.value ? 'primary' : 'secondary'"
            :text="tab.label"
            class="!rounded-full"
            @click="filters.status = tab.value"
          />
        </div>
      </template>
    </AppFilterBar>

    <!-- ===== 统计卡片：骨架屏 or 真实数据 ===== -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
      <template v-if="loading && !stats">
        <!-- 骨架卡片 ×6 -->
        <div
          v-for="i in 6" :key="'sk-card-' + i"
          class="relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-lg sm:p-5"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-3">
              <div class="skeleton-shimmer h-3.5 w-16 rounded bg-(--bg-muted)" />
              <div class="skeleton-shimmer h-8 w-12 rounded bg-(--bg-muted)" />
            </div>
            <div class="skeleton-shimmer size-9 rounded-xl bg-(--bg-muted) sm:size-10" />
          </div>
        </div>
      </template>

      <template v-else-if="stats">
        <div
          v-for="card in statCards"
          :key="card.key"
          class="group relative cursor-pointer overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
          :class="{ 'ring-primary/20 ring-2': filters.status === card.key }"
          @click="filters.status = filters.status === card.key ? '' : card.key"
        >
          <div class="relative z-10 flex items-start justify-between">
            <div>
              <h3 class="text-xs font-medium text-(--text-secondary) sm:text-sm">{{ card.label }}</h3>
              <div class="mt-1.5 font-[Outfit] text-2xl font-bold tracking-tight text-(--text-main) sm:mt-2 sm:text-3xl">
                {{ card.count }}
              </div>
            </div>
            <div
              class="flex size-9 items-center justify-center rounded-xl transition-colors sm:size-10"
              :class="[
                card.key === '' ? 'bg-primary/10 text-primary' :
                card.key === 'draft' ? 'bg-slate-500/10 text-slate-500' :
                card.key === 'ordered' ? 'bg-amber-500/10 text-amber-500' :
                card.key === 'shipping' ? 'bg-purple-500/10 text-purple-500' :
                card.key === 'arrived' ? 'bg-emerald-500/10 text-emerald-500' :
                'bg-blue-500/10 text-blue-500'
              ]"
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
            :class="[
              card.key === '' ? 'bg-primary/10' :
              card.key === 'draft' ? 'bg-slate-500/10' :
              card.key === 'ordered' ? 'bg-amber-500/10' :
              card.key === 'shipping' ? 'bg-purple-500/10' :
              card.key === 'arrived' ? 'bg-emerald-500/10' :
              'bg-blue-500/10'
            ]"
          ></div>
        </div>
      </template>
    </div>

    <!-- ===== 数据表格：AppTable ===== -->
    <div class="overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) shadow-sm">
      <AppTable
        :columns="columns"
        :data="list"
        :loading="loading"
        :empty-text="t('purchaseOrder.empty')"
        @row-click="(row) => openDetail(row.id)"
      >
        <!-- 采购单编号 -->
        <template #cell-po_no="{ row: po }">
          <code class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs text-(--text-secondary)">{{ po.po_no }}</code>
        </template>

        <template #cell-status="{ row: po }">
          <StatusBadge
            v-if="po.status"
            :variant="['draft','cancelled'].includes(po.status) ? 'default' : (['ordered'].includes(po.status) ? 'warning' : (po.status === 'shipping' ? 'purple' : (po.status === 'arrived' ? 'info' : 'success')))"
          >
            {{ statusConfig[po.status]?.label || po.status }}
          </StatusBadge>
        </template>

        <!-- 商品数 -->
        <template #cell-item_count="{ row: po }">
          <span class="font-medium text-(--text-main)">{{ po.item_count || 0 }}</span>
        </template>

        <!-- 商品总金额 -->
        <template #cell-total_goods_cost="{ row: po }">
          <span class="font-[Outfit] font-medium text-(--text-main)">¥{{ (po.total_goods_cost || 0).toFixed(2) }}</span>
        </template>

        <!-- 备注 -->
        <template #cell-remark="{ row: po }">
          <span class="max-w-[150px] truncate text-(--text-secondary)" :title="po.remark">{{ po.remark || '-' }}</span>
        </template>

        <!-- 创建时间 -->
        <template #cell-created_at="{ row: po }">
          <span class="text-(--text-secondary)">{{ formatDate(po.created_at) }}</span>
        </template>
      </AppTable>

      <!-- 分页 -->
      <div v-if="total > filters.limit" class="flex items-center justify-between border-t border-(--border-color) px-4 py-3">
        <p class="text-sm text-(--text-secondary)">
          {{ t('purchaseOrder.pagination.total', { count: total }) }}
        </p>
        <div class="flex items-center gap-2">
          <button
            :disabled="filters.page <= 1"
            class="cursor-pointer rounded-lg border border-(--border-color) px-3 py-1.5 text-sm transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
            @click="filters.page--; loadList()"
          >
            ← {{ t('purchaseOrder.pagination.prev') }}
          </button>
          <button
            :disabled="filters.page * filters.limit >= total"
            class="cursor-pointer rounded-lg border border-(--border-color) px-3 py-1.5 text-sm transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
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
          <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="showDetail = false"></div>
          <!-- 面板 -->
          <div class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-(--color-modal-bg) shadow-xl" style="max-height: calc(100vh - 3rem)">
            <div class="flex shrink-0 items-center justify-between border-b border-(--border-color) px-6 py-4">
              <div>
                <h2 class="text-lg font-bold text-(--text-main)">{{ detail.po_no }}</h2>
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
              <button class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)" @click="showDetail = false">
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <div class="flex h-full min-h-0 flex-col">
              <div class="flex-1 space-y-6 overflow-y-auto p-6">
                <!-- 状态可视化 (Stepper) -->
                <div class="mb-4">
                  <div class="relative flex items-center justify-between">
                    <div class="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-(--border-color)"></div>
                    <div 
                      class="bg-primary absolute top-1/2 left-0 h-0.5 -translate-y-1/2 transition-all duration-500"
                      :style="{ width: getStepperProgress(detail.status) }"
                    ></div>
                    
                    <div v-for="step in stepsList" :key="step.value" class="relative z-10 flex flex-col items-center gap-2">
                      <div 
                        class="flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-300"
                        :class="getStepIconClasses(detail.status, step.value)"
                      >
                        <AppIcon v-if="isStepCompleted(detail.status, step.value)" name="check" class="size-3.5 text-(--text-inverse)" stroke-width="3" />
                        <div v-else-if="detail.status === step.value" class="bg-primary size-2 rounded-full"></div>
                      </div>
                      <span class="text-xs font-medium" :class="detail.status === step.value ? 'text-(--text-main)' : isStepCompleted(detail.status, step.value) ? 'text-(--text-main)' : 'text-(--text-muted)'">
                        {{ step.label }}
                      </span>
                    </div>
                  </div>
                </div>

              <!-- 费用信息 -->
              <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
                <h3 class="mb-3 text-sm font-semibold text-(--text-main)">{{ t('purchaseOrder.detail.costInfo') }}</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs text-(--text-secondary)">{{ t('purchaseOrder.form.estimatedShipping') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-(--text-main)">¥{{ (detail.estimated_shipping_cost || 0).toFixed(2) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-(--text-secondary)">{{ t('purchaseOrder.form.estimatedTariff') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-(--text-main)">¥{{ (detail.estimated_tariff_cost || 0).toFixed(2) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-(--text-secondary)">{{ t('purchaseOrder.table.actualShipping') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-(--text-main)">
                      {{ detail.actual_shipping_cost != null ? `¥${detail.actual_shipping_cost.toFixed(2)}` : '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-(--text-secondary)">{{ t('purchaseOrder.table.actualTariff') }}</div>
                    <div class="mt-0.5 font-[Outfit] font-medium text-(--text-main)">
                      {{ detail.actual_tariff_cost != null ? `¥${detail.actual_tariff_cost.toFixed(2)}` : '—' }}
                    </div>
                  </div>
                </div>
                <!-- 分摊方式 -->
                <div class="mt-3 flex items-center gap-2 text-xs">
                  <span class="text-(--text-secondary)">{{ t('purchaseOrder.form.allocationMethod') }}:</span>
                  <span class="font-medium text-(--text-main)">
                    {{ detail.allocation_method === 'by_value' ? t('purchaseOrder.form.byValue') : t('purchaseOrder.form.byQuantity') }}
                  </span>
                </div>
              </div>

              <!-- 明细列表 -->
              <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="text-sm font-semibold text-(--text-main)">{{ t('purchaseOrder.detail.items') }} ({{ detail.items?.length || 0 }})</h3>
                  <div v-if="detail.status === 'draft'" class="flex items-center gap-2">
                    <button type="button" class="border-primary/30 bg-primary/5 text-primary flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-primary/10" @click="openOrderPicker('detail')">
                      <AppIcon name="plus" class="size-3.5" />
                      {{ t('purchaseOrder.action.linkOrders') }}
                    </button>
                    <button type="button" class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--border-color) px-2.5 py-1.5 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover)" @click="openProductPicker('detail')">
                      <AppIcon name="plus" class="size-3.5" />
                      {{ t('purchaseOrder.action.addProduct') }}
                    </button>
                  </div>
                </div>
                <div v-if="detail.items && detail.items.length > 0" class="space-y-3">
                  <div
                    v-for="item in detail.items"
                    :key="item.id"
                    class="group flex flex-col justify-between gap-3 rounded-xl border border-(--border-subtle) p-3 transition-colors hover:bg-(--bg-hover) sm:flex-row sm:items-center"
                  >
                    <div class="flex items-center gap-3">
                      <!-- 商品主图 -->
                      <div class="size-14 shrink-0 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-muted) shadow-sm">
                        <AppImage v-if="item.product_images?.[0]" :src="getFileUrl(item.product_images[0])" :alt="item.product_name" class="size-full object-cover" />
                        <div v-else class="flex size-full items-center justify-center">
                          <AppIcon name="photo" class="size-6 text-(--text-muted)" />
                        </div>
                      </div>
                      
                      <!-- 商品信息 -->
                      <div class="flex flex-col gap-1">
                        <div class="hover:text-primary flex cursor-pointer items-center gap-2 transition-colors" @click="handleViewProductDetail(item.product_id)">
                          <span class="line-clamp-1 text-sm font-medium text-(--text-main)" :title="item.product_name">{{ item.product_name || '—' }}</span>
                          <span v-if="item.product_brand" class="shrink-0 rounded bg-(--bg-muted) px-1.5 py-0.5 text-[10px] font-medium text-(--text-secondary)">{{ item.product_brand }}</span>
                          <span v-if="detail.status === 'draft'" class="text-danger flex shrink-0 cursor-pointer items-center gap-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100" @click="handleDetailRemoveItem(item.id)">
                            <AppIcon name="trash" class="size-3" />
                            {{ t('common.delete') }}
                          </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)">
                          <code class="rounded bg-(--bg-muted) px-1 py-0.5 font-mono text-[10px]">{{ item.product_sku || '-' }}</code>
                          <span class="text-(--text-muted)">·</span>
                          <span v-if="item.customer_order_no" class="bg-info/10 text-info inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium">
                            <AppIcon name="shopping-bag" class="size-3" />
                            {{ item.customer_order_no }}
                          </span>
                          <span v-else class="bg-warning/10 text-warning inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium">
                            <AppIcon name="building-storefront" class="size-3" />
                            {{ t('purchaseOrder.detail.publicStock') }}
                          </span>
                        </div>
                        <!-- Specs -->
                        <div v-if="item.product_specifications && Object.keys(item.product_specifications).length > 0" class="mt-0.5 flex flex-wrap gap-1">
                          <span v-for="(val, key) in item.product_specifications" :key="key" class="rounded border border-(--border-subtle) bg-(--bg-page) px-1.5 py-0.5 text-[10px] text-(--text-secondary)">
                            {{ key }}: {{ val }}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div v-if="detail.status === 'draft'" class="flex items-center justify-end gap-3 pl-12 sm:pl-0">
                      <div class="flex flex-col items-center">
                        <span class="mb-1 text-[10px] text-(--text-secondary)">{{ t('purchaseOrder.table.quantity') }}</span>
                        <input v-model.number="item.quantity" type="number" min="1" class="focus:border-primary focus:ring-primary focus:ring-1 focus:outline-none w-16 rounded-md border border-(--border-color) bg-(--bg-page) px-2 py-1 text-center font-[Outfit] text-sm text-(--text-main)" @change="handleDetailUpdateItem(item.id, 'quantity', item.quantity)" />
                      </div>
                      <div class="flex flex-col items-center">
                        <span class="mb-1 text-[10px] text-(--text-secondary)">{{ t('purchaseOrder.table.unitCost') }}</span>
                        <div class="relative">
                          <span class="absolute top-1.5 left-2 text-xs text-(--text-secondary)">¥</span>
                          <input v-model.number="item.unit_cost" type="number" step="0.01" min="0" class="focus:border-primary focus:ring-primary focus:ring-1 focus:outline-none w-20 rounded-md border border-(--border-color) bg-(--bg-page) py-1 pr-2 pl-5 text-right font-[Outfit] text-sm text-(--text-main)" @change="handleDetailUpdateItem(item.id, 'unit_cost', item.unit_cost)" />
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-right">
                      <div class="font-[Outfit] text-sm font-medium text-(--text-main)">×{{ item.quantity }} · ¥{{ (item.unit_cost || 0).toFixed(2) }}</div>
                      <div v-if="item.allocated_freight > 0 || item.allocated_tariff > 0" class="text-xs text-(--text-secondary)">
                        {{ t('purchaseOrder.allocation.freight') }} ¥{{ (item.allocated_freight || 0).toFixed(2) }}
                        + {{ t('purchaseOrder.allocation.tariff') }} ¥{{ (item.allocated_tariff || 0).toFixed(2) }}
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else class="py-4 text-center text-sm text-(--text-secondary)">{{ t('purchaseOrder.emptyItems') }}</p>
              </div>

              <!-- 备注 -->
              <div v-if="detail.remark" class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
                <h3 class="mb-2 text-sm font-semibold text-(--text-main)">{{ t('purchaseOrder.form.remark') }}</h3>
                <p class="text-sm text-(--text-secondary)">{{ detail.remark }}</p>
              </div>
            </div>
            
            <!-- Footer Fixed Action Bar -->
            <div class="flex items-center justify-between border-t border-(--border-color) bg-(--bg-card) px-6 py-4">
              <div class="flex items-center gap-3">
                <!-- 左侧：次要/辅助操作 -->
                <button
                  v-if="nextStatuses.includes('cancelled')"
                  class="text-danger cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-danger/10"
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
                  class="bg-primary cursor-pointer rounded-xl px-6 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:bg-primary/90 hover:shadow"
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
          <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="showCreateModal = false"></div>
          <div class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-(--color-modal-bg) shadow-xl" style="max-height: calc(100vh - 3rem)">
            <!-- 头部 -->
            <div class="flex items-center justify-between border-b border-(--border-color) px-6 py-4">
              <h2 class="text-lg font-bold text-(--text-main)">{{ t('purchaseOrder.action.create') }}</h2>
              <button type="button" class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)" @click="showCreateModal = false">
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <!-- 可滚动主体 -->
            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div class="space-y-5">
                <!-- 基础信息 -->
                <div>
                  <label class="text-xs font-medium text-(--text-secondary)">{{ t('purchaseOrder.form.remark') }}</label>
                  <input v-model="createForm.remark" type="text" class="focus:ring-primary focus:ring-2 focus:outline-none mt-1 w-full rounded-xl border border-(--border-color) bg-(--bg-page) px-3 py-2.5 text-sm text-(--text-main)" :placeholder="t('purchaseOrder.form.remarkPlaceholder')" />
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <label class="text-xs font-medium text-(--text-secondary)">{{ t('purchaseOrder.form.estimatedShipping') }}</label>
                    <input v-model.number="createForm.estimated_shipping_cost" type="number" step="0.01" class="focus:ring-primary focus:ring-2 focus:outline-none mt-1 w-full rounded-xl border border-(--border-color) bg-(--bg-page) px-3 py-2.5 text-sm text-(--text-main)" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-(--text-secondary)">{{ t('purchaseOrder.form.estimatedTariff') }}</label>
                    <input v-model.number="createForm.estimated_tariff_cost" type="number" step="0.01" class="focus:ring-primary focus:ring-2 focus:outline-none mt-1 w-full rounded-xl border border-(--border-color) bg-(--bg-page) px-3 py-2.5 text-sm text-(--text-main)" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-(--text-secondary)">{{ t('purchaseOrder.form.allocationMethod') }}</label>
                    <select v-model="createForm.allocation_method" class="focus:ring-primary focus:ring-2 focus:outline-none mt-1 w-full rounded-xl border border-(--border-color) bg-(--bg-page) px-3 py-2.5 text-sm text-(--text-main)">
                      <option value="by_quantity">{{ t('purchaseOrder.form.byQuantity') }}</option>
                      <option value="by_value">{{ t('purchaseOrder.form.byValue') }}</option>
                    </select>
                  </div>
                </div>

                <!-- 分隔线 + 采购商品列表 -->
                <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) shadow-sm">
                  <!-- 列表头部 -->
                  <div class="flex items-center justify-between border-b border-(--border-subtle) px-4 py-3">
                    <h3 class="text-sm font-semibold text-(--text-main)">
                      {{ t('purchaseOrder.form.itemList') }}
                      <span v-if="poItems.length > 0" class="ml-1 font-[Outfit] text-xs font-normal text-(--text-secondary)">({{ poItems.length }})</span>
                    </h3>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="border-primary/30 bg-primary/5 text-primary flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary/10"
                        @click="openOrderPicker('create')"
                      >
                        <AppIcon name="clipboard-document-list" class="size-3.5" />
                        {{ t('purchaseOrder.action.linkOrders') }}
                      </button>
                      <button
                        type="button"
                        class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--border-color) px-3 py-1.5 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover)"
                        @click="openProductPicker('create')"
                      >
                        <AppIcon name="plus" class="size-3.5" />
                        {{ t('purchaseOrder.action.addProduct') }}
                      </button>
                    </div>
                  </div>

                  <!-- 空状态 -->
                  <div v-if="poItems.length === 0" class="flex flex-col items-center py-10">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-(--bg-muted)">
                      <AppIcon name="cube" class="size-7 text-(--text-muted)" />
                    </div>
                    <p class="mt-3 text-sm text-(--text-secondary)">{{ t('purchaseOrder.form.noItems') }}</p>
                  </div>

                  <!-- 商品表格 -->
                  <div v-else class="overflow-x-auto">
                    <table class="w-full">
                      <thead>
                        <tr class="border-b border-(--border-subtle) text-left text-xs font-medium text-(--text-secondary)">
                          <th class="px-4 py-2.5">{{ t('purchaseOrder.table.product') }}</th>
                          <th class="px-4 py-2.5 text-center">{{ t('purchaseOrder.table.quantity') }}</th>
                          <th class="px-4 py-2.5 text-right">{{ t('purchaseOrder.table.unitCost') }}</th>
                          <th class="px-4 py-2.5 text-center">{{ t('purchaseOrder.form.source') }}</th>
                          <th class="w-10 px-2 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-(--border-subtle)">
                        <tr v-for="(item, idx) in poItems" :key="idx" class="group transition-colors hover:bg-(--bg-hover)">
                          <!-- 商品信息 -->
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-2.5">
                              <div class="size-8 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)">
                                <AppImage v-if="item.image" :src="'/file/' + item.image" class="size-full" />
                                <div v-else class="flex size-full items-center justify-center text-(--text-muted)">
                                  <AppIcon name="photo" class="size-4" />
                                </div>
                              </div>
                              <div class="min-w-0">
                                <div class="truncate text-sm font-medium text-(--text-main)">{{ item.product_name }}</div>
                                <div class="flex items-center gap-1.5 text-xs text-(--text-secondary)">
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
                                class="focus:ring-primary/20 focus:ring-2 focus:outline-none w-20 rounded-lg border px-2 py-1.5 text-center font-[Outfit] text-sm transition-colors"
                                :class="item.required_quantity && item.quantity < item.required_quantity
                                  ? 'border-danger bg-danger/5 text-danger'
                                  : 'border-(--border-color) bg-(--bg-page) text-(--text-main)'"
                              />
                              <span
                                v-if="item.required_quantity && item.quantity < item.required_quantity"
                                class="text-danger mt-1 text-[10px] font-medium"
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
                              class="focus:ring-primary/20 focus:ring-2 focus:outline-none w-24 rounded-lg border border-(--border-color) bg-(--bg-page) px-2 py-1.5 text-right font-[Outfit] text-sm text-(--text-main) transition-colors"
                            />
                          </td>

                          <!-- 来源标签 -->
                          <td class="px-4 py-3 text-center">
                            <span
                              v-if="item.pre_order_id"
                              class="bg-info/10 text-info inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            >
                            <AppIcon name="shopping-bag" class="size-3" />
                              {{ t('purchaseOrder.form.sourceOrder') }}
                            </span>
                            <span v-else class="inline-flex items-center gap-1 rounded-full bg-(--bg-muted) px-2 py-0.5 text-[10px] font-semibold text-(--text-secondary)">
                              <AppIcon name="building-storefront" class="size-3" />
                              {{ t('purchaseOrder.form.sourceStock') }}
                            </span>
                          </td>

                          <!-- 删除按钮 -->
                          <td class="px-2 py-3">
                            <button
                              type="button"
                              class="hover:bg-danger/10 hover:text-danger cursor-pointer rounded-lg p-1.5 text-(--text-muted) opacity-0 transition-all group-hover:opacity-100"
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
            <div class="flex items-center justify-between border-t border-(--border-color) px-6 py-4">
              <div class="text-sm text-(--text-secondary)">
                <span v-if="poItems.length > 0">
                  {{ poItems.length }} {{ t('purchaseOrder.form.itemsCount') }} · {{ t('purchaseOrder.form.totalQty') }}: <strong class="font-[Outfit]">{{ totalCreateQty }}</strong>
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)" @click="showCreateModal = false">
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  :disabled="poItems.length === 0"
                  class="bg-primary cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="showShortageConfirm = false"></div>
          <div class="relative w-full max-w-md rounded-2xl bg-(--color-modal-bg) p-6 shadow-xl">
            <div class="mb-4 flex items-center gap-3">
              <div class="bg-warning/10 flex size-10 items-center justify-center rounded-full">
                <AppIcon name="exclamation-triangle" class="text-warning size-5" />
              </div>
              <h3 class="text-base font-bold text-(--text-main)">{{ t('purchaseOrder.form.confirmShortageTitle') }}</h3>
            </div>
            <p class="mb-5 text-sm text-(--text-secondary)">{{ t('purchaseOrder.form.confirmShortage') }}</p>
            <div class="border-warning/20 bg-warning/5 mb-5 max-h-40 overflow-y-auto rounded-xl border p-3">
              <div v-for="item in shortageItems" :key="`${item.product_id || 'p'}-${item.variant_id || 'v'}`" class="flex items-center justify-between py-1 text-sm">
                <span class="text-(--text-main)">{{ item.product_name }}</span>
                <span class="text-danger font-[Outfit]">
                  {{ item.quantity }} / {{ item.required_quantity }}
                </span>
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <button type="button" class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-hover)" @click="showShortageConfirm = false">
                {{ t('common.cancel') }}
              </button>
              <button type="button" class="bg-warning cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:opacity-90" @click="executeCreate">
                {{ t('purchaseOrder.form.confirmCreate') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- 预定单 / 商品 选择弹窗 -->
    <OrderPickerModal :visible="showOrderPicker" :exclude-ids="excludeOrderIds" @close="showOrderPicker = false" @confirm="handleOrdersSelected" />
    <ProductPickerModal
      :visible="showProductPicker"
      :existing-brands="existingBrands"
      :initial-selected-variant-ids="selectedVariantIdsForPicker"
      @close="showProductPicker = false"
      @confirm="handleProductsSelected"
    />

    <!-- ==================== 智能建议 Modal ==================== -->
    <Teleport to="body">
      <transition name="fade">
        <div v-if="showSuggestions" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="showSuggestions = false"></div>
          <div class="relative w-full max-w-3xl rounded-2xl bg-(--color-modal-bg) p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold text-(--text-main)">{{ t('purchaseOrder.suggestions.title') }}</h2>
                <p class="mt-0.5 text-sm text-(--text-secondary)">{{ t('purchaseOrder.suggestions.subtitle') }}</p>
              </div>
              <button class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)" @click="showSuggestions = false">
                <AppIcon name="x-mark" class="size-5" />
              </button>
            </div>

            <div v-if="suggestionsLoading" class="flex items-center justify-center py-12">
              <div class="border-primary size-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
            <div v-else-if="suggestions.length === 0" class="py-12 text-center">
              <AppIcon name="light-bulb" class="mx-auto size-10 text-(--text-muted)" />
              <p class="mt-3 text-sm text-(--text-secondary)">{{ t('purchaseOrder.suggestions.empty') }}</p>
            </div>
            <div v-else class="max-h-96 space-y-2 overflow-y-auto">
              <div
                v-for="s in suggestions"
                :key="`${s.product_id}-${s.variant_id || 'no-variant'}`"
                class="flex items-center justify-between rounded-xl border border-(--border-subtle) p-3 transition-colors hover:bg-(--bg-hover)"
              >
                <div class="flex items-center gap-3">
                  <input v-model="selectedSuggestions" :value="s" type="checkbox" class="text-primary size-4 cursor-pointer rounded border-(--border-color) focus:ring-primary" />
                  <div>
                    <div class="text-sm font-medium text-(--text-main)">{{ s.product_name }}</div>
                    <div class="text-xs text-(--text-secondary)">
                      {{ s.sku }} · {{ s.brand }}
                      <template v-if="s.variant_options && Object.keys(s.variant_options).length > 0">
                        · {{ Object.values(s.variant_options).join(' / ') }}
                      </template>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-xs">
                  <span class="text-danger font-semibold">{{ t('purchaseOrder.suggestions.shortage') }}: {{ s.shortage }}</span>
                  <span class="text-(--text-secondary)">{{ t('purchaseOrder.suggestions.stock') }}: {{ s.stock_quantity }}</span>
                  <span class="font-[Outfit] text-(--text-secondary)">成本 ¥{{ (s.variant_cost_price || s.cost_price || 0).toFixed(2) }}</span>
                  <span class="font-[Outfit] text-(--text-secondary)">建议 ¥{{ (s.suggested_purchase_price || s.cost_price || 0).toFixed(2) }}</span>
                  <span v-if="s.last_purchase_price != null" class="font-[Outfit] text-(--text-secondary)">
                    最近 ¥{{ Number(s.last_purchase_price).toFixed(2) }}
                  </span>
                  <span
                    v-if="s.price_delta != null"
                    class="font-[Outfit] font-semibold"
                    :class="s.price_delta > 0 ? 'text-warning' : s.price_delta < 0 ? 'text-success' : 'text-(--text-secondary)'"
                  >
                    Δ {{ s.price_delta > 0 ? '+' : '' }}{{ Number(s.price_delta).toFixed(2) }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="suggestions.length > 0" class="mt-4 flex justify-end gap-3">
              <button
                class="bg-primary cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-inverse) transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onActivated, onDeactivated, watch } from 'vue';

const getFileUrl = (id) => `/file/${id}`;
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { usePurchaseOrderModals } from '@/composables/usePurchaseOrderModals';
import { useToast } from '@/composables/useToast';
import { useAI } from '@/composables/useAI';
import { validateOrderQuantity } from '@/utils/purchase-order-constraints';
import { reconcileVariantSelection } from '@/utils/purchase-order-variant-selection';
import OrderPickerModal from '@/components/purchase-order/OrderPickerModal.vue';
import ProductPickerModal from '@/components/purchase-order/ProductPickerModal.vue';
import ProductDetailModal from '@/components/product/ProductDetailModal.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppFilterBar from '@/components/ui/AppFilterBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';

const { t } = useI18n();
const {
  list, total, loading, error, errorCode, detail, detailLoading,
  suggestions, suggestionsLoading, stats,
  filters, statusConfig,
  loadList, loadStats, loadDetail,
  createPO, createFromOrders, updateStatus,
  loadSuggestions, addItems, removeItem, updateItem,
} = usePurchaseOrders();

const route = useRoute();
const router = useRouter();
const { addToast } = useToast();
const { setContext } = useAI();

// ─── 本地状态 ────────────────────────────────────────

const {
  showDetail,
  showCreateModal,
  showSuggestions,
  showOrderPicker,
  showProductPicker,
  pickerTarget,
  showShortageConfirm,
  confirmData,
  viewProductId,
  detailFocusedVariantId: getDetailFocusedVariantId,
  openOrderPicker,
  openProductPicker,
} = usePurchaseOrderModals();

const handleViewProductDetail = (id) => {
  viewProductId.value = id;
};

// 复用常量与逻辑
const createForm = reactive({
  remark: '',
  estimated_shipping_cost: 0,
  estimated_tariff_cost: 0,
  allocation_method: 'by_quantity',
});

const poItems = reactive([]);
const selectedSuggestions = ref([]);

// ─── 计算属性 ────────────────────────────────────────

const statCards = computed(() => {
  if (!stats.value) return [];
  return [
    { key: '', label: t('purchaseOrder.filter.all'), count: stats.value.total || 0 },
    { key: 'draft', label: t('purchaseOrder.status.draft'), count: stats.value.draft_count || 0 },
    { key: 'ordered', label: t('purchaseOrder.status.ordered'), count: stats.value.ordered_count || 0 },
    { key: 'shipping', label: t('purchaseOrder.status.shipping'), count: stats.value.shipping_count || 0 },
    { key: 'arrived', label: t('purchaseOrder.status.arrived'), count: stats.value.arrived_count || 0 },
    { key: 'completed', label: t('purchaseOrder.status.completed'), count: stats.value.completed_count || 0 },
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
    return 'border-(--border-subtle) bg-(--bg-muted) text-(--text-muted)';
  }
  const currentIndex = getStepIndex(currentStatus);
  const stepIndex = getStepIndex(stepStatus);
  
  if (currentIndex > stepIndex) {
    return 'border-primary bg-primary text-(--text-inverse)';
  } else if (currentIndex === stepIndex) {
    return 'border-primary bg-(--bg-card)';
  } else {
    return 'border-(--border-strong) bg-(--bg-muted)';
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


const columns = computed(() => [
  { key: 'po_no', label: t('purchaseOrder.table.poNo') },
  { key: 'status', label: t('purchaseOrder.table.status') },
  { key: 'item_count', label: t('purchaseOrder.table.itemCount'), align: 'center' },
  { key: 'total_goods_cost', label: t('purchaseOrder.table.totalGoodsCost') },
  { key: 'remark', label: t('purchaseOrder.form.remark') },
  { key: 'created_at', label: t('purchaseOrder.table.createdAt') },
]);

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
// (已通过 usePurchaseOrderModals 处理方法定义)

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

// 从变体选择器接收“最终选中集”并增删同步采购明细
const handleProductsSelected = async ({ selectedVariantIds = [], selectedVariants = [] } = {}) => {
  if (pickerTarget.value === 'create') {
    const { toAdd, toRemoveVariantIds } = reconcileVariantSelection({
      currentItems: poItems,
      selectedVariants,
      selectedVariantIds,
    });

    if (toRemoveVariantIds.length > 0) {
      for (let i = poItems.length - 1; i >= 0; i--) {
        if (!poItems[i].pre_order_id && toRemoveVariantIds.includes(poItems[i].variant_id)) {
          poItems.splice(i, 1);
        }
      }
    }
    if (toAdd.length > 0) {
      poItems.push(...toAdd);
    }
    return;
  }

  if (pickerTarget.value === 'detail' && detail.value) {
    const currentItems = (detail.value.items || []).filter((item) => !item.pre_order_id && item.variant_id);
    const { toAdd, toRemoveItemIds } = reconcileVariantSelection({
      currentItems,
      selectedVariants,
      selectedVariantIds,
    });

    if (toRemoveItemIds.length > 0) {
      await Promise.all(toRemoveItemIds.map((itemId) => removeItem(detail.value.id, itemId)));
    }
    if (toAdd.length > 0) {
      const newItems = toAdd.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        pre_order_id: null,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }));
      await addItems(detail.value.id, newItems);
    }

    if (toRemoveItemIds.length > 0 || toAdd.length > 0) {
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
const selectedVariantIdsForPicker = computed(() => {
  const items = pickerTarget.value === 'detail' && detail.value ? (detail.value.items || []) : poItems;
  return [...new Set(items.filter((i) => !i.pre_order_id && i.variant_id).map((i) => i.variant_id))];
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

const detailFocusedVariantId = computed(() => getDetailFocusedVariantId(detail.value));

watch([showProductPicker, selectedVariantIdsForPicker, viewProductId, showDetail, detailFocusedVariantId, () => route.query.variantId], ([pickerOpen, selectedVariantIds, productId, detailOpen, detailVariantId, routeVariantId]) => {
  if (pickerOpen) {
    setContext({
      selectedId: selectedVariantIds[0] || null,
      selectedType: 'variant',
    });
    return;
  }
  if (productId) {
    setContext({
      selectedId: productId,
      selectedType: 'product',
    });
    return;
  }
  if (detailOpen && detailVariantId) {
    setContext({
      selectedId: detailVariantId,
      selectedType: 'variant',
    });
    return;
  }
  if (typeof routeVariantId === 'string' && routeVariantId.trim()) {
    setContext({
      selectedId: routeVariantId.trim(),
      selectedType: 'variant',
    });
    return;
  }
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

onDeactivated(() => {
  setContext({
    selectedId: null,
    selectedType: null,
  });
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
