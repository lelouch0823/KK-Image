<template>
  <div class="space-y-6">
    <!-- ===== 列表视图 ===== -->
    <template v-if="!selectedStocktake">
      <DashboardShell
        :title="t('stocktake.title')"
        :description="t('stocktake.subtitle')"
      >
        <template #actions>
          <AppButton
            variant="primary"
            size="sm"
            :loading="creating"
            @click="handleCreate"
          >
            <template #icon-left>
              <AppIcon name="plus" class="size-4" />
            </template>
            {{ t('stocktake.action.create') }}
          </AppButton>
        </template>

        <template #summary>
          <StatGroup :columns="4">
            <MetricTile
              :label="t('stocktake.summary.total')"
              :value="summary.total"
              icon="clipboard-document-check"
              tone="primary"
              flat
            />
            <MetricTile
              :label="t('stocktake.summary.counting')"
              :value="summary.counting"
              icon="clock"
              tone="warning"
              flat
            />
            <MetricTile
              :label="t('stocktake.summary.adjusted')"
              :value="summary.adjusted"
              icon="check-circle"
              tone="success"
              flat
            />
            <MetricTile
              :label="t('stocktake.summary.diffItems')"
              :value="summary.diffItems"
              icon="exclamation-triangle"
              tone="danger"
              flat
            />
          </StatGroup>
        </template>

        <template #main>
          <!-- 筛选 -->
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <AppButton
              v-for="f in statusFilters"
              :key="f.value"
              :variant="currentFilter === f.value ? 'primary' : 'ghost'"
              size="sm"
              @click="currentFilter = f.value; loadList()"
            >
              {{ f.label }}
            </AppButton>
          </div>

          <!-- 加载中 -->
          <div v-if="loadingList" class="py-12 text-center text-secondary">
            <div class="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>

          <!-- 空状态 -->
          <div
            v-else-if="stocktakes.length === 0"
            class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-12 text-center"
          >
            <AppIcon name="clipboard-document-check" class="mx-auto size-12 text-(--text-muted)" />
            <p class="mt-4 text-lg font-medium text-(--text-main)">{{ t('stocktake.empty') }}</p>
            <p class="mt-1 text-sm text-secondary">{{ t('stocktake.emptyHint') }}</p>
          </div>

          <!-- 列表表格 -->
          <AppTable
            v-else
            :columns="listColumns"
            :data="stocktakes"
            clickable
            no-border
            row-key="id"
            :min-rows="5"
            @row-click="(row) => openDetail(row.id)"
          >
            <template #cell-status="{ row }">
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="statusClass(row.status)"
              >
                {{ t(`stocktake.status.${row.status}`) }}
              </span>
            </template>
            <template #cell-itemCount="{ row }">
              <span class="text-(--text-main)">{{ row.itemCount }}</span>
            </template>
            <template #cell-countedItems="{ row }">
              <span class="text-(--text-main)">{{ row.countedItems }}</span>
            </template>
            <template #cell-diffItems="{ row }">
              <span v-if="row.diffItems > 0" class="text-danger font-medium">{{ row.diffItems }}</span>
              <span v-else class="text-secondary">0</span>
            </template>
            <template #cell-createdAt="{ row }">
              <span class="text-secondary">{{ formatDate(row.createdAt) }}</span>
            </template>
            <template #cell-notes="{ row }">
              <span class="max-w-[200px] truncate text-secondary">{{ row.notes || '-' }}</span>
            </template>
            <template #cell-actions>
              <AppIcon name="chevron-right" class="size-4 text-(--text-muted)" />
            </template>
          </AppTable>

          <!-- 分页 -->
          <div
            v-if="totalPages > 1"
            class="mt-4 flex items-center justify-between text-sm text-secondary"
          >
            <span>{{ t('stocktake.pagination.total', { count: totalCount }) }}</span>
            <div class="flex items-center gap-2">
              <AppButton
                variant="ghost"
                size="sm"
                :disabled="currentPage <= 1"
                @click="currentPage--; loadList()"
              >
                {{ t('stocktake.pagination.prev') }}
              </AppButton>
              <span>{{ currentPage }} / {{ totalPages }}</span>
              <AppButton
                variant="ghost"
                size="sm"
                :disabled="currentPage >= totalPages"
                @click="currentPage++; loadList()"
              >
                {{ t('stocktake.pagination.next') }}
              </AppButton>
            </div>
          </div>
        </template>
      </DashboardShell>
    </template>

    <!-- ===== 详情视图 ===== -->
    <template v-else>
      <DashboardShell
        :title="t('stocktake.detail.title')"
        :description="`#${selectedStocktake.id.slice(0, 8)}`"
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <AppButton variant="ghost" size="sm" @click="selectedStocktake = null">
              <template #icon-left>
                <AppIcon name="arrow-left" class="size-4" />
              </template>
              {{ t('stocktake.action.back') }}
            </AppButton>

            <template v-if="selectedStocktake.status === 'counting'">
              <AppButton
                variant="primary"
                size="sm"
                :loading="adjusting"
                @click="handleAdjust"
              >
                <template #icon-left>
                  <AppIcon name="check-circle" class="size-4" />
                </template>
                {{ t('stocktake.action.adjust') }}
              </AppButton>
            </template>

            <template v-if="selectedStocktake.status === 'draft' || selectedStocktake.status === 'counting'">
              <AppButton
                variant="ghost"
                size="sm"
                class="text-danger hover:bg-(--color-danger-bg)"
                :loading="cancelling"
                @click="handleCancel"
              >
                {{ t('stocktake.action.cancel') }}
              </AppButton>
            </template>
          </div>
        </template>

        <template #summary>
          <StatGroup :columns="3">
            <MetricTile
              :label="t('stocktake.table.status')"
              :value="t(`stocktake.status.${selectedStocktake.status}`)"
              icon="information-circle"
              :tone="statusTone(selectedStocktake.status)"
              flat
            />
            <MetricTile
              :label="t('stocktake.detail.total', { count: selectedStocktake.items.length })"
              :value="`${countedCount}/${selectedStocktake.items.length}`"
              icon="clipboard-document-check"
              tone="primary"
              flat
            />
            <MetricTile
              :label="t('stocktake.summary.diffItems')"
              :value="diffCount"
              icon="exclamation-triangle"
              :tone="diffCount > 0 ? 'danger' : 'success'"
              flat
            />
          </StatGroup>
        </template>

        <template #main>
          <!-- 盘点明细表格 -->
          <AppTable
            :columns="detailColumns"
            :data="selectedStocktake.items"
            no-border
            row-key="id"
            :min-rows="5"
          >
            <template #cell-product="{ row }">
              <div class="text-(--text-main)">
                <div class="font-medium">{{ row.productName }}</div>
                <div v-if="row.optionsValues" class="text-xs text-secondary">
                  {{ formatVariantLabel(row.optionsValues) }}
                </div>
              </div>
            </template>
            <template #cell-sku="{ row }">
              <span class="font-mono text-xs text-secondary">{{ row.sku }}</span>
            </template>
            <template #cell-systemQty="{ row }">
              <span class="text-(--text-main)">{{ row.systemQty }}</span>
            </template>
            <template #cell-actualQty="{ row }">
              <template v-if="isEditing">
                <AppInput
                  v-model="editValues[row.id]"
                  type="number"
                  min="0"
                  size="sm"
                  class="!w-20"
                  :placeholder="t('stocktake.form.actualQtyPlaceholder')"
                />
              </template>
              <template v-else>
                <span :class="{ 'font-medium': row.actualQty != null }">
                  {{ row.actualQty != null ? row.actualQty : '-' }}
                </span>
              </template>
            </template>
            <template #cell-difference="{ row }">
              <template v-if="row.difference != null">
                <span
                  class="font-medium"
                  :class="{
                    'text-danger': row.difference > 0,
                    'text-success': row.difference < 0,
                    'text-secondary': row.difference === 0,
                  }"
                >
                  {{ row.difference > 0 ? '+' : '' }}{{ row.difference }}
                </span>
              </template>
              <template v-else>-</template>
            </template>
            <template #cell-notes="{ row }">
              <span class="text-secondary">{{ row.notes || '-' }}</span>
            </template>
            <template #row="{ row }">
              <tr :class="{ 'bg-danger/5': row.difference != null && row.difference !== 0 }" />
            </template>
          </AppTable>

          <!-- 编辑操作栏 -->
          <div
            v-if="isEditing"
            class="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <span class="text-sm text-secondary">
              {{ t('stocktake.detail.counted') }}: {{ Object.keys(editValues).length }} / {{ selectedStocktake.items.length }}
            </span>
            <div class="flex items-center gap-2">
              <AppButton variant="ghost" size="sm" @click="isEditing = false">
                {{ t('common.cancel') }}
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                :loading="saving"
                @click="handleSaveItems"
              >
                {{ t('stocktake.action.save') }}
              </AppButton>
            </div>
          </div>

          <!-- 非编辑状态下的操作 -->
          <div
            v-else-if="selectedStocktake.status === 'draft' || selectedStocktake.status === 'counting'"
            class="mt-4 flex justify-end"
          >
            <AppButton variant="primary" size="sm" @click="startEditing">
              <template #icon-left>
                <AppIcon name="pencil" class="size-4" />
              </template>
              {{ t('stocktake.action.save') }}
            </AppButton>
          </div>
        </template>
      </DashboardShell>
    </template>

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model="showAdjustConfirm"
      type="warning"
      :title="t('stocktake.confirm.adjustTitle')"
      :message="t('stocktake.confirm.adjustMessage')"
      :confirm-text="t('stocktake.action.confirmAdjust')"
      :loading="adjusting"
      @confirm="confirmAdjust"
    />
    <ConfirmDialog
      v-model="showCancelConfirm"
      type="danger"
      :title="t('stocktake.confirm.cancelTitle')"
      :message="t('stocktake.confirm.cancelMessage')"
      :confirm-text="t('stocktake.action.confirmCancel')"
      :loading="cancelling"
      @confirm="confirmCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';
