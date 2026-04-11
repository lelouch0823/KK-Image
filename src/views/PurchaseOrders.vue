<template>
  <div class="space-y-6">
    <div
      v-if="errorCode === 'FORBIDDEN'"
      class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8"
    >
      <PermissionDeniedState
        title="采购单权限不足"
        :description="
          error || '当前账号没有采购单读取权限，请联系管理员分配 purchase_orders:read。'
        "
        home-to="/admin/forbidden"
        home-text="查看权限说明"
        @retry="loadList"
      />
    </div>
    <template v-else>
      <ManagementListShell
        :title="t('purchaseOrder.title')"
        :description="t('purchaseOrder.subtitle')"
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

        <template #content>
          <!-- ===== 统计卡片：骨架屏 or 真实数据 ===== -->
          <section
            data-testid="purchase-order-console-banner"
            class="relative overflow-hidden rounded-[1.75rem] border border-(--border-color)/60 bg-(--bg-card) p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)] sm:p-5"
          >
            <div
              class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.06),transparent_24%)]"
            ></div>
            <div class="relative space-y-4">
              <div class="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div>
                    <h2 class="text-lg font-semibold text-(--text-main)">
                      {{ t('purchaseOrder.title') }}
                    </h2>
                    <p class="mt-1 max-w-2xl text-sm leading-6 text-(--text-secondary)">
                      {{ t('purchaseOrder.subtitle') }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center lg:justify-end">
                  <span
                    class="inline-flex items-center rounded-full border border-(--border-color)/70 bg-(--bg-card)/80 px-3 py-1 text-[11px] font-medium text-(--text-secondary)"
                  >
                    {{ t('purchaseOrder.pagination.total', { count: total }) }}
                  </span>
                </div>
              </div>

              <div
                data-testid="purchase-order-overview-strip"
                class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
              >
                <template v-if="loading && !stats">
                  <!-- 骨架卡片 ×6 -->
                  <div
                    v-for="i in 6"
                    :key="'sk-card-' + i"
                    class="relative overflow-hidden rounded-2xl border border-(--border-color)/60 bg-(--bg-card)/90 p-4 shadow-none backdrop-blur sm:p-5"
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
                  <MetricTile
                    v-for="card in statCards"
                    :key="card.key"
                    :label="card.label"
                    :value="card.count"
                    :icon="card.icon"
                    :tone="card.tone"
                    :active="filters.status === card.key"
                    flat
                    clickable
                    @click="toggleStatusFilter(card.key)"
                  />
                </template>
              </div>

              <div v-if="consoleSignals.length > 0" class="grid gap-3 md:grid-cols-3">
                <article
                  v-for="signal in consoleSignals"
                  :key="signal.key"
                  class="rounded-[1.1rem] border border-(--border-color)/55 bg-(--bg-card)/92 p-4"
                >
                  <p
                    class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                  >
                    {{ signal.label }}
                  </p>
                  <div class="mt-2">
                    <div>
                      <div class="font-mono text-2xl font-semibold text-(--text-main) tabular-nums">
                        {{ signal.value }}
                      </div>
                      <p class="mt-1 text-xs leading-5 text-(--text-secondary)">
                        {{ signal.hint }}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <!-- ===== 数据表格：AppTable ===== -->
          <AppTable
            :columns="columns"
            :data="list"
            :loading="loading"
            :empty-text="t('purchaseOrder.empty')"
            no-border
            @row-click="(row) => openDetail(row.id)"
          >
            <template #toolbar>
              <div
                class="mb-3 flex flex-col gap-2 border-b border-(--border-color)/35 px-1 pb-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <h3 class="text-sm font-semibold text-(--text-main)">Order Ledger</h3>
                  <p class="mt-1 text-xs text-(--text-secondary)">
                    {{
                      t(
                        'purchaseOrder.ui.tableHint',
                        '主状态和到货进度在同一列聚合展示，便于快速扫读链路卡点。'
                      )
                    }}
                  </p>
                </div>
                <div class="text-xs text-(--text-secondary) lg:text-right">
                  {{ t('purchaseOrder.ui.liveHint', '点击行可查看采购链路详情') }}
                </div>
              </div>
            </template>

            <!-- 采购单编号 -->
            <template #cell-po_no="{ row: po }">
              <code
                data-testid="purchase-order-po-chip"
                class="inline-flex items-center rounded-full border border-(--border-color)/70 bg-(--bg-muted) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.04em] text-(--text-main)"
              >
                {{ po.po_no }}
              </code>
            </template>

            <template #cell-status="{ row: po }">
              <div class="flex flex-col items-start gap-1.5">
                <StatusBadge
                  v-if="po.status"
                  data-testid="purchase-order-status-badge"
                  :variant="
                    ['draft', 'cancelled'].includes(po.status)
                      ? 'default'
                      : ['ordered'].includes(po.status)
                        ? 'warning'
                        : po.status === 'shipping'
                          ? 'purple'
                          : po.status === 'arrived'
                            ? 'info'
                            : 'success'
                  "
                  class="ring-1 ring-black/5"
                >
                  {{ statusConfig[po.status]?.label || po.status }}
                </StatusBadge>
                <template
                  v-if="po.display_status || po.ordered_qty || po.received_qty || po.cancelled_qty"
                >
                  <StatusBadge
                    data-testid="purchase-order-progress-badge"
                    :variant="getProgressStatusVariant(po.display_status)"
                    class="text-[10px]"
                  >
                    {{ getProgressStatusLabel(po.display_status) }}
                  </StatusBadge>
                  <span
                    data-testid="purchase-order-progress-summary"
                    class="text-[11px] text-(--text-secondary)"
                  >
                    {{ buildReceiptProgressSummary(po) }}
                  </span>
                </template>
              </div>
            </template>

            <!-- 商品数 -->
            <template #cell-item_count="{ row: po }">
              <span class="font-medium text-(--text-main)">{{ po.item_count || 0 }}</span>
            </template>

            <!-- 商品总金额 -->
            <template #cell-total_goods_cost="{ row: po }">
              <span
                data-testid="purchase-order-total-cost"
                class="inline-flex min-w-[7.5rem] justify-end font-mono text-sm font-semibold text-(--text-main) tabular-nums"
              >
                {{ formatPurchaseCurrency(po.total_goods_cost, po.currency) }}
              </span>
            </template>

            <!-- 备注 -->
            <template #cell-remark="{ row: po }">
              <span class="max-w-[150px] truncate text-(--text-secondary)" :title="po.remark">{{
                po.remark || '-'
              }}</span>
            </template>

            <!-- 创建时间 -->
            <template #cell-created_at="{ row: po }">
              <span class="text-(--text-secondary)">{{ formatDate(po.created_at) }}</span>
            </template>
          </AppTable>

          <!-- 分页 -->
          <div
            v-if="total > filters.limit"
            class="flex items-center justify-between border-t border-(--border-color)/70 bg-(--bg-muted)/35 px-4 py-3"
          >
            <p class="text-sm text-(--text-secondary)">
              {{ t('purchaseOrder.pagination.total', { count: total }) }}
            </p>
            <div class="flex items-center gap-2">
              <button
                :disabled="filters.page <= 1"
                class="cursor-pointer rounded-lg border border-(--border-color) px-3 py-1.5 text-sm transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
                @click="changePage(-1)"
              >
                ← {{ t('purchaseOrder.pagination.prev') }}
              </button>
              <button
                :disabled="filters.page * filters.limit >= total"
                class="cursor-pointer rounded-lg border border-(--border-color) px-3 py-1.5 text-sm transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
                @click="changePage(1)"
              >
                {{ t('purchaseOrder.pagination.next') }} →
              </button>
            </div>
          </div>

          <!-- ==================== 详情面板 (弹窗) ==================== -->
          <Teleport to="body">
            <transition name="fade">
              <div
                v-if="showDetail"
                data-testid="purchase-order-detail-shell"
                class="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <!-- 背景遮罩 -->
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="showDetail = false"
                ></div>
                <!-- 面板 -->
                <div
                  class="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.4)]"
                  style="max-height: calc(100vh - 3rem)"
                >
                  <div
                    data-testid="purchase-order-detail-summary"
                    class="relative flex shrink-0 items-center justify-between border-b border-(--border-color)/70 bg-(--bg-card) px-6 py-5"
                  >
                    <div class="min-w-0">
                      <p
                        class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                      >
                        Purchase Order Chain
                      </p>
                      <h2 class="truncate text-lg font-semibold text-(--text-main)">
                        {{ detail?.po_no || t('purchaseOrder.detail.title') || '采购单详情' }}
                      </h2>
                      <span
                        v-if="detail?.status"
                        data-testid="purchase-order-detail-status-chip"
                        class="mt-2 inline-flex items-center rounded-full border border-(--border-color)/65 px-2.5 py-0.5 text-xs font-semibold"
                        :style="{
                          color: statusConfig[detail.status]?.color || 'inherit',
                          backgroundColor: statusConfig[detail.status]?.bg || 'var(--bg-muted)',
                        }"
                      >
                        {{ statusConfig[detail.status]?.label || detail.status }}
                      </span>
                    </div>
                    <div class="relative flex items-center gap-2">
                      <StatusBadge
                        v-if="
                          detail?.display_status ||
                          detail?.ordered_qty ||
                          detail?.received_qty ||
                          detail?.cancelled_qty
                        "
                        :variant="getProgressStatusVariant(detail?.display_status)"
                        class="hidden sm:inline-flex"
                      >
                        {{ getProgressStatusLabel(detail?.display_status) }}
                      </StatusBadge>
                      <button
                        class="cursor-pointer rounded-xl p-2 text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
                        @click="showDetail = false"
                      >
                        <AppIcon name="x-mark" class="size-5" />
                      </button>
                    </div>
                  </div>

                  <div class="flex h-full min-h-0 flex-col">
                    <div
                      v-if="_detailLoading"
                      class="border-b border-(--border-color) bg-(--bg-muted)/55 px-6 py-4"
                    >
                      <div class="flex items-start gap-4">
                        <div
                          class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
                        >
                          <AppIcon name="spinner" class="size-5 animate-spin" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-sm font-semibold text-(--text-main)">
                            {{ t('purchaseOrder.detail.loadingTitle', '正在刷新采购单详情') }}
                          </p>
                          <p class="mt-1 text-sm text-(--text-secondary)">
                            {{
                              t(
                                'purchaseOrder.detail.loadingBody',
                                '先展示详情容器，完整采购单信息会在后台补齐。'
                              )
                            }}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      v-else-if="!detail"
                      role="alert"
                      class="flex min-h-[240px] items-center justify-center px-6 py-10 text-center text-(--text-secondary)"
                    >
                      <div>
                        <p class="text-sm font-medium text-(--text-main)">
                          {{ t('purchaseOrder.error.notFound') }}
                        </p>
                        <p class="mt-2 text-sm">
                          {{
                            t(
                              'purchaseOrder.detail.loadFailedHint',
                              '未能加载采购单详情，请关闭后重试。'
                            )
                          }}
                        </p>
                        <button
                          type="button"
                          data-testid="purchase-order-detail-retry"
                          class="bg-primary mt-4 rounded-lg px-4 py-2 text-sm font-medium text-(--text-inverse) transition-colors hover:bg-primary/90"
                          @click="retryDetail"
                        >
                          {{ t('common.retry') }}
                        </button>
                      </div>
                    </div>

                    <div v-else class="flex-1 space-y-6 overflow-y-auto p-6">
                      <section
                        data-testid="purchase-order-detail-hero"
                        class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                      >
                        <article
                          v-for="card in detailSummaryCards"
                          :key="card.key"
                          class="rounded-[1.25rem] border border-(--border-color)/60 bg-(--bg-card) p-4 shadow-none"
                        >
                          <p
                            class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                          >
                            {{ card.label }}
                          </p>
                          <div
                            class="mt-2 font-mono text-xl font-semibold text-(--text-main) tabular-nums"
                          >
                            {{ card.value }}
                          </div>
                          <p class="mt-1 text-xs leading-5 text-(--text-secondary)">
                            {{ card.hint }}
                          </p>
                        </article>
                      </section>
                      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.95fr)]">
                        <!-- 状态可视化 (Stepper) -->
                        <div
                          data-testid="purchase-order-detail-progress"
                          class="rounded-[1.5rem] border border-(--border-color)/65 bg-(--bg-card) p-5 shadow-none"
                        >
                          <div class="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p
                                class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                              >
                                Workflow
                              </p>
                              <h3 class="text-sm font-semibold text-(--text-main)">
                                {{ t('purchaseOrder.detail.title', '采购单详情') }}
                              </h3>
                            </div>
                            <div class="flex flex-col items-end gap-1.5">
                              <span
                                class="rounded-full bg-(--bg-muted) px-2.5 py-1 text-xs font-medium text-(--text-secondary)"
                              >
                                {{ statusConfig[detail.status]?.label || detail.status }}
                              </span>
                              <template
                                v-if="
                                  detail.display_status ||
                                  detail.ordered_qty ||
                                  detail.received_qty ||
                                  detail.cancelled_qty
                                "
                              >
                                <StatusBadge
                                  data-testid="purchase-order-detail-progress-badge"
                                  :variant="getProgressStatusVariant(detail.display_status)"
                                  class="text-[10px]"
                                >
                                  {{ getProgressStatusLabel(detail.display_status) }}
                                </StatusBadge>
                                <span
                                  data-testid="purchase-order-detail-progress-summary"
                                  class="text-right text-[11px] text-(--text-secondary)"
                                >
                                  {{ buildReceiptProgressSummary(detail) }}
                                </span>
                              </template>
                            </div>
                          </div>
                          <div class="relative flex items-center justify-between">
                            <div
                              class="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-(--border-color)"
                            ></div>
                            <div
                              class="bg-primary absolute top-1/2 left-0 h-0.5 -translate-y-1/2 transition-all duration-500"
                              :style="{ width: getStepperProgress(detail.status) }"
                            ></div>

                            <div
                              v-for="step in stepsList"
                              :key="step.value"
                              class="relative z-10 flex flex-col items-center gap-2"
                            >
                              <div
                                class="flex size-7 items-center justify-center rounded-full border-2 transition-colors duration-300"
                                :class="getStepIconClasses(detail.status, step.value)"
                              >
                                <AppIcon
                                  v-if="isStepCompleted(detail.status, step.value)"
                                  name="check"
                                  class="size-3.5 text-(--text-inverse)"
                                  stroke-width="3"
                                />
                                <div
                                  v-else-if="detail.status === step.value"
                                  class="bg-primary size-2 rounded-full"
                                ></div>
                              </div>
                              <span
                                class="text-center text-xs font-medium"
                                :class="
                                  detail.status === step.value
                                    ? 'text-(--text-main)'
                                    : isStepCompleted(detail.status, step.value)
                                      ? 'text-(--text-main)'
                                      : 'text-(--text-muted)'
                                "
                              >
                                {{ step.label }}
                              </span>
                            </div>
                          </div>
                        </div>

                        <!-- 费用信息 -->
                        <div
                          data-testid="purchase-order-detail-cost"
                          class="rounded-[1.5rem] border border-(--border-color)/65 bg-(--bg-card) p-5 shadow-none"
                        >
                          <div class="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p
                                class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                              >
                                Cost Summary
                              </p>
                              <h3 class="text-sm font-semibold text-(--text-main)">
                                {{ t('purchaseOrder.detail.costInfo') }}
                              </h3>
                            </div>
                            <div class="flex flex-wrap items-center justify-end gap-2">
                              <span
                                class="rounded-full border border-(--border-color) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)"
                              >
                                {{ detail.currency || 'CNY' }}
                              </span>
                              <span
                                class="rounded-full border border-(--border-color) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)"
                              >
                                {{
                                  detail.allocation_method === 'by_value'
                                    ? t('purchaseOrder.form.byValue')
                                    : t('purchaseOrder.form.byQuantity')
                                }}
                              </span>
                              <button
                                type="button"
                                data-testid="purchase-order-open-cost-modal"
                                class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--border-color) bg-(--bg-card)/85 px-3 py-1.5 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover)"
                                @click="openCostModal"
                              >
                                <AppIcon name="pencil-square" class="size-3.5" />
                                {{ t('purchaseOrder.action.settle', '填写实际费用') }}
                              </button>
                            </div>
                          </div>
                          <div class="grid grid-cols-2 gap-3">
                            <div class="rounded-xl bg-(--bg-muted)/55 p-3">
                              <div class="text-xs text-(--text-secondary)">
                                {{ t('purchaseOrder.form.estimatedShipping') }}
                              </div>
                              <div
                                class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums"
                              >
                                {{
                                  formatPurchaseCurrency(
                                    detail.estimated_shipping_cost,
                                    detail.currency
                                  )
                                }}
                              </div>
                            </div>
                            <div class="rounded-xl bg-(--bg-muted)/55 p-3">
                              <div class="text-xs text-(--text-secondary)">
                                {{ t('purchaseOrder.form.estimatedTariff') }}
                              </div>
                              <div
                                class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums"
                              >
                                {{
                                  formatPurchaseCurrency(
                                    detail.estimated_tariff_cost,
                                    detail.currency
                                  )
                                }}
                              </div>
                            </div>
                            <div class="rounded-xl bg-(--bg-muted)/40 p-3">
                              <div class="text-xs text-(--text-secondary)">
                                {{ t('purchaseOrder.table.actualShipping') }}
                              </div>
                              <div
                                class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums"
                              >
                                {{
                                  formatPurchaseCurrency(
                                    detail.actual_shipping_cost,
                                    detail.currency
                                  )
                                }}
                              </div>
                            </div>
                            <div class="rounded-xl bg-(--bg-muted)/40 p-3">
                              <div class="text-xs text-(--text-secondary)">
                                {{ t('purchaseOrder.table.actualTariff') }}
                              </div>
                              <div
                                class="mt-1 font-mono text-base font-semibold text-(--text-main) tabular-nums"
                              >
                                {{
                                  formatPurchaseCurrency(detail.actual_tariff_cost, detail.currency)
                                }}
                              </div>
                            </div>
                          </div>
                          <p class="mt-3 text-xs leading-5 text-(--text-secondary)">
                            {{
                              t(
                                'purchaseOrder.ui.costFallbackHint',
                                '未填写实际费用时，成本分摊会回退使用预估运费与预估关税。'
                              )
                            }}
                          </p>
                        </div>
                      </div>

                      <!-- 明细列表 -->
                      <div
                        data-testid="purchase-order-detail-items"
                        class="rounded-[1.6rem] border border-(--border-color)/65 bg-(--bg-card) p-4 shadow-none"
                      >
                        <div
                          class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <p
                              class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                            >
                              Line Items
                            </p>
                            <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                              {{ t('purchaseOrder.detail.items') }} ({{
                                detail.items?.length || 0
                              }})
                            </h3>
                          </div>
                          <div v-if="detail.status === 'draft'" class="flex items-center gap-2">
                            <button
                              type="button"
                              class="border-primary/30 bg-primary/5 text-primary flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-primary/10"
                              @click="openOrderPicker('detail')"
                            >
                              <AppIcon name="plus" class="size-3.5" />
                              {{ t('purchaseOrder.action.linkOrders') }}
                            </button>
                            <button
                              type="button"
                              class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--border-color) px-2.5 py-1.5 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover)"
                              @click="openProductPicker('detail')"
                            >
                              <AppIcon name="plus" class="size-3.5" />
                              {{ t('purchaseOrder.action.addProduct') }}
                            </button>
                          </div>
                        </div>
                        <div v-if="detail.items && detail.items.length > 0" class="space-y-3">
                          <div
                            v-for="item in detail.items"
                            :key="item.id"
                            data-testid="purchase-order-detail-item-card"
                            class="group grid gap-3 rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card) p-3.5 transition-colors duration-200 hover:border-primary/20 hover:bg-(--bg-hover) sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,14rem)] sm:items-stretch"
                          >
                            <div class="flex min-w-0 items-start gap-3">
                              <!-- 商品主图 -->
                              <div
                                class="size-14 shrink-0 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-muted) shadow-sm"
                              >
                                <AppImage
                                  v-if="item.product_images?.[0]"
                                  :src="getFileUrl(item.product_images[0])"
                                  :alt="item.product_name"
                                  class="size-full object-cover"
                                />
                                <div v-else class="flex size-full items-center justify-center">
                                  <AppIcon name="photo" class="size-6 text-(--text-muted)" />
                                </div>
                              </div>

                              <!-- 商品信息 -->
                              <div class="flex min-w-0 flex-col gap-1.5">
                                <div
                                  class="hover:text-primary flex min-w-0 cursor-pointer items-center gap-2 transition-colors"
                                  @click="handleViewProductDetail(item.product_id)"
                                >
                                  <span
                                    class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
                                    :title="item.product_name"
                                    >{{ item.product_name || '—' }}</span
                                  >
                                  <span
                                    v-if="item.product_brand"
                                    class="max-w-[8rem] shrink-0 truncate rounded-full border border-(--border-color)/70 bg-(--bg-muted) px-2 py-0.5 text-[10px] font-medium text-(--text-secondary)"
                                    :title="item.product_brand"
                                    >{{ item.product_brand }}</span
                                  >
                                  <span
                                    v-if="detail.status === 'draft'"
                                    class="text-danger flex shrink-0 cursor-pointer items-center gap-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                    @click="handleDetailRemoveItem(item.id)"
                                  >
                                    <AppIcon name="trash" class="size-3" />
                                    {{ t('common.delete') }}
                                  </span>
                                </div>
                                <div
                                  class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)"
                                >
                                  <code
                                    class="max-w-[10rem] truncate rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px]"
                                    :title="item.variant_sku || item.product_sku || '-'"
                                    >{{ item.variant_sku || item.product_sku || '-' }}</code
                                  >
                                  <span class="text-(--text-muted)">·</span>
                                  <span
                                    v-if="item.customer_order_no"
                                    class="bg-info/10 text-info inline-flex max-w-[12rem] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                    :title="item.customer_order_no"
                                  >
                                    <AppIcon name="shopping-bag" class="size-3" />
                                    {{ item.customer_order_no }}
                                  </span>
                                  <span
                                    v-else
                                    class="bg-warning/10 text-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  >
                                    <AppIcon name="building-storefront" class="size-3" />
                                    {{ t('purchaseOrder.detail.publicStock') }}
                                  </span>
                                </div>
                                <div
                                  v-if="
                                    item.variant_options &&
                                    Object.keys(item.variant_options).length > 0
                                  "
                                  data-testid="purchase-order-detail-item-variant-options"
                                  class="mt-0.5 flex min-w-0 flex-wrap gap-1"
                                >
                                  <span
                                    v-for="(val, key) in item.variant_options"
                                    :key="`variant-${key}`"
                                    class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium break-all"
                                    :title="`${key}: ${val}`"
                                  >
                                    {{ key }}: {{ val }}
                                  </span>
                                </div>
                                <!-- Specs -->
                                <div
                                  v-if="
                                    item.product_specifications &&
                                    Object.keys(item.product_specifications).length > 0
                                  "
                                  class="mt-0.5 flex min-w-0 flex-wrap gap-1"
                                >
                                  <span
                                    v-for="(val, key) in item.product_specifications"
                                    :key="key"
                                    class="max-w-full rounded border border-(--border-subtle) bg-(--bg-page) px-1.5 py-0.5 text-[10px] break-all text-(--text-secondary)"
                                    :title="`${key}: ${val}`"
                                  >
                                    {{ key }}: {{ val }}
                                  </span>
                                </div>
                                <div
                                  v-if="detail.status !== 'draft'"
                                  data-testid="purchase-order-detail-item-progress"
                                  class="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-(--text-secondary)"
                                >
                                  <StatusBadge
                                    :variant="
                                      getProgressStatusVariant(
                                        item.display_status || detail.display_status
                                      )
                                    "
                                    class="text-[10px]"
                                  >
                                    {{
                                      getProgressStatusLabel(
                                        item.display_status || detail.display_status
                                      )
                                    }}
                                  </StatusBadge>
                                  <span>{{ buildReceiptProgressSummary(item) }}</span>
                                  <span v-if="hasReceiptMeta(item)">{{
                                    buildReceiptMeta(item)
                                  }}</span>
                                </div>
                              </div>
                            </div>

                            <div
                              v-if="detail.status === 'draft'"
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
                            >
                              <div class="grid grid-cols-2 gap-3">
                                <div class="flex flex-col">
                                  <span class="mb-1 text-[10px] text-(--text-secondary)">{{
                                    t('purchaseOrder.table.quantity')
                                  }}</span>
                                  <AppInput
                                    v-model="item.quantity"
                                    type="number"
                                    min="1"
                                    class="w-full text-center"
                                    size="sm"
                                    @change="
                                      handleDetailUpdateItem(item.id, 'quantity', item.quantity)
                                    "
                                  />
                                </div>
                                <div class="flex flex-col">
                                  <span class="mb-1 text-[10px] text-(--text-secondary)">{{
                                    t('purchaseOrder.table.unitCost')
                                  }}</span>
                                  <div class="relative">
                                    <span
                                      class="absolute top-1.5 left-2 text-xs text-(--text-secondary)"
                                      >¥</span
                                    >
                                    <AppInput
                                      v-model="item.unit_cost"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      class="w-full pr-2 pl-5 text-right"
                                      size="sm"
                                      @change="
                                        handleDetailUpdateItem(item.id, 'unit_cost', item.unit_cost)
                                      "
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div
                              v-else
                              class="flex flex-col justify-between rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
                            >
                              <div class="space-y-2">
                                <div class="flex items-center justify-between gap-3">
                                  <span class="text-[11px] font-medium text-(--text-secondary)">{{
                                    t('purchaseOrder.table.quantity')
                                  }}</span>
                                  <span
                                    class="font-mono text-sm font-semibold text-(--text-main) tabular-nums"
                                    >×{{ item.quantity }}</span
                                  >
                                </div>
                                <div class="flex items-center justify-between gap-3">
                                  <span class="text-[11px] font-medium text-(--text-secondary)">{{
                                    t('purchaseOrder.table.unitCost')
                                  }}</span>
                                  <span
                                    class="font-mono text-sm font-semibold text-(--text-main) tabular-nums"
                                    >{{
                                      formatPurchaseCurrency(item.unit_cost, detail.currency)
                                    }}</span
                                  >
                                </div>
                                <div
                                  class="flex items-center justify-between gap-3 border-t border-(--border-subtle) pt-2"
                                >
                                  <span class="text-[11px] font-medium text-(--text-secondary)">{{
                                    t('purchaseOrder.table.totalGoodsCost')
                                  }}</span>
                                  <span
                                    class="font-mono text-base font-semibold text-(--text-main) tabular-nums"
                                    >{{
                                      formatPurchaseCurrency(
                                        (item.quantity || 0) * (item.unit_cost || 0),
                                        detail.currency
                                      )
                                    }}</span
                                  >
                                </div>
                              </div>
                              <div
                                v-if="item.allocated_freight > 0 || item.allocated_tariff > 0"
                                class="text-xs text-(--text-secondary)"
                              >
                                {{ t('purchaseOrder.allocation.freight') }}
                                {{
                                  formatPurchaseCurrency(item.allocated_freight, detail.currency)
                                }}
                                + {{ t('purchaseOrder.allocation.tariff') }}
                                {{ formatPurchaseCurrency(item.allocated_tariff, detail.currency) }}
                              </div>
                            </div>
                          </div>
                        </div>
                        <p v-else class="py-4 text-center text-sm text-(--text-secondary)">
                          {{ t('purchaseOrder.emptyItems') }}
                        </p>
                      </div>

                      <div
                        data-testid="purchase-order-detail-receipts"
                        class="rounded-[1.6rem] border border-(--border-color)/65 bg-(--bg-card) p-4 shadow-none"
                      >
                        <div
                          class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <p
                              class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                            >
                              Receipt Ledger
                            </p>
                            <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                              {{ t('purchaseOrder.detail.receipts', '收货台账') }}
                              <span
                                class="ml-1 font-mono text-xs font-normal text-(--text-secondary) tabular-nums"
                                >({{ receiptTimeline.length }})</span
                              >
                            </h3>
                            <p class="mt-1 text-xs text-(--text-secondary)">
                              {{
                                t(
                                  'purchaseOrder.ui.receiptLedgerHint',
                                  '登记每次到货与冲销记录，确保采购、订单、库存三条投影保持一致。'
                                )
                              }}
                            </p>
                          </div>
                          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                            <StatusBadge variant="default" class="text-[10px]">
                              {{
                                t('purchaseOrder.ui.receiptLedgerMeta', '支持部分到货与整笔冲销')
                              }}
                            </StatusBadge>
                            <StatusBadge
                              v-if="receiptReceivableCount > 0"
                              variant="info"
                              class="text-[10px]"
                            >
                              {{ t('purchaseOrder.ui.receiptReceivableLines', '待收行') }}
                              {{ receiptReceivableCount }}
                            </StatusBadge>
                            <button
                              v-if="canRecordReceipts"
                              type="button"
                              data-testid="purchase-order-open-receipt-modal"
                              class="bg-primary flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-(--text-inverse) shadow-sm transition-colors hover:bg-primary/90"
                              @click="openReceiptModal"
                            >
                              <AppIcon name="archive-box-arrow-down" class="size-3.5" />
                              {{ t('purchaseOrder.action.recordReceipt', '登记收货') }}
                            </button>
                            <button
                              v-if="canCloseShortages"
                              type="button"
                              data-testid="purchase-order-open-shortage-modal"
                              class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300/70 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
                              @click="openShortageModal"
                            >
                              <AppIcon name="minus-circle" class="size-3.5" />
                              {{ t('purchaseOrder.action.closeOutstanding', '关闭待收') }}
                            </button>
                          </div>
                        </div>

                        <div v-if="receiptTimeline.length > 0" class="space-y-3">
                          <article
                            v-for="receipt in receiptTimeline"
                            :key="receipt.id"
                            data-testid="purchase-order-receipt-card"
                            class="grid gap-3 rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card) p-3.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(14rem,16rem)]"
                          >
                            <div class="min-w-0">
                              <div class="flex min-w-0 flex-wrap items-center gap-2">
                                <span
                                  class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
                                  :title="receipt.product_name"
                                >
                                  {{ receipt.product_name || '—' }}
                                </span>
                                <code
                                  class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)"
                                >
                                  {{ receipt.variant_sku || receipt.product_sku || '—' }}
                                </code>
                                <StatusBadge
                                  :variant="receipt.is_reversed ? 'default' : 'success'"
                                  class="text-[10px]"
                                >
                                  {{
                                    receipt.is_reversed
                                      ? t('purchaseOrder.ui.receiptReversedTag', '已冲销')
                                      : t('purchaseOrder.ui.receiptRecordedTag', '已入账')
                                  }}
                                </StatusBadge>
                                <StatusBadge
                                  v-if="canReverseReceipt(receipt)"
                                  variant="warning"
                                  class="text-[10px]"
                                >
                                  {{ t('purchaseOrder.ui.receiptReversibleTag', '可冲销') }}
                                </StatusBadge>
                              </div>
                              <div
                                class="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)"
                              >
                                <span
                                  >{{ t('purchaseOrder.form.receivedQty', '本次到货') }}
                                  {{ formatInteger(receipt.received_qty) }}</span
                                >
                                <span v-if="receipt.available_reversal_qty > 0"
                                  >· {{ t('purchaseOrder.ui.availableReversalQty', '可冲销量') }}
                                  {{ formatInteger(receipt.available_reversal_qty) }}</span
                                >
                                <span v-if="receipt.reversed_qty > 0"
                                  >· {{ t('purchaseOrder.ui.reversedQty', '已冲销') }}
                                  {{ formatInteger(receipt.reversed_qty) }}</span
                                >
                                <span>· {{ formatDateTime(receipt.received_at) }}</span>
                              </div>
                              <div
                                v-if="
                                  receipt.variant_options &&
                                  Object.keys(receipt.variant_options).length > 0
                                "
                                class="mt-2 flex min-w-0 flex-wrap gap-1"
                              >
                                <span
                                  v-for="(val, key) in receipt.variant_options"
                                  :key="`receipt-variant-${receipt.id}-${key}`"
                                  class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium break-all"
                                >
                                  {{ key }}: {{ val }}
                                </span>
                              </div>
                              <p
                                v-if="receipt.note"
                                class="mt-2 rounded-xl bg-(--bg-muted)/55 px-3 py-2 text-xs leading-5 break-all whitespace-pre-wrap text-(--text-secondary)"
                              >
                                {{ receipt.note }}
                              </p>
                            </div>

                            <div
                              class="flex flex-col justify-between rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
                            >
                              <div class="space-y-2 text-xs text-(--text-secondary)">
                                <div class="flex items-center justify-between gap-3">
                                  <span>{{
                                    t('purchaseOrder.ui.receiptRecordId', '收货记录')
                                  }}</span>
                                  <code class="font-mono text-[11px] text-(--text-main)">{{
                                    receipt.id
                                  }}</code>
                                </div>
                                <div class="flex items-center justify-between gap-3">
                                  <span>{{
                                    t('purchaseOrder.ui.receiptReversalCount', '冲销次数')
                                  }}</span>
                                  <span
                                    class="font-mono text-sm font-semibold text-(--text-main) tabular-nums"
                                    >{{ formatInteger(receipt.reversal_count) }}</span
                                  >
                                </div>
                                <div class="flex items-center justify-between gap-3">
                                  <span>{{
                                    t('purchaseOrder.ui.receiptLastReversedAt', '最近冲销')
                                  }}</span>
                                  <span class="text-right text-(--text-main)">{{
                                    receipt.last_reversed_at
                                      ? formatDateTime(receipt.last_reversed_at)
                                      : '—'
                                  }}</span>
                                </div>
                              </div>
                              <button
                                v-if="canReverseReceipt(receipt)"
                                type="button"
                                data-testid="purchase-order-open-reversal-modal"
                                class="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                                @click="openReceiptReversalModal(receipt)"
                              >
                                <AppIcon name="arrow-uturn-left" class="size-3.5" />
                                {{ t('purchaseOrder.action.reverseReceipt', '冲销收货') }}
                              </button>
                            </div>
                          </article>
                        </div>
                        <div
                          v-else
                          class="rounded-[1.35rem] border border-dashed border-(--border-subtle) bg-(--bg-page)/60 px-4 py-10 text-center"
                        >
                          <div
                            class="mx-auto flex size-12 items-center justify-center rounded-full bg-(--bg-muted)"
                          >
                            <AppIcon name="archive-box" class="size-5 text-(--text-muted)" />
                          </div>
                          <p class="mt-3 text-sm font-medium text-(--text-main)">
                            {{ t('purchaseOrder.ui.receiptLedgerEmptyTitle', '还没有收货记录') }}
                          </p>
                          <p class="mt-1 text-sm text-(--text-secondary)">
                            {{
                              canRecordReceipts
                                ? t(
                                    'purchaseOrder.ui.receiptLedgerEmptyBody',
                                    '当前采购单还有待收货明细，可以登记本次到货。'
                                  )
                                : t(
                                    'purchaseOrder.ui.receiptLedgerLockedBody',
                                    '当前状态下没有可登记的收货明细。'
                                  )
                            }}
                          </p>
                        </div>
                      </div>

                      <!-- 备注 -->
                      <div
                        v-if="detail.remark"
                        class="rounded-2xl border border-(--border-color)/70 bg-(--bg-card) p-4 shadow-sm"
                      >
                        <h3 class="mb-2 text-sm font-semibold text-(--text-main)">
                          {{ t('purchaseOrder.form.remark') }}
                        </h3>
                        <p class="text-sm break-all whitespace-pre-wrap text-(--text-secondary)">
                          {{ detail.remark }}
                        </p>
                      </div>
                    </div>

                    <!-- Footer Fixed Action Bar -->
                    <div
                      v-if="detail"
                      data-testid="purchase-order-detail-footer"
                      class="flex flex-col gap-3 border-t border-(--border-color) bg-(--bg-card) px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                    >
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
                          v-for="ns in nextStatuses.filter((s) => s !== 'cancelled')"
                          :key="ns"
                          class="bg-primary cursor-pointer rounded-xl px-6 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:bg-primary/90 hover:shadow"
                          @click="handleStatusUpdate(ns)"
                        >
                          {{ t('purchaseOrder.action.updateTo') }}:
                          {{ statusConfig[ns]?.label || ns }}
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
              <div
                v-if="showCreateModal"
                data-testid="purchase-order-create-shell"
                class="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="showCreateModal = false"
                ></div>
                <div
                  class="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
                  style="max-height: calc(100vh - 3rem)"
                >
                  <!-- 头部 -->
                  <div
                    class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-sky-50/75 via-(--bg-card) to-amber-50/40 px-6 py-5"
                  >
                    <div
                      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.1),transparent_24%)]"
                    ></div>
                    <div class="relative">
                      <p
                        class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                      >
                        Draft Builder
                      </p>
                      <h2 class="mt-1 text-xl font-bold text-(--text-main)">
                        {{ t('purchaseOrder.action.create') }}
                      </h2>
                      <p class="mt-1 text-sm text-(--text-secondary)">
                        {{
                          t(
                            'purchaseOrder.ui.createHint',
                            '先设置成本策略，再补充采购商品和关联预定单。'
                          )
                        }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
                      @click="showCreateModal = false"
                    >
                      <AppIcon name="x-mark" class="size-5" />
                    </button>
                  </div>

                  <!-- 可滚动主体 -->
                  <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="space-y-5">
                      <section
                        class="rounded-[1.6rem] border border-(--border-color)/70 bg-linear-to-br from-(--bg-card) to-sky-50/30 p-4 shadow-sm"
                      >
                        <div
                          class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                        >
                          <div>
                            <p
                              class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                            >
                              Configuration
                            </p>
                            <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                              {{ t('purchaseOrder.ui.configurationTitle', '采购策略与费用设置') }}
                            </h3>
                          </div>
                          <div class="flex flex-wrap items-center gap-2">
                            <StatusBadge variant="info" class="text-[10px]">
                              {{ t('purchaseOrder.detail.items') }} {{ poItems.length }}
                            </StatusBadge>
                            <StatusBadge variant="success" class="text-[10px]">
                              {{ t('purchaseOrder.form.totalQty') }} {{ totalCreateQty }}
                            </StatusBadge>
                            <StatusBadge
                              v-if="shortageItems.length > 0"
                              variant="warning"
                              class="text-[10px]"
                            >
                              {{ t('purchaseOrder.form.quantityWarning') }}
                              {{ shortageItems.length }}
                            </StatusBadge>
                          </div>
                        </div>

                        <div
                          class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]"
                        >
                          <div
                            class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
                          >
                            <label class="text-xs font-medium text-(--text-secondary)">{{
                              t('purchaseOrder.form.remark')
                            }}</label>
                            <AppInput
                              v-model="createForm.remark"
                              type="text"
                              class="mt-2"
                              :placeholder="t('purchaseOrder.form.remarkPlaceholder')"
                            />
                          </div>

                          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
                            >
                              <label class="text-xs font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.form.currency')
                              }}</label>
                              <AppSelect
                                v-model="createForm.currency"
                                :options="currencyOptions"
                                :placeholder="t('purchaseOrder.form.currency')"
                                size="sm"
                                class="mt-2"
                              />
                            </div>
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
                            >
                              <label class="text-xs font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.form.estimatedShipping')
                              }}</label>
                              <AppInput
                                v-model="createForm.estimated_shipping_cost"
                                type="number"
                                step="0.01"
                                class="mt-2"
                              />
                            </div>
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4"
                            >
                              <label class="text-xs font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.form.estimatedTariff')
                              }}</label>
                              <AppInput
                                v-model="createForm.estimated_tariff_cost"
                                type="number"
                                step="0.01"
                                class="mt-2"
                              />
                            </div>
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4 sm:col-span-2 xl:col-span-3"
                            >
                              <label class="text-xs font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.form.allocationMethod')
                              }}</label>
                              <AppSelect
                                v-model="createForm.allocation_method"
                                :options="allocationMethodOptions"
                                :placeholder="t('purchaseOrder.form.byQuantity')"
                                size="sm"
                                class="mt-2"
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      <!-- 分隔线 + 采购商品列表 -->
                      <div
                        class="rounded-[1.6rem] border border-(--border-color)/70 bg-(--bg-card) shadow-sm"
                      >
                        <!-- 列表头部 -->
                        <div
                          class="flex flex-col gap-3 border-b border-(--border-subtle) p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <p
                              class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                            >
                              Procurement Mix
                            </p>
                            <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                              {{ t('purchaseOrder.form.itemList') }}
                              <span
                                v-if="poItems.length > 0"
                                class="ml-1 font-mono text-xs font-normal tabular-nums text-(--text-secondary)"
                                >({{ poItems.length }})</span
                              >
                            </h3>
                          </div>
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
                        <div v-if="poItems.length === 0" class="flex flex-col items-center py-12">
                          <div
                            class="flex size-16 items-center justify-center rounded-[1.35rem] bg-linear-to-br from-(--bg-muted) to-sky-50/40"
                          >
                            <AppIcon name="cube" class="size-7 text-(--text-muted)" />
                          </div>
                          <p class="mt-3 text-sm text-(--text-secondary)">
                            {{ t('purchaseOrder.form.noItems') }}
                          </p>
                        </div>

                        <!-- 商品表格 -->
                        <div v-else class="overflow-x-auto">
                          <table class="w-full">
                            <thead>
                              <tr
                                class="border-b border-(--border-subtle) text-left text-xs font-medium text-(--text-secondary)"
                              >
                                <th class="px-4 py-2.5">{{ t('purchaseOrder.table.product') }}</th>
                                <th class="px-4 py-2.5 text-center">
                                  {{ t('purchaseOrder.table.quantity') }}
                                </th>
                                <th class="px-4 py-2.5 text-right">
                                  {{ t('purchaseOrder.table.unitCost') }}
                                </th>
                                <th class="px-4 py-2.5 text-center">
                                  {{ t('purchaseOrder.form.source') }}
                                </th>
                                <th class="w-10 px-2 py-2.5"></th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-(--border-subtle)">
                              <tr
                                v-for="(item, idx) in poItems"
                                :key="idx"
                                class="group transition-colors hover:bg-(--bg-hover)"
                              >
                                <!-- 商品信息 -->
                                <td class="px-4 py-3">
                                  <div class="flex items-center gap-2.5">
                                    <div
                                      class="size-8 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)"
                                    >
                                      <AppImage
                                        v-if="item.image"
                                        :src="'/file/' + item.image"
                                        class="size-full"
                                      />
                                      <div
                                        v-else
                                        class="flex size-full items-center justify-center text-(--text-muted)"
                                      >
                                        <AppIcon name="photo" class="size-4" />
                                      </div>
                                    </div>
                                    <div class="min-w-0">
                                      <div
                                        class="truncate text-sm font-medium text-(--text-main)"
                                        :title="item.product_name || '—'"
                                      >
                                        {{ item.product_name || '—' }}
                                      </div>
                                      <div
                                        class="flex min-w-0 items-center gap-1.5 text-xs text-(--text-secondary)"
                                      >
                                        <span
                                          class="max-w-[8rem] truncate font-mono"
                                          :title="item.sku || '-'"
                                          >{{ item.sku || '-' }}</span
                                        >
                                        <span
                                          v-if="item.brand"
                                          class="max-w-[7rem] truncate"
                                          :title="item.brand"
                                          >· {{ item.brand }}</span
                                        >
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <!-- 数量 (可编辑) -->
                                <td class="px-4 py-3 text-center">
                                  <div class="flex flex-col items-center">
                                    <AppInput
                                      v-model="item.quantity"
                                      type="number"
                                      min="1"
                                      class="w-20 text-center"
                                      size="sm"
                                    />
                                    <span
                                      v-if="
                                        item.required_quantity &&
                                        item.quantity < item.required_quantity
                                      "
                                      class="text-danger mt-1 text-[10px] font-medium"
                                    >
                                      {{ t('purchaseOrder.form.quantityWarning') }} ({{
                                        item.required_quantity
                                      }})
                                    </span>
                                  </div>
                                </td>

                                <!-- 单价 (可编辑) -->
                                <td class="px-4 py-3 text-right">
                                  <AppInput
                                    v-model="item.unit_cost"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    class="w-24 text-right"
                                    size="sm"
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
                                  <span
                                    v-else
                                    class="inline-flex items-center gap-1 rounded-full bg-(--bg-muted) px-2 py-0.5 text-[10px] font-semibold text-(--text-secondary)"
                                  >
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
                  <div
                    class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div class="text-sm text-(--text-secondary)">
                      <span v-if="poItems.length > 0">
                        {{ poItems.length }} {{ t('purchaseOrder.form.itemsCount') }} ·
                        {{ t('purchaseOrder.form.totalQty') }}:
                        <strong class="font-mono font-semibold tabular-nums text-(--text-main)">{{
                          totalCreateQty
                        }}</strong>
                      </span>
                    </div>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
                        @click="showCreateModal = false"
                      >
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

          <Teleport to="body">
            <transition name="fade">
              <div
                v-if="showShortageClosureModal"
                data-testid="purchase-order-shortage-modal"
                class="fixed inset-0 z-[61] flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="closeShortageModal"
                ></div>
                <div
                  class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
                  style="max-height: calc(100vh - 3rem)"
                >
                  <div
                    class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-slate-50/90 via-(--bg-card) to-amber-50/35 px-6 py-5"
                  >
                    <div
                      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(100,116,139,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_24%)]"
                    ></div>
                    <div class="relative">
                      <p
                        class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                      >
                        Shortage Closure
                      </p>
                      <h2 class="mt-1 text-xl font-bold text-(--text-main)">
                        {{ t('purchaseOrder.action.closeOutstanding', '关闭待收') }}
                      </h2>
                      <p class="mt-1 text-sm text-(--text-secondary)">
                        {{
                          t(
                            'purchaseOrder.ui.shortageModalHint',
                            '将确认不会再到货的尾差数量转入采购单取消量，只关闭采购侧待收，不改客户订单需求。'
                          )
                        }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
                      @click="closeShortageModal"
                    >
                      <AppIcon name="x-mark" class="size-5" />
                    </button>
                  </div>

                  <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="space-y-3">
                      <article
                        v-for="entry in shortageDrafts"
                        :key="entry.purchase_order_item_id"
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-linear-to-r from-(--bg-card) via-(--bg-card) to-slate-50/40 p-4"
                      >
                        <div
                          class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                        >
                          <div class="min-w-0">
                            <div class="flex min-w-0 flex-wrap items-center gap-2">
                              <span
                                class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
                                :title="entry.product_name"
                              >
                                {{ entry.product_name || '—' }}
                              </span>
                              <code
                                class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)"
                              >
                                {{ entry.variant_sku || '—' }}
                              </code>
                              <span
                                v-if="entry.customer_order_no"
                                class="bg-info/10 text-info inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              >
                                {{ entry.customer_order_no }}
                              </span>
                            </div>
                            <p class="mt-2 text-xs text-(--text-secondary)">
                              {{ t('purchaseOrder.progress.receivedPrefix', '已到') }}
                              {{ formatInteger(entry.received_qty_before) }} /
                              {{ formatInteger(entry.ordered_qty) }} ·
                              {{ t('purchaseOrder.progress.cancelledPrefix', '取消') }}
                              {{ formatInteger(entry.cancelled_qty_before) }} ·
                              {{ t('purchaseOrder.progress.outstandingPrefix', '待收') }}
                              {{ formatInteger(entry.max_closable) }}
                            </p>
                            <div
                              v-if="
                                entry.variant_options &&
                                Object.keys(entry.variant_options).length > 0
                              "
                              class="mt-2 flex min-w-0 flex-wrap gap-1"
                            >
                              <span
                                v-for="(val, key) in entry.variant_options"
                                :key="`shortage-draft-${entry.purchase_order_item_id}-${key}`"
                                class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium break-all"
                              >
                                {{ key }}: {{ val }}
                              </span>
                            </div>
                          </div>

                          <div class="grid gap-3 lg:w-[19rem]">
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
                            >
                              <label class="text-[11px] font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.ui.shortageCloseQty', '本次关闭数量')
                              }}</label>
                              <AppInput
                                v-model="entry.close_qty"
                                type="number"
                                min="0"
                                step="1"
                                class="mt-2 text-center"
                                size="sm"
                              />
                              <p
                                v-if="isShortageDraftInvalid(entry)"
                                class="text-danger mt-2 text-[11px] font-medium"
                              >
                                {{
                                  t(
                                    'purchaseOrder.ui.shortageQtyOverflow',
                                    '不能超过当前剩余待收数量。'
                                  )
                                }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  </div>

                  <div
                    class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div class="flex flex-wrap items-center gap-2 text-sm text-(--text-secondary)">
                      <span
                        >{{ t('purchaseOrder.ui.shortageSelectedLines', '已填关闭行') }}
                        <strong class="font-mono font-semibold tabular-nums text-(--text-main)">{{
                          shortageDraftSelectedCount
                        }}</strong></span
                      >
                      <span>·</span>
                      <span
                        >{{ t('purchaseOrder.ui.shortageSelectedQty', '已填关闭数量') }}
                        <strong class="font-mono font-semibold tabular-nums text-(--text-main)">{{
                          formatInteger(shortageDraftSelectedQty)
                        }}</strong></span
                      >
                    </div>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
                        @click="closeShortageModal"
                      >
                        {{ t('common.cancel') }}
                      </button>
                      <button
                        type="button"
                        :disabled="shortageSubmitDisabled || shortageSubmitting"
                        class="bg-primary cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="submitShortageClosures"
                      >
                        {{
                          shortageSubmitting
                            ? t('purchaseOrder.ui.shortageSubmitting', '提交中...')
                            : t('purchaseOrder.action.closeOutstanding', '关闭待收')
                        }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <div
                v-if="showReceiptModal"
                data-testid="purchase-order-receipt-modal"
                class="fixed inset-0 z-[60] flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="closeReceiptModal"
                ></div>
                <div
                  class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
                  style="max-height: calc(100vh - 3rem)"
                >
                  <div
                    class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-emerald-50/75 via-(--bg-card) to-sky-50/35 px-6 py-5"
                  >
                    <div
                      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_24%)]"
                    ></div>
                    <div class="relative">
                      <p
                        class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                      >
                        Receipt Capture
                      </p>
                      <h2 class="mt-1 text-xl font-bold text-(--text-main)">
                        {{ t('purchaseOrder.action.recordReceipt', '登记收货') }}
                      </h2>
                      <p class="mt-1 text-sm text-(--text-secondary)">
                        {{
                          t(
                            'purchaseOrder.ui.receiptModalHint',
                            '只提交本次实际到货数量，系统会自动推进采购、订单和库存投影。'
                          )
                        }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
                      @click="closeReceiptModal"
                    >
                      <AppIcon name="x-mark" class="size-5" />
                    </button>
                  </div>

                  <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="space-y-3">
                      <article
                        v-for="entry in receiptDrafts"
                        :key="entry.purchase_order_item_id"
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-linear-to-r from-(--bg-card) via-(--bg-card) to-emerald-50/20 p-4"
                      >
                        <div
                          class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                        >
                          <div class="min-w-0">
                            <div class="flex min-w-0 flex-wrap items-center gap-2">
                              <span
                                class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
                                :title="entry.product_name"
                              >
                                {{ entry.product_name || '—' }}
                              </span>
                              <code
                                class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)"
                              >
                                {{ entry.variant_sku || '—' }}
                              </code>
                              <span
                                v-if="entry.customer_order_no"
                                class="bg-info/10 text-info inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              >
                                {{ entry.customer_order_no }}
                              </span>
                            </div>
                            <p class="mt-2 text-xs text-(--text-secondary)">
                              {{ t('purchaseOrder.progress.receivedPrefix', '已到') }}
                              {{ formatInteger(entry.received_qty_before) }} /
                              {{ formatInteger(entry.ordered_qty) }} ·
                              {{ t('purchaseOrder.progress.outstandingPrefix', '待收') }}
                              {{ formatInteger(entry.max_receivable) }}
                            </p>
                            <div
                              v-if="
                                entry.variant_options &&
                                Object.keys(entry.variant_options).length > 0
                              "
                              class="mt-2 flex min-w-0 flex-wrap gap-1"
                            >
                              <span
                                v-for="(val, key) in entry.variant_options"
                                :key="`receipt-draft-${entry.purchase_order_item_id}-${key}`"
                                class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium break-all"
                              >
                                {{ key }}: {{ val }}
                              </span>
                            </div>
                          </div>

                          <div class="grid gap-3 lg:w-[19rem]">
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
                            >
                              <label class="text-[11px] font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.form.receivedQty', '本次到货数量')
                              }}</label>
                              <AppInput
                                v-model="entry.received_qty"
                                type="number"
                                min="0"
                                step="1"
                                class="mt-2 text-center"
                                size="sm"
                              />
                              <p
                                v-if="isReceiptDraftInvalid(entry)"
                                class="text-danger mt-2 text-[11px] font-medium"
                              >
                                {{
                                  t(
                                    'purchaseOrder.ui.receiptQtyOverflow',
                                    '不能超过当前剩余可收数量。'
                                  )
                                }}
                              </p>
                            </div>
                            <div
                              class="rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
                            >
                              <label class="text-[11px] font-medium text-(--text-secondary)">{{
                                t('purchaseOrder.form.note', '备注')
                              }}</label>
                              <AppInput
                                v-model="entry.note"
                                type="text"
                                class="mt-2"
                                size="sm"
                                :placeholder="
                                  t(
                                    'purchaseOrder.ui.receiptNotePlaceholder',
                                    '例如：第一批到货、箱损复核完成'
                                  )
                                "
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  </div>

                  <div
                    class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div class="flex flex-wrap items-center gap-2 text-sm text-(--text-secondary)">
                      <span
                        >{{ t('purchaseOrder.ui.receiptSelectedLines', '已填收货行') }}
                        <strong class="font-mono font-semibold tabular-nums text-(--text-main)">{{
                          receiptDraftSelectedCount
                        }}</strong></span
                      >
                      <span>·</span>
                      <span
                        >{{ t('purchaseOrder.ui.receiptSelectedQty', '已填数量') }}
                        <strong class="font-mono font-semibold tabular-nums text-(--text-main)">{{
                          formatInteger(receiptDraftSelectedQty)
                        }}</strong></span
                      >
                    </div>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
                        @click="closeReceiptModal"
                      >
                        {{ t('common.cancel') }}
                      </button>
                      <button
                        type="button"
                        :disabled="receiptSubmitDisabled || receiptSubmitting"
                        class="bg-primary cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="submitReceipts"
                      >
                        {{
                          receiptSubmitting
                            ? t('purchaseOrder.ui.receiptSubmitting', '提交中...')
                            : t('purchaseOrder.action.recordReceipt', '登记收货')
                        }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <div
                v-if="showCostModal"
                data-testid="purchase-order-cost-modal"
                class="fixed inset-0 z-[62] flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="closeCostModal"
                ></div>
                <div
                  class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-[1.8rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
                  style="max-height: calc(100vh - 3rem)"
                >
                  <div
                    class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-amber-50/75 via-(--bg-card) to-sky-50/35 px-6 py-5"
                  >
                    <div
                      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_24%)]"
                    ></div>
                    <div class="relative">
                      <p
                        class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                      >
                        Settlement Config
                      </p>
                      <h2 class="mt-1 text-xl font-bold text-(--text-main)">
                        {{ t('purchaseOrder.action.settle', '填写实际费用') }}
                      </h2>
                      <p class="mt-1 text-sm text-(--text-secondary)">
                        {{
                          t(
                            'purchaseOrder.ui.costModalHint',
                            '同步币种、分摊方式、预估费用与实际费用，必要时立即重算每条采购明细的落地成本。'
                          )
                        }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
                      @click="closeCostModal"
                    >
                      <AppIcon name="x-mark" class="size-5" />
                    </button>
                  </div>

                  <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="grid gap-4 md:grid-cols-2">
                      <div
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                      >
                        <label class="text-xs font-medium text-(--text-secondary)">{{
                          t('purchaseOrder.form.remark')
                        }}</label>
                        <AppInput
                          v-model="costDraft.remark"
                          type="text"
                          class="mt-2"
                          :placeholder="t('purchaseOrder.form.remarkPlaceholder')"
                        />
                      </div>
                      <div class="grid gap-4 sm:grid-cols-2">
                        <div
                          class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                        >
                          <label class="text-xs font-medium text-(--text-secondary)">{{
                            t('purchaseOrder.form.currency')
                          }}</label>
                          <AppSelect
                            v-model="costDraft.currency"
                            :options="currencyOptions"
                            :placeholder="t('purchaseOrder.form.currency')"
                            size="sm"
                            class="mt-2"
                          />
                        </div>
                        <div
                          class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                        >
                          <label class="text-xs font-medium text-(--text-secondary)">{{
                            t('purchaseOrder.form.allocationMethod')
                          }}</label>
                          <AppSelect
                            v-model="costDraft.allocation_method"
                            :options="allocationMethodOptions"
                            :placeholder="t('purchaseOrder.form.byQuantity')"
                            size="sm"
                            class="mt-2"
                          />
                        </div>
                      </div>
                      <div
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                      >
                        <label class="text-xs font-medium text-(--text-secondary)">{{
                          t('purchaseOrder.form.estimatedShipping')
                        }}</label>
                        <AppInput
                          v-model="costDraft.estimated_shipping_cost"
                          type="number"
                          step="0.01"
                          class="mt-2"
                        />
                      </div>
                      <div
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                      >
                        <label class="text-xs font-medium text-(--text-secondary)">{{
                          t('purchaseOrder.form.estimatedTariff')
                        }}</label>
                        <AppInput
                          v-model="costDraft.estimated_tariff_cost"
                          type="number"
                          step="0.01"
                          class="mt-2"
                        />
                      </div>
                      <div
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                      >
                        <label class="text-xs font-medium text-(--text-secondary)">{{
                          t('purchaseOrder.form.actualShipping')
                        }}</label>
                        <AppInput
                          v-model="costDraft.actual_shipping_cost"
                          type="number"
                          step="0.01"
                          class="mt-2"
                        />
                      </div>
                      <div
                        class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/90 p-4"
                      >
                        <label class="text-xs font-medium text-(--text-secondary)">{{
                          t('purchaseOrder.form.actualTariff')
                        }}</label>
                        <AppInput
                          v-model="costDraft.actual_tariff_cost"
                          type="number"
                          step="0.01"
                          class="mt-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <p class="text-sm text-(--text-secondary)">
                      {{
                        t(
                          'purchaseOrder.ui.costModalFooterHint',
                          '保存配置后可选择立即重算分摊，当前明细的运费/关税将按新的规则刷新。'
                        )
                      }}
                    </p>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
                        @click="closeCostModal"
                      >
                        {{ t('common.cancel') }}
                      </button>
                      <button
                        type="button"
                        :disabled="costSubmitting"
                        class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-(--border-color) px-4 py-2.5 text-sm font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
                        @click="saveCostSettings()"
                      >
                        {{
                          costSubmitting
                            ? t('purchaseOrder.ui.costSaving', '保存中...')
                            : t('common.save', '保存')
                        }}
                      </button>
                      <button
                        v-if="canAllocateCurrentPurchaseOrder"
                        type="button"
                        :disabled="costSubmitting"
                        class="bg-primary flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="saveCostSettings({ allocateAfterSave: true })"
                      >
                        <AppIcon name="calculator" class="size-4" />
                        {{
                          costSubmitting
                            ? t('purchaseOrder.ui.costAllocating', '处理中...')
                            : t('purchaseOrder.action.allocate', '执行成本分摊')
                        }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <div
                v-if="showReceiptReversalModal && activeReceiptForReversal"
                data-testid="purchase-order-reversal-modal"
                class="fixed inset-0 z-[65] flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="closeReceiptReversalModal"
                ></div>
                <div
                  class="relative w-full max-w-lg overflow-hidden rounded-[1.8rem] border border-amber-300/50 bg-(--color-modal-bg) shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]"
                >
                  <div
                    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_30%)]"
                  ></div>
                  <div class="relative border-b border-(--border-color) px-6 py-5">
                    <p
                      class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                    >
                      Receipt Reversal
                    </p>
                    <h2 class="mt-1 text-xl font-bold text-(--text-main)">
                      {{ t('purchaseOrder.action.reverseReceipt', '冲销收货') }}
                    </h2>
                    <p class="mt-1 text-sm text-(--text-secondary)">
                      {{
                        t(
                          'purchaseOrder.ui.reversalModalHint',
                          '当前接口会整笔回滚该次收货记录，请确认库存和订单投影都允许撤回。'
                        )
                      }}
                    </p>
                  </div>

                  <div class="relative space-y-4 px-6 py-5">
                    <div
                      class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-page)/80 p-4"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-medium text-(--text-main)">{{
                          activeReceiptForReversal.product_name || '—'
                        }}</span>
                        <code
                          class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)"
                        >
                          {{
                            activeReceiptForReversal.variant_sku ||
                            activeReceiptForReversal.product_sku ||
                            '—'
                          }}
                        </code>
                      </div>
                      <p class="mt-2 text-xs text-(--text-secondary)">
                        {{ t('purchaseOrder.form.receivedQty', '本次到货') }}
                        {{ formatInteger(activeReceiptForReversal.received_qty) }} ·
                        {{ formatDateTime(activeReceiptForReversal.received_at) }}
                      </p>
                    </div>

                    <div
                      class="rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-page)/80 p-4"
                    >
                      <label class="text-[11px] font-medium text-(--text-secondary)">{{
                        t('purchaseOrder.form.reason', '原因')
                      }}</label>
                      <AppInput
                        v-model="receiptReversalReason"
                        type="text"
                        class="mt-2"
                        :placeholder="
                          t(
                            'purchaseOrder.ui.reversalReasonPlaceholder',
                            '例如：误登记、异常入库、库存校正'
                          )
                        "
                      />
                    </div>
                  </div>

                  <div
                    class="relative flex justify-end gap-3 border-t border-(--border-color) px-6 py-4"
                  >
                    <button
                      type="button"
                      class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
                      @click="closeReceiptReversalModal"
                    >
                      {{ t('common.cancel') }}
                    </button>
                    <button
                      type="button"
                      :disabled="receiptReversalSubmitting"
                      class="cursor-pointer rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                      @click="submitReceiptReversal"
                    >
                      {{
                        receiptReversalSubmitting
                          ? t('purchaseOrder.ui.reversalSubmitting', '提交中...')
                          : t('purchaseOrder.action.reverseReceipt', '冲销收货')
                      }}
                    </button>
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
              <div
                v-if="showShortageConfirm"
                class="fixed inset-0 z-[70] flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="showShortageConfirm = false"
                ></div>
                <div
                  class="border-warning/20 relative w-full max-w-lg overflow-hidden rounded-[1.8rem] border bg-(--color-modal-bg) p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]"
                >
                  <div
                    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%)]"
                  ></div>
                  <div class="relative mb-4 flex items-center gap-3">
                    <div
                      class="bg-warning/10 flex size-10 items-center justify-center rounded-full"
                    >
                      <AppIcon name="exclamation-triangle" class="text-warning size-5" />
                    </div>
                    <div>
                      <p
                        class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                      >
                        Quantity Guardrail
                      </p>
                      <h3 class="mt-1 text-base font-bold text-(--text-main)">
                        {{ t('purchaseOrder.form.confirmShortageTitle') }}
                      </h3>
                    </div>
                  </div>
                  <p class="relative mb-5 text-sm text-(--text-secondary)">
                    {{ t('purchaseOrder.form.confirmShortage') }}
                  </p>
                  <div
                    class="border-warning/20 bg-warning/5 relative mb-5 max-h-40 overflow-y-auto rounded-xl border p-3"
                  >
                    <div
                      v-for="item in shortageItems"
                      :key="`${item.product_id || 'p'}-${item.variant_id || 'v'}`"
                      class="flex items-center justify-between py-1 text-sm"
                    >
                      <span
                        class="max-w-[70%] truncate text-(--text-main)"
                        :title="item.product_name || '—'"
                        >{{ item.product_name || '—' }}</span
                      >
                      <span class="text-danger font-mono font-semibold tabular-nums">
                        {{ item.quantity }} / {{ item.required_quantity }}
                      </span>
                    </div>
                  </div>
                  <div class="relative flex justify-end gap-3">
                    <button
                      type="button"
                      class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-hover)"
                      @click="showShortageConfirm = false"
                    >
                      {{ t('common.cancel') }}
                    </button>
                    <button
                      type="button"
                      class="bg-warning cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                      @click="executeCreate"
                    >
                      {{ t('purchaseOrder.form.confirmCreate') }}
                    </button>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>

          <!-- 预定单 / 商品 选择弹窗 -->
          <OrderPickerModal
            :visible="showOrderPicker"
            :exclude-ids="excludeOrderIds"
            @close="showOrderPicker = false"
            @confirm="handleOrdersSelected"
          />
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
              <div
                v-if="showSuggestions"
                data-testid="purchase-order-suggestions-shell"
                class="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
                  @click="showSuggestions = false"
                ></div>
                <div
                  class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-(--border-color)/70 bg-(--color-modal-bg) p-6 shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
                >
                  <div
                    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_22%)]"
                  ></div>
                  <div class="relative mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p
                        class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase"
                      >
                        Smart Suggestions
                      </p>
                      <h2 class="mt-1 text-xl font-bold text-(--text-main)">
                        {{ t('purchaseOrder.suggestions.title') }}
                      </h2>
                      <p class="mt-1 text-sm text-(--text-secondary)">
                        {{ t('purchaseOrder.suggestions.subtitle') }}
                      </p>
                    </div>
                    <button
                      class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
                      @click="showSuggestions = false"
                    >
                      <AppIcon name="x-mark" class="size-5" />
                    </button>
                  </div>

                  <div
                    v-if="!suggestionsLoading && suggestionSummaryCards.length > 0"
                    class="relative mb-4 grid gap-3 md:grid-cols-3"
                  >
                    <article
                      v-for="card in suggestionSummaryCards"
                      :key="card.key"
                      class="rounded-[1.35rem] border border-(--border-color)/60 bg-(--bg-card)/88 p-4"
                    >
                      <p
                        class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase"
                      >
                        {{ card.label }}
                      </p>
                      <div
                        class="mt-2 font-mono text-2xl font-semibold tabular-nums text-(--text-main)"
                      >
                        {{ card.value }}
                      </div>
                      <p class="mt-1 text-xs leading-5 text-(--text-secondary)">{{ card.hint }}</p>
                    </article>
                  </div>

                  <div v-if="suggestionsLoading" class="flex items-center justify-center py-12">
                    <div
                      class="border-primary size-8 animate-spin rounded-full border-4 border-t-transparent"
                    ></div>
                  </div>
                  <div v-else-if="suggestions.length === 0" class="py-12 text-center">
                    <AppIcon name="light-bulb" class="mx-auto size-10 text-(--text-muted)" />
                    <p class="mt-3 text-sm text-(--text-secondary)">
                      {{ t('purchaseOrder.suggestions.empty') }}
                    </p>
                  </div>
                  <div v-else class="max-h-96 space-y-2 overflow-y-auto">
                    <div
                      v-for="s in suggestions"
                      :key="`${s.product_id}-${s.variant_id || 'no-variant'}`"
                      class="flex flex-col gap-3 rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/88 p-4 transition-colors hover:bg-(--bg-hover) lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div class="flex min-w-0 items-center gap-3">
                        <AppCheckbox v-model="selectedSuggestions" :value="s" />
                        <div class="min-w-0">
                          <div
                            class="truncate text-sm font-medium text-(--text-main)"
                            :title="s.product_name || '—'"
                          >
                            {{ s.product_name || '—' }}
                          </div>
                          <div
                            class="truncate text-xs text-(--text-secondary)"
                            :title="buildSuggestionMeta(s)"
                          >
                            {{ buildSuggestionMeta(s) }}
                            <template
                              v-if="s.variant_options && Object.keys(s.variant_options).length > 0"
                            >
                              · {{ buildSuggestionVariantLabel(s.variant_options) }}
                            </template>
                          </div>
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2 text-xs lg:justify-end">
                        <StatusBadge variant="danger" class="text-[10px]">
                          {{ t('purchaseOrder.suggestions.shortage') }} {{ s.shortage }}
                        </StatusBadge>
                        <StatusBadge variant="default" class="text-[10px]">
                          {{ t('purchaseOrder.suggestions.stock') }}
                          {{ s.available_quantity ?? s.stock_quantity }}
                        </StatusBadge>
                        <span
                          class="rounded-full bg-(--bg-muted) px-2.5 py-1 font-mono tabular-nums text-(--text-secondary)"
                          >成本 ¥{{ (s.variant_cost_price || s.cost_price || 0).toFixed(2) }}</span
                        >
                        <span
                          class="bg-primary/8 text-primary rounded-full px-2.5 py-1 font-mono tabular-nums"
                          >建议 ¥{{
                            (s.suggested_purchase_price || s.cost_price || 0).toFixed(2)
                          }}</span
                        >
                        <span
                          v-if="s.last_purchase_price != null"
                          class="font-mono tabular-nums text-(--text-secondary)"
                        >
                          最近 ¥{{ Number(s.last_purchase_price).toFixed(2) }}
                        </span>
                        <span
                          v-if="s.price_delta != null"
                          class="font-mono font-semibold tabular-nums"
                          :class="
                            s.price_delta > 0
                              ? 'text-warning'
                              : s.price_delta < 0
                                ? 'text-success'
                                : 'text-(--text-secondary)'
                          "
                        >
                          Δ {{ s.price_delta > 0 ? '+' : '' }}{{ Number(s.price_delta).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="suggestions.length > 0"
                    class="relative mt-4 flex justify-end gap-3 border-t border-(--border-color)/60 pt-4"
                  >
                    <button
                      class="bg-primary cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-inverse) transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="selectedSuggestions.length === 0"
                      @click="handleCreateFromSuggestions"
                    >
                      {{ t('purchaseOrder.suggestions.addSelected') }} ({{
                        selectedSuggestions.length
                      }})
                    </button>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>
        </template>
      </ManagementListShell>
    </template>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

const getFileUrl = (id) => `/file/${id}`;
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { usePurchaseOrderModals } from '@/composables/usePurchaseOrderModals';
import { useToast } from '@/composables/useToast';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { CURRENCY_OPTIONS } from '@/composables/useProductForm';
import { validateOrderQuantity } from '@/utils/purchase-order-constraints';
import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';
import { reconcileVariantSelection } from '@/utils/purchase-order-variant-selection';
import { formatCurrency as formatMoney } from '@/utils/formatters';
import OrderPickerModal from '@/components/purchase-order/OrderPickerModal.vue';
import ProductPickerModal from '@/components/purchase-order/ProductPickerModal.vue';
import ProductDetailModal from '@/components/product/ProductDetailModal.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppSelect from '@/components/ui/Select.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';

const { t } = useI18n();
const {
  list,
  total,
  loading,
  error,
  errorCode,
  detail,
  detailLoading: _detailLoading,
  suggestions,
  suggestionsLoading,
  stats,
  filters,
  statusConfig,
  loadList,
  loadDetail,
  loadPurchaseOrderOverview,
  refreshPurchaseOrderViews,
  createPO,
  createFromOrders,
  updatePO,
  updateStatus,
  loadSuggestions,
  addItems,
  removeItem,
  updateItem,
  recordReceipts,
  reverseReceipt,
  closeShortages,
  allocateCosts,
} = usePurchaseOrders();

const route = useRoute();
const router = useRouter();
const { addToast } = useToast();
const { setContext } = useAI();
const { subscribeModule } = useAppRefreshBus();

// ─── 本地状态 ────────────────────────────────────────

const {
  showDetail,
  showCreateModal,
  showSuggestions,
  showOrderPicker,
  showProductPicker,
  pickerTarget,
  showShortageConfirm,
  confirmData: _confirmData,
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
  currency: 'CNY',
  estimated_shipping_cost: 0,
  estimated_tariff_cost: 0,
  allocation_method: 'by_quantity',
});

const poItems = reactive([]);
const selectedSuggestions = ref([]);
const detailRequestId = ref('');
const showCostModal = ref(false);
const costSubmitting = ref(false);
const costDraft = reactive({
  remark: '',
  currency: 'CNY',
  allocation_method: 'by_quantity',
  estimated_shipping_cost: 0,
  estimated_tariff_cost: 0,
  actual_shipping_cost: '',
  actual_tariff_cost: '',
});
const showReceiptModal = ref(false);
const receiptSubmitting = ref(false);
const receiptDrafts = ref([]);
const showShortageClosureModal = ref(false);
const shortageSubmitting = ref(false);
const shortageDrafts = ref([]);
const showReceiptReversalModal = ref(false);
const receiptReversalSubmitting = ref(false);
const receiptReversalReason = ref('');
const activeReceiptForReversal = ref(null);
let stopPurchaseOrdersRefreshSubscription = null;

// ─── 计算属性 ────────────────────────────────────────

const statCards = computed(() => {
  if (!stats.value) return [];
  return [
    {
      key: '',
      label: t('purchaseOrder.filter.all'),
      count: stats.value.total || 0,
      icon: 'bars-4',
      tone: 'primary',
    },
    {
      key: 'draft',
      label: t('purchaseOrder.status.draft'),
      count: stats.value.draft_count || 0,
      icon: 'pencil-square',
      tone: 'slate',
    },
    {
      key: 'ordered',
      label: t('purchaseOrder.status.ordered'),
      count: stats.value.ordered_count || 0,
      icon: 'clipboard-document-check',
      tone: 'warning',
    },
    {
      key: 'shipping',
      label: t('purchaseOrder.status.shipping'),
      count: stats.value.shipping_count || 0,
      icon: 'truck',
      tone: 'purple',
    },
    {
      key: 'arrived',
      label: t('purchaseOrder.status.arrived'),
      count: stats.value.arrived_count || 0,
      icon: 'cube',
      tone: 'success',
    },
    {
      key: 'completed',
      label: t('purchaseOrder.status.completed'),
      count: stats.value.completed_count || 0,
      icon: 'check-badge',
      tone: 'info',
    },
  ];
});
const stepsList = [
  { value: 'draft', label: t('purchaseOrder.status.draft') },
  { value: 'ordered', label: t('purchaseOrder.status.ordered') },
  { value: 'shipping', label: t('purchaseOrder.status.shipping') },
  { value: 'arrived', label: t('purchaseOrder.status.arrived') },
  { value: 'completed', label: t('purchaseOrder.status.completed') },
];

const getStepIndex = (status) => {
  return stepsList.findIndex((s) => s.value === status);
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
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

// 当前采购单可跳转的下一个状态
const nextStatuses = computed(() => {
  if (!detail.value) return [];
  if (detail.value.status === 'shipping') {
    return getPurchaseOrderOutstandingQty(detail.value) <= 0 ? ['arrived'] : [];
  }
  if (detail.value.status === 'ordered') {
    return getPurchaseOrderReceivedQty(detail.value) > 0 ? ['shipping'] : ['shipping', 'cancelled'];
  }
  const map = {
    draft: ['ordered', 'cancelled'],
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

const allocationMethodOptions = computed(() => [
  { value: 'by_quantity', label: t('purchaseOrder.form.byQuantity') },
  { value: 'by_value', label: t('purchaseOrder.form.byValue') },
]);

const currencyOptions = computed(() =>
  CURRENCY_OPTIONS.map((currency) => ({
    value: currency.code,
    label: `${currency.code} · ${currency.label}`,
  }))
);

// ─── 方法 ────────────────────────────────────────────

const formatDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatDateTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatInteger = (value) => Number(value || 0).toLocaleString('zh-CN');

const formatPurchaseCurrency = (value, currency = 'CNY') => {
  if (value === undefined || value === null || value === '') return '—';
  return formatMoney(value, currency || 'CNY');
};

const buildSuggestionVariantLabel = (variantOptions = {}) =>
  Object.values(variantOptions || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' / ');

const buildSuggestionMeta = (suggestion) => {
  const sku = String(suggestion?.sku || '').trim();
  const brand = String(suggestion?.brand || '').trim();
  return [sku || '—', brand || '-'].join(' · ');
};

const progressStatusConfig = computed(() => ({
  open: { label: t('purchaseOrder.progress.open', '待到货'), variant: 'warning' },
  partially_received: {
    label: t('purchaseOrder.progress.partiallyReceived', '部分到货'),
    variant: 'primary',
  },
  received: { label: t('purchaseOrder.progress.received', '已全部到货'), variant: 'success' },
  cancelled: { label: t('purchaseOrder.progress.cancelled', '已取消'), variant: 'default' },
}));

const toProgressNumber = (value) => Number(value || 0);

const getProgressStatusMeta = (status) =>
  progressStatusConfig.value[status] || progressStatusConfig.value.open;

const getProgressStatusLabel = (status) => getProgressStatusMeta(status).label;

const getProgressStatusVariant = (status) => getProgressStatusMeta(status).variant;

const buildReceiptProgressSummary = (record = {}) => {
  const ordered = getPurchaseOrderOrderedQty(record);
  const received = getPurchaseOrderReceivedQty(record);
  const cancelled = getPurchaseOrderCancelledQty(record);
  const outstanding = getPurchaseOrderOutstandingQty(record);

  const parts = [`${t('purchaseOrder.progress.receivedPrefix', '已到')} ${received} / ${ordered}`];
  if (cancelled > 0) {
    parts.push(`${t('purchaseOrder.progress.cancelledPrefix', '取消')} ${cancelled}`);
  }
  parts.push(`${t('purchaseOrder.progress.outstandingPrefix', '待收')} ${outstanding}`);
  return parts.join(' · ');
};

const buildReceiptMeta = (record = {}) => {
  const parts = [];
  const receiptCount = toProgressNumber(record.receipt_count);
  if (receiptCount > 0) {
    parts.push(`${receiptCount} ${t('purchaseOrder.progress.receiptCountSuffix', '次入库')}`);
  }
  if (record.last_received_at) {
    parts.push(
      `${t('purchaseOrder.progress.lastReceivedPrefix', '最近到货')} ${formatDate(record.last_received_at)}`
    );
  }
  return parts.join(' · ');
};

const hasReceiptMeta = (record = {}) =>
  toProgressNumber(record.receipt_count) > 0 || Boolean(record.last_received_at);

const consoleSignals = computed(() => {
  if (!stats.value) return [];

  const draftCount = Number(stats.value.draft_count || 0);
  const activeCount =
    Number(stats.value.ordered_count || 0) +
    Number(stats.value.shipping_count || 0) +
    Number(stats.value.arrived_count || 0);
  const completedCount = Number(stats.value.completed_count || 0);

  return [
    {
      key: 'active',
      label: t('purchaseOrder.ui.activeWork', '在途链路'),
      value: formatInteger(activeCount),
      hint: t('purchaseOrder.ui.activeWorkHint', '已下单、运输中、待结算采购单总和。'),
    },
    {
      key: 'draft',
      label: t('purchaseOrder.ui.draftBacklog', '草稿堆积'),
      value: formatInteger(draftCount),
      hint: t('purchaseOrder.ui.draftBacklogHint', '等待补货明细、成本策略或关联订单的草稿。'),
    },
    {
      key: 'completed',
      label: t('purchaseOrder.ui.settlementClosed', '已结算'),
      value: formatInteger(completedCount),
      hint: t('purchaseOrder.ui.settlementClosedHint', '已完成入库与结算闭环的采购单。'),
    },
  ];
});

const detailSummaryCards = computed(() => {
  if (!detail.value) return [];

  return [
    {
      key: 'ordered',
      label: t('purchaseOrder.ui.orderedVolume', '采购数量'),
      value: formatInteger(detail.value.ordered_qty),
      hint: `${formatInteger(detail.value.item_count)} ${t('purchaseOrder.ui.lineCount', '条明细')}`,
    },
    {
      key: 'received',
      label: t('purchaseOrder.ui.receivedVolume', '已到货'),
      value: formatInteger(detail.value.received_qty),
      hint: getProgressStatusLabel(detail.value.display_status),
    },
    {
      key: 'outstanding',
      label: t('purchaseOrder.ui.outstandingVolume', '待收货'),
      value: formatInteger(detail.value.outstanding_qty),
      hint: buildReceiptProgressSummary(detail.value),
    },
    {
      key: 'goods',
      label: t('purchaseOrder.ui.goodsTotal', '商品总额'),
      value: formatPurchaseCurrency(detail.value.total_goods_cost, detail.value.currency),
      hint:
        buildReceiptMeta(detail.value) ||
        t('purchaseOrder.ui.awaitingReceiptMeta', '尚未产生入库记录'),
    },
  ];
});

const receiptTimeline = computed(() =>
  Array.isArray(detail.value?.receipts) ? detail.value.receipts : []
);

const receiptCandidates = computed(() => {
  if (!detail.value || !Array.isArray(detail.value.items)) return [];

  return detail.value.items
    .map((item) => ({
      purchase_order_item_id: item.id,
      product_name: item.product_name || '—',
      variant_sku: item.variant_sku || item.product_sku || '—',
      ordered_qty: getPurchaseOrderOrderedQty(item),
      received_qty_before: getPurchaseOrderReceivedQty(item),
      max_receivable: getPurchaseOrderOutstandingQty(item),
      customer_order_no: item.customer_order_no || '',
      variant_options: item.variant_options || {},
      note: '',
      received_qty: 0,
    }))
    .filter((item) => item.max_receivable > 0);
});

const receiptReceivableCount = computed(() => receiptCandidates.value.length);

const canRecordReceipts = computed(
  () =>
    Boolean(detail.value?.id) &&
    ['ordered', 'shipping'].includes(String(detail.value?.status || '')) &&
    receiptCandidates.value.length > 0
);

const shortageCandidates = computed(() => {
  if (!detail.value || !Array.isArray(detail.value.items)) return [];

  return detail.value.items
    .map((item) => ({
      purchase_order_item_id: item.id,
      product_name: item.product_name || '—',
      variant_sku: item.variant_sku || item.product_sku || '—',
      ordered_qty: getPurchaseOrderOrderedQty(item),
      received_qty_before: getPurchaseOrderReceivedQty(item),
      cancelled_qty_before: getPurchaseOrderCancelledQty(item),
      max_closable: getPurchaseOrderOutstandingQty(item),
      customer_order_no: item.customer_order_no || '',
      variant_options: item.variant_options || {},
      close_qty: 0,
    }))
    .filter((item) => item.max_closable > 0);
});

const canCloseShortages = computed(
  () =>
    Boolean(detail.value?.id) &&
    ['ordered', 'shipping'].includes(String(detail.value?.status || '')) &&
    shortageCandidates.value.length > 0
);

const receiptDraftSelectedCount = computed(
  () => receiptDrafts.value.filter((entry) => normalizeReceiptQty(entry.received_qty) > 0).length
);

const receiptDraftSelectedQty = computed(() =>
  receiptDrafts.value.reduce((sum, entry) => sum + normalizeReceiptQty(entry.received_qty), 0)
);

const receiptSubmitDisabled = computed(
  () =>
    receiptDraftSelectedCount.value === 0 ||
    receiptDrafts.value.some((entry) => isReceiptDraftInvalid(entry))
);

const shortageDraftSelectedCount = computed(
  () => shortageDrafts.value.filter((entry) => normalizeReceiptQty(entry.close_qty) > 0).length
);

const shortageDraftSelectedQty = computed(() =>
  shortageDrafts.value.reduce((sum, entry) => sum + normalizeReceiptQty(entry.close_qty), 0)
);

const shortageSubmitDisabled = computed(
  () =>
    shortageDraftSelectedCount.value === 0 ||
    shortageDrafts.value.some((entry) => isShortageDraftInvalid(entry))
);

const suggestionSummaryCards = computed(() => {
  const suggestionList = suggestions.value || [];
  const selectedList = selectedSuggestions.value || [];

  if (suggestionList.length === 0) return [];

  const totalShortage = suggestionList.reduce((sum, item) => sum + Number(item.shortage || 0), 0);
  const selectedShortage = selectedList.reduce((sum, item) => sum + Number(item.shortage || 0), 0);

  return [
    {
      key: 'candidates',
      label: t('purchaseOrder.ui.candidateVariants', '候选变体'),
      value: formatInteger(suggestionList.length),
      hint: t(
        'purchaseOrder.ui.candidateVariantsHint',
        '按当前订货缺口和库存情况筛出的待采购对象。'
      ),
    },
    {
      key: 'shortage',
      label: t('purchaseOrder.ui.totalShortage', '总缺口'),
      value: formatInteger(totalShortage),
      hint: t('purchaseOrder.ui.totalShortageHint', '全部建议项汇总的待补数量。'),
    },
    {
      key: 'selected',
      label: t('purchaseOrder.ui.selectedPlan', '已选建议'),
      value: formatInteger(selectedList.length),
      hint: `${t('purchaseOrder.suggestions.shortage')} ${formatInteger(selectedShortage)}`,
    },
  ];
});

const openDetail = async (id) => {
  detailRequestId.value = String(id || '').trim();
  showDetail.value = true;
  await loadDetail(id);
};

const changePage = async (delta) => {
  const nextPage = Math.max(1, Number(filters.page || 1) + Number(delta || 0));
  if (nextPage === filters.page) return;
  filters.page = nextPage;
  await loadList();
};

const toggleStatusFilter = async (status) => {
  filters.status = filters.status === status ? '' : status;
  filters.page = 1;
  await loadList();
};

const retryDetail = async () => {
  const id = detailRequestId.value || String(route.query.id || '').trim();
  if (!id) return;
  await openDetail(id);
};

function normalizeReceiptQty(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}

function normalizeDecimal(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNullableDecimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isReceiptDraftInvalid(entry = {}) {
  return normalizeReceiptQty(entry.received_qty) > Number(entry.max_receivable || 0);
}

function isShortageDraftInvalid(entry = {}) {
  return normalizeReceiptQty(entry.close_qty) > Number(entry.max_closable || 0);
}

const resetReceiptModalState = () => {
  showReceiptModal.value = false;
  receiptDrafts.value = [];
};

const resetShortageModalState = () => {
  showShortageClosureModal.value = false;
  shortageDrafts.value = [];
};

const resetCreateDraftState = () => {
  showCreateModal.value = false;
  createForm.remark = '';
  createForm.currency = 'CNY';
  createForm.estimated_shipping_cost = 0;
  createForm.estimated_tariff_cost = 0;
  createForm.allocation_method = 'by_quantity';
  poItems.splice(0, poItems.length);
};

const canAllocateCurrentPurchaseOrder = computed(
  () =>
    detail.value?.status === 'completed'
    && Boolean(detail.value?.id)
    && (detail.value?.items?.length || 0) > 0
);

const resetCostModalState = () => {
  showCostModal.value = false;
  costDraft.remark = '';
  costDraft.currency = 'CNY';
  costDraft.allocation_method = 'by_quantity';
  costDraft.estimated_shipping_cost = 0;
  costDraft.estimated_tariff_cost = 0;
  costDraft.actual_shipping_cost = '';
  costDraft.actual_tariff_cost = '';
};

const openCostModal = () => {
  if (!detail.value) return;
  costDraft.remark = detail.value.remark || '';
  costDraft.currency = detail.value.currency || 'CNY';
  costDraft.allocation_method = detail.value.allocation_method || 'by_quantity';
  costDraft.estimated_shipping_cost = detail.value.estimated_shipping_cost ?? 0;
  costDraft.estimated_tariff_cost = detail.value.estimated_tariff_cost ?? 0;
  costDraft.actual_shipping_cost = detail.value.actual_shipping_cost ?? '';
  costDraft.actual_tariff_cost = detail.value.actual_tariff_cost ?? '';
  showCostModal.value = true;
};

const closeCostModal = () => {
  if (costSubmitting.value) return;
  resetCostModalState();
};

const saveCostSettings = async ({ allocateAfterSave = false } = {}) => {
  if (!detail.value || costSubmitting.value) return;

  costSubmitting.value = true;
  try {
    const saved = await updatePO(detail.value.id, {
      remark: String(costDraft.remark || '').trim() || null,
      currency:
        String(costDraft.currency || 'CNY')
          .trim()
          .toUpperCase() || 'CNY',
      allocation_method: costDraft.allocation_method || 'by_quantity',
      estimated_shipping_cost: normalizeDecimal(costDraft.estimated_shipping_cost, 0),
      estimated_tariff_cost: normalizeDecimal(costDraft.estimated_tariff_cost, 0),
      actual_shipping_cost: normalizeNullableDecimal(costDraft.actual_shipping_cost),
      actual_tariff_cost: normalizeNullableDecimal(costDraft.actual_tariff_cost),
    });
    if (!saved) return;

    if (allocateAfterSave && canAllocateCurrentPurchaseOrder.value) {
      const allocated = await allocateCosts(detail.value.id);
      if (!allocated) return;
    }

    resetCostModalState();
    await refreshPurchaseOrderViews(detail.value.id);
  } finally {
    costSubmitting.value = false;
  }
};

const openReceiptModal = () => {
  if (!canRecordReceipts.value) return;
  receiptDrafts.value = receiptCandidates.value.map((entry) => ({ ...entry }));
  showReceiptModal.value = true;
};

const closeReceiptModal = () => {
  if (receiptSubmitting.value) return;
  resetReceiptModalState();
};

const openShortageModal = () => {
  if (!canCloseShortages.value) return;
  shortageDrafts.value = shortageCandidates.value.map((entry) => ({ ...entry }));
  showShortageClosureModal.value = true;
};

const closeShortageModal = () => {
  if (shortageSubmitting.value) return;
  resetShortageModalState();
};

const submitReceipts = async () => {
  if (!detail.value || receiptSubmitting.value) return;

  const items = receiptDrafts.value
    .map((entry) => ({
      purchase_order_item_id: entry.purchase_order_item_id,
      received_qty: normalizeReceiptQty(entry.received_qty),
      note: String(entry.note || '').trim() || undefined,
      max_receivable: Number(entry.max_receivable || 0),
    }))
    .filter((entry) => entry.received_qty > 0);

  if (items.length === 0) {
    addToast({
      type: 'warning',
      message: t('purchaseOrder.toast.receiptQtyRequired', '请至少填写一条收货数量'),
    });
    return;
  }

  if (items.some((entry) => entry.received_qty > entry.max_receivable)) {
    addToast({
      type: 'warning',
      message: t('purchaseOrder.ui.receiptQtyOverflow', '不能超过当前剩余可收数量。'),
    });
    return;
  }

  receiptSubmitting.value = true;
  try {
    const result = await recordReceipts(detail.value.id, {
      items: items.map(({ purchase_order_item_id, received_qty, note }) => ({
        purchase_order_item_id,
        received_qty,
        ...(note ? { note } : {}),
      })),
    });

    if (!result) return;

    resetReceiptModalState();
    await refreshPurchaseOrderViews(detail.value.id);
  } finally {
    receiptSubmitting.value = false;
  }
};

const submitShortageClosures = async () => {
  if (!detail.value || shortageSubmitting.value) return;

  const items = shortageDrafts.value
    .map((entry) => ({
      purchase_order_item_id: entry.purchase_order_item_id,
      close_qty: normalizeReceiptQty(entry.close_qty),
      max_closable: Number(entry.max_closable || 0),
    }))
    .filter((entry) => entry.close_qty > 0);

  if (items.length === 0) {
    addToast({
      type: 'warning',
      message: t('purchaseOrder.toast.shortageQtyRequired', '请至少填写一条关闭数量'),
    });
    return;
  }

  if (items.some((entry) => entry.close_qty > entry.max_closable)) {
    addToast({
      type: 'warning',
      message: t('purchaseOrder.ui.shortageQtyOverflow', '不能超过当前剩余待收数量。'),
    });
    return;
  }

  shortageSubmitting.value = true;
  try {
    const result = await closeShortages(detail.value.id, {
      items: items.map(({ purchase_order_item_id, close_qty }) => ({
        purchase_order_item_id,
        close_qty,
      })),
    });

    if (!result) return;

    resetShortageModalState();
    await refreshPurchaseOrderViews(detail.value.id);
  } finally {
    shortageSubmitting.value = false;
  }
};

const canReverseReceipt = (receipt = {}) =>
  ['ordered', 'shipping', 'arrived'].includes(String(detail.value?.status || '')) &&
  normalizeReceiptQty(receipt.available_reversal_qty) > 0;

const resetReceiptReversalState = () => {
  showReceiptReversalModal.value = false;
  activeReceiptForReversal.value = null;
  receiptReversalReason.value = '';
};

const openReceiptReversalModal = (receipt) => {
  if (!receipt || !canReverseReceipt(receipt)) return;
  activeReceiptForReversal.value = receipt;
  receiptReversalReason.value = '';
  showReceiptReversalModal.value = true;
};

const closeReceiptReversalModal = () => {
  if (receiptReversalSubmitting.value) return;
  resetReceiptReversalState();
};

const submitReceiptReversal = async () => {
  if (!detail.value || !activeReceiptForReversal.value || receiptReversalSubmitting.value) return;

  receiptReversalSubmitting.value = true;
  try {
    const result = await reverseReceipt(detail.value.id, activeReceiptForReversal.value.id, {
      reason: String(receiptReversalReason.value || '').trim() || undefined,
    });

    if (!result) return;

    resetReceiptReversalState();
    await refreshPurchaseOrderViews(detail.value.id);
  } finally {
    receiptReversalSubmitting.value = false;
  }
};

// ─── 新建/编辑采购单 - 选择器打开 ──────────────────────
// (已通过 usePurchaseOrderModals 处理方法定义)

// 从预定单选择器接收选中的订单 → 转化为 poItems 行或直接添加到草稿
const handleOrdersSelected = async (orders) => {
  const itemsToAdd = [];
  for (const order of orders) {
    // 避免重复添加同一个订单
    const isDuplicate =
      pickerTarget.value === 'create'
        ? poItems.some((i) => i.pre_order_id === order.id)
        : detail.value?.items?.some((i) => i.pre_order_id === order.id);
    if (isDuplicate) continue;

    const data =
      order.currentData && typeof order.currentData === 'object' ? order.currentData : {};

    itemsToAdd.push({
      product_id: order.productId || null,
      variant_id: order.variantId || null,
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
      order_no: order.orderNo || '',
      required_quantity: order.quantity || 1, // 预定需求量
    });
  }

  if (itemsToAdd.length === 0) return;
  const validItems = itemsToAdd.filter((i) => i.product_id && i.variant_id);
  if (validItems.length === 0) return;

  if (pickerTarget.value === 'create') {
    poItems.push(...validItems);
  } else if (pickerTarget.value === 'detail' && detail.value) {
    // 详情草稿面板：直接调用接口添加明细
    const newItems = validItems.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      pre_order_id: i.pre_order_id,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    }));
    const success = await addItems(detail.value.id, newItems);
    if (success) {
      await refreshPurchaseOrderViews(detail.value.id);
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
    const currentItems = (detail.value.items || []).filter(
      (item) => !item.pre_order_id && item.variant_id
    );
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
      await refreshPurchaseOrderViews(detail.value.id);
    }
  }
};

// 删除单条明细
const removePoItem = (idx) => {
  poItems.splice(idx, 1);
};

// 计算属性
const totalCreateQty = computed(() => poItems.reduce((sum, i) => sum + (i.quantity || 0), 0));
const shortageItems = computed(() =>
  poItems.filter((i) => i.required_quantity && i.quantity < i.required_quantity)
);
const excludeOrderIds = computed(() => {
  const items =
    pickerTarget.value === 'detail' && detail.value ? detail.value.items || [] : poItems;
  return items.filter((i) => i.pre_order_id).map((i) => i.pre_order_id);
});
const selectedVariantIdsForPicker = computed(() => {
  const items =
    pickerTarget.value === 'detail' && detail.value ? detail.value.items || [] : poItems;
  return [
    ...new Set(items.filter((i) => !i.pre_order_id && i.variant_id).map((i) => i.variant_id)),
  ];
});
const existingBrands = computed(() => {
  const items =
    pickerTarget.value === 'detail' && detail.value ? detail.value.items || [] : poItems;
  return [...new Set(items.map((i) => i.brand).filter(Boolean))];
});

// 详情明细编辑处理
const handleDetailUpdateItem = async (itemId, field, value) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await updateItem(detail.value.id, itemId, { [field]: value });
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

const handleDetailRemoveItem = async (itemId) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await removeItem(detail.value.id, itemId);
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
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
  const items = poItems.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    pre_order_id: item.pre_order_id || null,
    quantity: item.quantity || 1,
    unit_cost: item.unit_cost || 0,
  }));

  if (items.length > 0) {
    const itemsAdded = await addItems(result.id, items);
    if (!itemsAdded) {
      resetCreateDraftState();
      detailRequestId.value = String(result.id || '');
      showDetail.value = true;
      await refreshPurchaseOrderViews(result.id);
      addToast({
        type: 'warning',
        message: t(
          'purchaseOrder.toast.createdWithoutItems',
          '采购单已创建，但明细添加失败，请检查详情后继续处理'
        ),
      });
      return;
    }
  }

  // Reset
  resetCreateDraftState();
  await refreshPurchaseOrderViews();
};

