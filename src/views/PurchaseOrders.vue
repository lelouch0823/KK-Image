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
          <PurchaseOrderOverviewBanner
            :title="t('purchaseOrder.title')"
            :description="t('purchaseOrder.subtitle')"
            :total="total"
            :loading="loading"
            :stats="stats"
            :stat-cards="statCards"
            :console-signals="consoleSignals"
            :active-status="filters.status"
            @toggle-status-filter="toggleStatusFilter"
          />

          <PurchaseOrderListTable
            :columns="columns"
            :list="list"
            :loading="loading"
            :empty-text="t('purchaseOrder.empty')"
            :status-config="statusConfig"
            :format-date="formatDate"
            :format-purchase-currency="formatPurchaseCurrency"
            :build-receipt-progress-summary="buildReceiptProgressSummary"
            :get-progress-status-label="getProgressStatusLabel"
            :get-progress-status-variant="getProgressStatusVariant"
            :get-list-status-variant="getListStatusVariant"
            @row-click="(row) => openDetail(row.id)"
          />

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
              <PurchaseOrderDetailDrawer
                :show="showDetail"
                :detail-loading="_detailLoading"
                :detail="detail"
                :status-config="statusConfig"
                :summary-cards="detailSummaryCards"
                :next-statuses="nextStatuses"
                :steps-list="stepsList"
                :receipt-timeline="receiptTimeline"
                :receipt-receivable-count="receiptReceivableCount"
                :can-record-receipts="canRecordReceipts"
                :can-close-shortages="canCloseShortages"
                :t="t"
                :helpers="detailHelpers"
                :get-file-url="getFileUrl"
                @close="showDetail = false"
                @retry-detail="retryDetail"
                @status-update="handleStatusUpdate"
                @open-cost-modal="openCostModal"
                @open-order-picker="openOrderPicker"
                @open-product-picker="openProductPicker"
                @view-product-detail="handleViewProductDetail"
                @update-item="handleDetailUpdateItem"
                @remove-item="handleDetailRemoveItem"
                @open-receipt-modal="openReceiptModal"
                @open-shortage-modal="openShortageModal"
                @open-reversal-modal="openReceiptReversalModal"
              />
            </transition>
          </Teleport>

          <!-- ==================== 新建采购单 Modal (增强版) ==================== -->
          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderCreateDrawer
                :show="showCreateModal"
                :t="t"
                :create-form="createForm"
                :currency-options="currencyOptions"
                :allocation-method-options="allocationMethodOptions"
                :po-items="poItems"
                :total-create-qty="totalCreateQty"
                :shortage-items="shortageItems"
                :get-file-url="getFileUrl"
                @close="showCreateModal = false"
                @update:create-form="Object.assign(createForm, $event)"
                @open-order-picker="openOrderPicker"
                @open-product-picker="openProductPicker"
                @remove-item="removePoItem"
                @submit="handleCreate"
              />
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
              <PurchaseOrderSuggestionsDrawer
                :show="showSuggestions"
                :t="t"
                :suggestions-loading="suggestionsLoading"
                :suggestions="suggestions"
                :suggestion-summary-cards="suggestionSummaryCards"
                :selected-suggestions="selectedSuggestions"
                :selected-suggestion-order-ids="selectedSuggestionOrderIds"
                :build-suggestion-meta="buildSuggestionMeta"
                :build-suggestion-variant-label="buildSuggestionVariantLabel"
                :get-suggestion-order-ids="getSuggestionOrderIds"
                @close="showSuggestions = false"
                @submit="handleCreateFromSuggestions"
                @update:selected-suggestions="selectedSuggestions = $event"
              />
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
import { usePurchaseOrderCreateFlow } from '@/composables/usePurchaseOrderCreateFlow';
import { usePurchaseOrderDetailActions } from '@/composables/usePurchaseOrderDetailActions';
import { usePurchaseOrderListPresentation } from '@/composables/usePurchaseOrderListPresentation';
import { usePurchaseOrderDetailPresentation } from '@/composables/usePurchaseOrderDetailPresentation';
import { useToast } from '@/composables/useToast';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { CURRENCY_OPTIONS } from '@/constants/currency.js';
import { validateOrderQuantity } from '@/utils/purchase-order-constraints';
import {
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';
import { formatCurrency as formatMoney } from '@/utils/formatters';
import { formatDate, formatDateTime } from "@/views/purchase-orders/formatters.js";
import {
  createReceiptMetaBuilder,
  hasReceiptMeta,
} from "@/views/purchase-orders/progress.js";
import {
  createPurchaseOrderSteps,
  getStepIconClasses,
  getStepperProgress,
  isStepCompleted,
} from "@/views/purchase-orders/stepper.js";
import {
  buildSuggestionMeta,
  buildSuggestionVariantLabel,
  getSuggestionOrderIds,
  isReceiptDraftInvalid,
  isShortageDraftInvalid,
  normalizeReceiptQty,
} from "@/views/purchase-orders/drafts.js";
import OrderPickerModal from '@/components/purchase-order/OrderPickerModal.vue';
import PurchaseOrderCreateDrawer from '@/components/purchase-order/PurchaseOrderCreateDrawer.vue';
import ProductPickerModal from '@/components/purchase-order/ProductPickerModal.vue';
import PurchaseOrderDetailDrawer from '@/components/purchase-order/PurchaseOrderDetailDrawer.vue';
import PurchaseOrderOverviewBanner from '@/components/purchase-order/PurchaseOrderOverviewBanner.vue';
import PurchaseOrderListTable from '@/components/purchase-order/PurchaseOrderListTable.vue';
import PurchaseOrderSuggestionsDrawer from '@/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue';
import ProductDetailModal from '@/components/product/ProductDetailModal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/Select.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
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
let stopPurchaseOrdersRefreshSubscription = null;

// ─── 计算属性 ────────────────────────────────────────

const {
  statCards,
  columns,
  consoleSignals,
  buildReceiptProgressSummary,
  getListStatusVariant,
} = usePurchaseOrderListPresentation({ stats, t });

const stepsList = createPurchaseOrderSteps(t);

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

const formatInteger = (value) => Number(value || 0).toLocaleString('zh-CN');

const formatPurchaseCurrency = (value, currency = 'CNY') => {
  if (value === undefined || value === null || value === '') return '—';
  return formatMoney(value, currency || 'CNY');
};

const buildReceiptMeta = createReceiptMetaBuilder({ t, formatDate });
const {
  detailSummaryCards,
  receiptTimeline,
  receiptCandidates,
  receiptReceivableCount,
  canRecordReceipts,
  shortageCandidates,
  canCloseShortages,
  getProgressStatusLabel,
  getProgressStatusVariant,
} = usePurchaseOrderDetailPresentation({
  detail,
  t,
  formatInteger,
  formatPurchaseCurrency,
  buildReceiptProgressSummary,
  buildReceiptMeta,
});

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
const {
  showCostModal,
  costSubmitting,
  costDraft,
  showReceiptModal,
  receiptSubmitting,
  receiptDrafts,
  showShortageClosureModal,
  shortageSubmitting,
  shortageDrafts,
  showReceiptReversalModal,
  receiptReversalSubmitting,
  receiptReversalReason,
  activeReceiptForReversal,
  canAllocateCurrentPurchaseOrder,
  resetCostModalState,
  openCostModal,
  closeCostModal,
  saveCostSettings,
  resetReceiptModalState,
  openReceiptModal,
  closeReceiptModal,
  openShortageModal,
  closeShortageModal,
  submitReceipts,
  submitShortageClosures,
  canReverseReceipt,
  resetReceiptReversalState,
  openReceiptReversalModal,
  closeReceiptReversalModal,
  submitReceiptReversal,
} = usePurchaseOrderDetailActions({
  detail,
  t,
  addToast,
  updatePO,
  allocateCosts,
  recordReceipts,
  reverseReceipt,
  closeShortages,
  refreshPurchaseOrderViews,
  receiptCandidates,
  shortageCandidates,
  canRecordReceipts,
  canCloseShortages,
});

const {
  totalCreateQty,
  shortageItems,
  excludeOrderIds,
  selectedVariantIdsForPicker,
  existingBrands,
  selectedSuggestionOrderIds,
  handleOrdersSelected,
  handleProductsSelected,
  removePoItem,
  executeCreate,
  handleCreate,
  handleCreateFromSuggestions,
} = usePurchaseOrderCreateFlow({
  t,
  addToast,
  createForm,
  poItems,
  pickerTarget,
  detail,
  detailRequestId,
  showDetail,
  showCreateModal,
  showSuggestions,
  showShortageConfirm,
  selectedSuggestions,
  createPO,
  createFromOrders,
  addItems,
  removeItem,
  refreshPurchaseOrderViews,
  validateOrderQuantity,
});

const detailHelpers = {
  formatInteger,
  formatPurchaseCurrency,
  formatDateTime,
  getProgressStatusLabel,
  getProgressStatusVariant,
  buildReceiptProgressSummary,
  buildReceiptMeta,
  getStepperProgress,
  getStepIconClasses,
  isStepCompleted,
  hasReceiptMeta,
  canReverseReceipt,
};

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