import StatGroup from '@/design-system/composed/StatGroup.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppTable from '@/components/ui/AppTable.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { formatDate } from '@/utils/formatters';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetchJson } = useAuth();

// ─── 列表状态 ───────────────────────────────────────────

const stocktakes = ref([]);
const loadingList = ref(false);
const creating = ref(false);
const currentPage = ref(1);
const totalCount = ref(0);
const currentFilter = ref('');
const pageSize = 20;

const totalPages = computed(() => Math.ceil(totalCount.value / pageSize) || 1);

const summary = computed(() => {
  const items = stocktakes.value;
  return {
    total: totalCount.value,
    counting: items.filter(s => s.status === 'counting').length,
    adjusted: items.filter(s => s.status === 'adjusted').length,
    diffItems: items.reduce((sum, s) => sum + (s.diffItems || 0), 0),
  };
});

const statusFilters = computed(() => [
  { value: '', label: t('stocktake.filter.all') },
  { value: 'draft', label: t('stocktake.filter.draft') },
  { value: 'counting', label: t('stocktake.filter.counting') },
  { value: 'adjusted', label: t('stocktake.filter.adjusted') },
  { value: 'cancelled', label: t('stocktake.filter.cancelled') },
]);

const listColumns = computed(() => [
  { key: 'status', label: t('stocktake.table.status') },
  { key: 'itemCount', label: t('stocktake.table.itemCount') },
  { key: 'countedItems', label: t('stocktake.table.countedItems'), class: 'hidden md:table-cell' },
  { key: 'diffItems', label: t('stocktake.table.diffItems'), class: 'hidden md:table-cell' },
  { key: 'createdAt', label: t('stocktake.table.createdAt'), class: 'hidden lg:table-cell' },
  { key: 'notes', label: t('stocktake.table.notes'), class: 'hidden lg:table-cell' },
  { key: 'actions', label: '' },
]);