const handleCreateFromSuggestions = async () => {
  // 将建议中的预订单汇总
  const allOrderIds = selectedSuggestions.value.flatMap((s) => s.order_ids || []);
  if (allOrderIds.length === 0) return;

  const result = await createFromOrders(allOrderIds, {
    allocation_method: 'by_quantity',
  });
  if (result) {
    showSuggestions.value = false;
    selectedSuggestions.value = [];
    await refreshPurchaseOrderViews();
  }
};

// ─── 生命周期 ────────────────────────────────────────

onMounted(() => {
  stopPurchaseOrdersRefreshSubscription = subscribeModule('purchaseOrders', async () => {
    if (!showCreateModal.value && !showDetail.value) {
      await loadPurchaseOrderOverview();
    }
  });
});

// 使用 onActivated 代替 onMounted，确保在 keep-alive 环境下
// 每次导航进入该页面时都会重新拉取最新数据
onActivated(async () => {
  await loadPurchaseOrderOverview();

  if (route.query.id) {
    const targetId = route.query.id;
    // 打开关联的详情弹窗
    openDetail(targetId);
  }
});

watch(showDetail, (isOpen) => {
  if (!isOpen && route.query.id) {
    const newQuery = { ...route.query };
    delete newQuery.id;
    router.replace({ path: route.path, query: newQuery });
  }
  if (!isOpen) {
    resetCostModalState();
    resetReceiptModalState();
    resetReceiptReversalState();
  }
});

// 打开建议弹窗时自动加载
watch(showSuggestions, (v) => {
  if (v) {
    selectedSuggestions.value = [];
    loadSuggestions();
    return;
  }
  selectedSuggestions.value = [];
});

const detailFocusedVariantId = computed(() => getDetailFocusedVariantId(detail.value));

watch(
  [
    showProductPicker,
    selectedVariantIdsForPicker,
    viewProductId,
    showDetail,
    detailFocusedVariantId,
    () => route.query.variantId,
  ],
  ([pickerOpen, selectedVariantIds, productId, detailOpen, detailVariantId, routeVariantId]) => {
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
  }
);

onDeactivated(() => {
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

onUnmounted(() => {
  stopPurchaseOrdersRefreshSubscription?.();
  stopPurchaseOrdersRefreshSubscription = null;
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
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
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