const detailColumns = computed(() => [
  { key: 'product', label: t('stocktake.detail.product') },
  { key: 'sku', label: t('stocktake.detail.sku'), class: 'hidden md:table-cell' },
  { key: 'systemQty', label: t('stocktake.detail.systemQty'), class: 'hidden md:table-cell' },
  { key: 'actualQty', label: t('stocktake.detail.actualQty') },
  { key: 'difference', label: t('stocktake.detail.difference') },
  { key: 'notes', label: t('stocktake.detail.notes'), class: 'hidden lg:table-cell' },
]);

// ─── 详情状态 ───────────────────────────────────────────

const selectedStocktake = ref(null);
const isEditing = ref(false);
const editValues = ref({});
const saving = ref(false);
const adjusting = ref(false);
const cancelling = ref(false);
const showAdjustConfirm = ref(false);
const showCancelConfirm = ref(false);

const countedCount = computed(() => {
  if (!selectedStocktake.value) return 0;
  return selectedStocktake.value.items.filter(i => i.actualQty != null).length;
});

const diffCount = computed(() => {
  if (!selectedStocktake.value) return 0;
  return selectedStocktake.value.items.filter(i => i.difference != null && i.difference !== 0).length;
});

// ─── 加载列表 ───────────────────────────────────────────

async function loadList() {
  loadingList.value = true;
  try {
    const params = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(pageSize),
    });
    if (currentFilter.value) params.set('status', currentFilter.value);

    const resp = await authFetchJson(`${API.MANAGE_STOCKTAKES}?${params}`);
    stocktakes.value = resp.data || [];
    totalCount.value = resp.total || 0;
  } catch (err) {
    console.error('加载盘点列表失败:', err);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    loadingList.value = false;
  }
}

// ─── 创建盘点 ───────────────────────────────────────────

async function handleCreate() {
  creating.value = true;
  try {
    const resp = await authFetchJson(API.MANAGE_STOCKTAKES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: null }),
    });
    addToast({ message: t('stocktake.toast.created'), type: 'success' });
    await loadList();
    if (resp.data?.id) {
      openDetail(resp.data.id);
    }
  } catch (err) {
    console.error('创建盘点失败:', err);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    creating.value = false;
  }
}

// ─── 打开详情 ───────────────────────────────────────────

async function openDetail(id) {
  try {
    const resp = await authFetchJson(API.MANAGE_STOCKTAKE_BY_ID(id));
    selectedStocktake.value = resp.data;
    isEditing.value = false;
    editValues.value = {};
  } catch (err) {
    console.error('加载盘点详情失败:', err);
    addToast({ message: t('common.networkError'), type: 'error' });
  }
}

// ─── 编辑明细 ───────────────────────────────────────────

function startEditing() {
  if (!selectedStocktake.value) return;
  const values = {};
  for (const item of selectedStocktake.value.items) {
    values[item.id] = item.actualQty ?? item.systemQty;
  }
  editValues.value = values;
  isEditing.value = true;
}

async function handleSaveItems() {
  if (!selectedStocktake.value) return;
  saving.value = true;
  try {
    const items = Object.entries(editValues.value)
      .filter(([, qty]) => qty != null && qty !== '')
      .map(([itemId, actualQty]) => ({
        itemId,
        actualQty: Number(actualQty),
      }));

    if (items.length === 0) return;

    await authFetchJson(API.MANAGE_STOCKTAKE_ITEMS(selectedStocktake.value.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    addToast({ message: t('stocktake.toast.updated'), type: 'success' });
    isEditing.value = false;

    // 重新加载详情
    await openDetail(selectedStocktake.value.id);
  } catch (err) {
    console.error('保存盘点明细失败:', err);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    saving.value = false;
  }
}

// ─── 调整库存 ───────────────────────────────────────────

function handleAdjust() {
  if (diffCount.value === 0) {
    addToast({ message: t('stocktake.toast.noDifference'), type: 'info' });
    return;
  }
  showAdjustConfirm.value = true;
}

async function confirmAdjust() {
  if (!selectedStocktake.value) return;
  adjusting.value = true;
  try {
    await authFetchJson(API.MANAGE_STOCKTAKE_ADJUST(selectedStocktake.value.id), {
      method: 'POST',
    });
    addToast({ message: t('stocktake.toast.adjusted'), type: 'success' });
    showAdjustConfirm.value = false;
    await openDetail(selectedStocktake.value.id);
    await loadList();
  } catch (err) {
    console.error('调整库存失败:', err);
    addToast({ message: t('stocktake.toast.adjustFailed'), type: 'error' });
  } finally {
    adjusting.value = false;
  }
}

// ─── 取消盘点 ───────────────────────────────────────────

function handleCancel() {
  showCancelConfirm.value = true;
}

async function confirmCancel() {
  if (!selectedStocktake.value) return;
  cancelling.value = true;
  try {
    await authFetchJson(API.MANAGE_STOCKTAKE_CANCEL(selectedStocktake.value.id), {
      method: 'POST',
    });
    addToast({ message: t('stocktake.toast.cancelled'), type: 'success' });
    showCancelConfirm.value = false;
    selectedStocktake.value = null;
    await loadList();
  } catch (err) {
    console.error('取消盘点失败:', err);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    cancelling.value = false;
  }
}

// ─── 工具函数 ───────────────────────────────────────────

function statusClass(status) {
  const map = {
    draft: 'bg-(--color-muted-bg) text-secondary',
    counting: 'bg-warning/10 text-warning',
    adjusted: 'bg-success/10 text-success',
    cancelled: 'bg-(--color-muted-bg) text-(--text-muted)',
  };
  return map[status] || map.draft;
}

function statusTone(status) {
  const map = { draft: 'muted', counting: 'warning', adjusted: 'success', cancelled: 'muted' };
  return map[status] || 'muted';
}


function formatVariantLabel(optionsValues) {
  if (!optionsValues || typeof optionsValues !== 'object') return '';
  try {
    const parsed = typeof optionsValues === 'string' ? JSON.parse(optionsValues) : optionsValues;
    return Object.values(parsed).join(' / ');
  } catch {
    return '';
  }
}

// ─── 初始化 ─────────────────────────────────────────────

onMounted(() => {
  loadList();
});
</script>
