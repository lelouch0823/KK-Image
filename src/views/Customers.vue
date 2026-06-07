<template>
  <ManagementListShell
    :title="t('customer.manage.title')"
    :description="t('customer.manage.subtitle')"
  >
    <template #actions>
      <!-- 导入客户 -->
      <AppButton variant="outline" size="sm" @click="showImportModal = true">
        <template #icon-left>
          <AppIcon name="arrow-up-tray" class="size-4" />
        </template>
        {{ t('customer.manage.importCustomers') }}
      </AppButton>

      <!-- 导出下拉菜单 -->
      <div ref="exportDropdownRef" class="relative">
        <AppButton
          variant="outline"
          size="sm"
          :disabled="exporting"
          @click="showExportDropdown = !showExportDropdown"
        >
          <template #icon-left>
            <AppIcon
              :name="exporting ? 'spinner' : 'arrow-down-tray'"
              :class="['size-4', { 'animate-spin': exporting }]"
            />
          </template>
          {{ t('customer.manage.exportAll') }}
          <AppIcon name="chevron-down" class="size-3 ml-1" />
        </AppButton>
        <div
          v-if="showExportDropdown"
          class="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-(--border-color) bg-(--bg-card) py-1 shadow-lg"
        >
          <AppButton
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            @click="handleExport('csv')"
          >
            <template #icon-left>
              <AppIcon name="document-text" class="size-4" />
            </template>
            {{ t('customer.manage.exportCsv') }}
          </AppButton>
          <AppButton
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            @click="handleExport('xlsx')"
          >
            <template #icon-left>
              <AppIcon name="document-chart-bar" class="size-4" />
            </template>
            {{ t('customer.manage.exportXlsx') }}
          </AppButton>
        </div>
      </div>

      <AppButton
        variant="primary"
        :text="t('customer.manage.addCustomer')"
        @click="openCreateModal"
      >
        <template #icon-left>
          <AppIcon name="plus" class="size-4" />
        </template>
      </AppButton>
    </template>

    <template #filters>
      <SearchInput
        v-model="searchQuery"
        :placeholder="t('customer.manage.searchPlaceholder')"
        :debounce="300"
        class="w-full sm:w-64"
        @search="handleSearch"
      />
    </template>

    <template #content>
      <div class="flex h-full min-h-[28rem] overflow-hidden">
        <div
          v-if="errorCode === ErrorCode.FORBIDDEN"
          class="flex w-full items-center justify-center p-8"
        >
          <PermissionDeniedState
            :title="t('customer.manage.permissionDenied')"
            :description="error || t('customer.manage.permissionDeniedDesc')"
            home-to="/admin/forbidden"
            :home-text="t('common.viewDetails')"
            @retry="loadCustomers"
          />
        </div>
        <template v-else>
          <!-- Left Side: Main Content -->
          <div class="flex min-w-0 flex-1 flex-col">
            <!-- 客户列表 -->
            <div class="flex-1 overflow-auto p-4 lg:p-0">
              <!-- 桌面端表格 (lg+) -->
              <div class="hidden size-full lg:block">
                <AppTable
                  :columns="columns"
                  :data="customers"
                  :loading="loading"
                  :empty-text="t('customer.manage.empty')"
                  :row-class="getRowClass"
                  :virtual="customers.length > 50"
                  no-border
                  clickable
                  @row-click="openDetail"
                >
                  <!-- 复选框列头 -->
                  <template #header-selection>
                    <div class="flex items-center justify-center">
                      <AppCheckbox
                        :checked="isAllSelected"
                        :indeterminate="isPartialSelected"
                        @change="toggleSelectAll"
                      />
                    </div>
                  </template>

                  <!-- 复选框列内容 -->
                  <template #cell-selection="{ row }">
                    <div class="flex items-center justify-center" @click.stop>
                      <AppCheckbox :checked="isIdSelected(row.id)" @change="toggleSelect(row.id)" />
                    </div>
                  </template>

                  <template #cell-name="{ row }">
                    <span class="font-medium text-(--text-main)">{{ row.name }}</span>
                  </template>

                  <template #cell-contact="{ row }">
                    <div class="flex flex-col gap-1 text-(--text-secondary)">
                      <!-- 电话 -->
                      <div v-if="row.phone" class="flex items-center gap-1">
                        <AppIcon name="phone" class="size-3 shrink-0" />
                        <span>{{ row.phone }}</span>
                      </div>
                      <!-- 邮箱 -->
                      <div v-if="row.email" class="flex items-center gap-1">
                        <AppIcon name="envelope" class="size-3 shrink-0" />
                        <span class="max-w-[180px] truncate" :title="row.email">{{
                          row.email
                        }}</span>
                      </div>
                      <!-- 无联系方式 -->
                      <span v-if="!row.phone && !row.email" class="text-(--text-muted)">-</span>
                    </div>
                  </template>

                  <template #cell-company="{ value }">
                    <span class="text-(--text-secondary)">{{ value || '-' }}</span>
                  </template>

                  <template #cell-segment="{ row }">
                    <StatusBadge
                      v-if="row.segment && row.segment !== 'new'"
                      :variant="segmentVariantMap[row.segment] || 'info'"
                      dot
                    >
                      {{ t(`customer.detail.segment${segmentLabelMap[row.segment]}`) }}
                    </StatusBadge>
                    <span v-else class="text-xs text-(--text-muted)">-</span>
                  </template>

                  <template #cell-tags="{ value }">
                    <div class="flex flex-wrap gap-1">
                      <StatusBadge v-for="tag in value" :key="tag" variant="primary">
                        {{ tag }}
                      </StatusBadge>
                    </div>
                  </template>

                  <template #cell-createdAt="{ value }">
                    <span class="text-xs text-(--text-secondary)">{{ formatDate(value) }}</span>
                  </template>

                  <template #cell-actions="{ row }">
                    <div class="flex justify-end pr-4" @click.stop>
                      <AppButton
                        variant="ghost"
                        size="sm"
                        class="p-1.5! opacity-0 group-hover:opacity-100"
                        :title="t('common.edit')"
                        @click="openEditModal(row)"
                      >
                        <template #icon-left>
                          <AppIcon name="pencil-square" class="size-4" />
                        </template>
                      </AppButton>
                    </div>
                  </template>

                  <!-- 分页 -->
                  <template #footer>
                    <div
                      v-if="pagination.totalPages > 1"
                      class="flex w-full items-center justify-between"
                    >
                      <span class="text-sm text-(--text-secondary)">
                        {{ t('common.total') }}: {{ pagination.total }}
                      </span>
                      <Pagination
                        :current-page="pagination.page"
                        :total-pages="pagination.totalPages"
                        @change="changePage"
                      />
                    </div>
                  </template>
                </AppTable>
              </div>

              <!-- 移动端列表 (<lg) -->
              <div class="lg:hidden">
                <CustomerCards
                  :data="customers"
                  :loading="loading"
                  @detail="openDetail"
                  @edit="openEditModal"
                />
                <!-- 移动端分页 -->
                <div v-if="pagination.totalPages > 1" class="mt-4 flex justify-center pb-4">
                  <Pagination
                    :current-page="pagination.page"
                    :total-pages="pagination.totalPages"
                    @change="changePage"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Right Side: Detail Panel (Desktop Push) -->
          <div
            v-if="showDetailPanel"
            class="hidden w-96 shrink-0 flex-col border-l border-(--border-color) bg-(--bg-card) transition-all duration-300 ease-out-expo lg:flex"
          >
            <CustomerDetailContent
              :customer="viewingCustomer"
              @close="showDetailPanel = false"
              @refresh="loadCustomers"
              @edit="openEditModal"
            />
          </div>

          <!-- Mobile Overlay Panel -->
          <CustomerDetailPanel
            v-model="showDetailPanel"
            class="lg:hidden"
            :customer="viewingCustomer"
            @refresh="loadCustomers"
            @edit="openEditModal"
          />
        </template>
      </div>
    </template>

    <!-- 客户表单弹窗 -->
    <Modal
      v-model="showFormModal"
      :title="editingId ? t('customer.manage.editTitle') : t('customer.manage.createTitle')"
    >
      <CustomerForm
        v-if="showFormModal"
        :initial-data="editingCustomer"
        @submit="handleFormSubmit"
        @cancel="showFormModal = false"
      />
    </Modal>

    <!-- 批量添加标签弹窗 -->
    <Modal v-model="showTagModal" :title="t('customer.manage.batchAddTag')">
      <div class="space-y-4 p-4">
        <p class="text-sm text-(--text-secondary)">
          {{
            t('customer.manage.batchAddTagConfirm', {
              count: selectedIds.length,
              tag: newTag || '...',
            })
          }}
        </p>
        <div>
          <AppInput
            v-model="newTag"
            :label="t('customer.form.tags')"
            :placeholder="t('customer.manage.tagInputPlaceholder')"
            @keydown.enter="handleBatchAddTag"
          />
        </div>
        <div class="flex justify-end gap-2">
          <AppButton variant="ghost" size="sm" @click="showTagModal = false">
            {{ t('common.cancel') }}
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            :disabled="!newTag.trim() || batchTagProcessing"
            @click="handleBatchAddTag"
          >
            <template #icon-left>
              <AppIcon v-if="batchTagProcessing" name="spinner" class="size-4 animate-spin" />
            </template>
            {{ t('common.confirm') }}
          </AppButton>
        </div>
      </div>
    </Modal>

    <!-- 客户导入弹窗 -->
    <CustomerImportModal v-model="showImportModal" @imported="loadCustomers" />

    <!-- 批量操作浮动栏 -->
    <FloatingSelectionBar :visible="selectedIds.length > 0">
      <template #summary>
        <span class="text-sm font-medium text-(--text-main)">
          {{ t('customer.manage.selectedCount', { count: selectedIds.length }) }}
        </span>
        <AppButton variant="link" size="sm" @click="clearBatchSelection">
          {{ t('customer.manage.cancelSelect') }}
        </AppButton>
      </template>

      <template #default>
        <!-- 批量添加标签 -->
        <AppButton
          variant="primary"
          size="sm"
          :disabled="batchTagProcessing || batchExporting"
          @click="showTagModal = true"
        >
          <template #icon-left>
            <AppIcon name="tag" class="size-4" />
          </template>
          {{ t('customer.manage.batchAddTag') }}
        </AppButton>

        <!-- 批量导出 -->
        <AppButton
          variant="outline"
          size="sm"
          :disabled="batchTagProcessing || batchExporting"
          @click="handleBatchExport"
        >
          <template #icon-left>
            <AppIcon
              :name="batchExporting ? 'spinner' : 'document-arrow-down'"
              :class="['size-4', { 'animate-spin': batchExporting }]"
            />
          </template>
          {{ t('customer.manage.batchExport') }}
        </AppButton>

        <!-- 分隔线 -->
        <div class="h-6 w-px bg-(--border-color)" />

        <!-- 取消选择 -->
        <AppButton
          variant="ghost"
          size="sm"
          :disabled="batchTagProcessing || batchExporting"
          @click="clearBatchSelection"
        >
          {{ t('customer.manage.cancelSelect') }}
        </AppButton>
      </template>
    </FloatingSelectionBar>
  </ManagementListShell>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onActivated, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onClickOutside } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { formatDate } from '@/utils/formatters';
import { API } from '@/utils/constants';
import { useManagedListSelection } from '@/composables/useManagedListSelection';
import SearchInput from '@/components/ui/SearchInput.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import CustomerForm from '@/components/customer/CustomerForm.vue';
import CustomerDetailPanel from '@/components/customer/CustomerDetailPanel.vue';
import CustomerDetailContent from '@/components/customer/CustomerDetailContent.vue';
import CustomerCards from '@/components/customer/CustomerCards.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import FloatingSelectionBar from '@/design-system/composed/FloatingSelectionBar.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import CustomerImportModal from '@/components/customer/CustomerImportModal.vue';
import { ErrorCode, isAuthError } from '@/utils/error-codes';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';
import { useRecentViews } from '@/composables/useRecentViews';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();
const { setContext } = useAI();
const { subscribeModule } = useAppRefreshBus();
const { addView: addRecentView } = useRecentViews();

const loading = ref(false);
const error = ref('');
const errorCode = ref(null);
const customers = ref([]);
const searchQuery = ref('');
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
});

const showFormModal = ref(false);
const editingId = ref(null);
const editingCustomer = ref(null);
const showDetailPanel = ref(false);
const viewingCustomer = ref(null);
let stopCustomersRefreshSubscription = null;

// 批量选择状态
const selectedIds = ref([]);
const showTagModal = ref(false);
const newTag = ref('');
const batchTagProcessing = ref(false);
const batchExporting = ref(false);

// 导入/导出状态
const showImportModal = ref(false);
const showExportDropdown = ref(false);
const exporting = ref(false);
const exportDropdownRef = ref(null);

const segmentLabelMap = {
  vip: 'Vip',
  active: 'Active',
  'at-risk': 'AtRisk',
  lost: 'Lost',
  new: 'New',
};

const segmentVariantMap = {
  vip: 'warning',
  active: 'success',
  'at-risk': 'danger',
  lost: 'neutral',
  new: 'info',
};

const columns = [
  { key: 'selection', label: '', align: 'center', width: '48px', class: 'px-0' },
  { key: 'name', label: t('customer.form.name') },
  { key: 'contact', label: t('customer.manage.searchPlaceholder') || 'Contact' },
  { key: 'company', label: t('customer.form.company') },
  { key: 'segment', label: t('customer.detail.segment'), width: '100px' },
  { key: 'tags', label: t('customer.form.tags') },
  { key: 'createdAt', label: t('common.createdAt', 'Created At') },
  { key: 'actions', label: '' },
];

const { clearSelection, getRowClass, handleCreated, selectItem } = useManagedListSelection();

// 批量选择计算属性
const isAllSelected = computed(
  () => customers.value.length > 0 && selectedIds.value.length === customers.value.length
);

const isPartialSelected = computed(
  () => selectedIds.value.length > 0 && selectedIds.value.length < customers.value.length
);

const isIdSelected = (id) => selectedIds.value.includes(id);

const toggleSelect = (id) => {
  const index = selectedIds.value.indexOf(id);
  if (index === -1) {
    selectedIds.value = [...selectedIds.value, id];
  } else {
    selectedIds.value = selectedIds.value.filter((i) => i !== id);
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = customers.value.map((c) => c.id);
  }
};

const clearBatchSelection = () => {
  selectedIds.value = [];
};

const loadCustomers = async (params = {}) => {
  loading.value = true;
  error.value = '';
  errorCode.value = null;
  try {
    const query = new URLSearchParams({
      page: params.page || pagination.page,
      limit: pagination.limit,
      search: searchQuery.value,
    });

    const res = await authFetch(`${API.MANAGE_CUSTOMER}?${query}`);
    const result = await res.json();

    if (result.success) {
      customers.value = result.data;
      pagination.total = result.pagination.total;
      pagination.totalPages = result.pagination.totalPages;
      pagination.page = result.pagination.page;
      return;
    }
    if ((result.error || result.message || '').includes('权限不足')) {
      errorCode.value = ErrorCode.FORBIDDEN;
      error.value = result.error || result.message || t('common.error.forbidden');
      return;
    }
    error.value = result.error || result.message || t('common.loadFailed');
    addToast({ message: error.value, type: 'error' });
  } catch (_e) {
    const code = classifyError(_e);
    errorCode.value = code;
    error.value = extractErrorMessage(_e, t('common.loadFailed'));
    if (!isAuthError(code)) {
      addToast({ message: error.value, type: 'error' });
    }
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.page = 1;
  loadCustomers();
};

const changePage = (page) => {
  loadCustomers({ page });
};

const openCreateModal = () => {
  editingId.value = null;
  editingCustomer.value = null;
  showFormModal.value = true;
};

const openEditModal = (customer) => {
  editingId.value = customer.id;
  editingCustomer.value = { ...customer }; // Clone
  showFormModal.value = true;
};

const openDetail = (customer) => {
  selectItem(customer);
  viewingCustomer.value = customer;
  showDetailPanel.value = true;
  // 记录最近访问
  addRecentView('customer', customer.id, customer.name || `客户 ${customer.id}`);
};

const handleFormSubmit = async (formData) => {
  try {
    const url = editingId.value ? `${API.MANAGE_CUSTOMER}/${editingId.value}` : API.MANAGE_CUSTOMER;

    const method = editingId.value ? 'PUT' : 'POST';

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const result = await res.json();

    if (result.success) {
      addToast({
        message: editingId.value ? t('common.updateSuccess') : t('common.createSuccess'),
        type: 'success',
      });
      showFormModal.value = false;

      if (editingId.value) {
        loadCustomers();

        if (viewingCustomer.value && viewingCustomer.value.id === editingId.value) {
          viewingCustomer.value = { ...viewingCustomer.value, ...formData };
        }
        return;
      }

      await handleCreated({
        createdId: result.data?.id,
        resetToFirstPage: () => {
          pagination.page = 1;
        },
        reload: () => loadCustomers({ page: 1 }),
        getItems: () => customers.value,
        openDetail,
        autoOpen: true,
        onHiddenByFilters: () => {
          addToast({
            message: t(
              'customer.manage.createdHiddenByFilters',
              '客户已创建，但当前筛选条件未显示该客户'
            ),
            type: 'info',
          });
        },
      });
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

/**
 * 批量添加标签
 */
const handleBatchAddTag = async () => {
  if (batchTagProcessing.value || selectedIds.value.length === 0 || !newTag.value.trim()) return;

  batchTagProcessing.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_BATCH_TAGS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: selectedIds.value,
        tag: newTag.value.trim(),
      }),
    });
    const result = await res.json();

    if (result.success) {
      addToast({
        message: t('customer.manage.batchAddTagSuccess'),
        type: 'success',
      });
      showTagModal.value = false;
      newTag.value = '';
      clearBatchSelection();
      loadCustomers();
    } else {
      addToast({
        message: result.message || result.error || t('common.operationFailed'),
        type: 'error',
      });
    }
  } catch (e) {
    console.error('Batch add tag error:', e);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    batchTagProcessing.value = false;
  }
};

/**
 * 批量导出客户
 */
const handleBatchExport = async () => {
  if (batchExporting.value || selectedIds.value.length === 0) return;

  batchExporting.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_BATCH_EXPORT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds.value }),
    });

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const disposition = res.headers.get('Content-Disposition');
    const filenameMatch = disposition && disposition.match(/filename="?(.+)"?/);
    link.download = filenameMatch
      ? filenameMatch[1]
      : `customers_${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    addToast({ message: t('customer.manage.batchExportSuccess'), type: 'success' });
  } catch (e) {
    console.error('Batch export error:', e);
    addToast({ message: t('customer.manage.batchExportFailed'), type: 'error' });
  } finally {
    batchExporting.value = false;
  }
};

/**
 * 导出全部客户
 */
const handleExport = async (format) => {
  showExportDropdown.value = false;
  if (exporting.value) return;
  exporting.value = true;

  try {
    const query = new URLSearchParams({ format });
    if (searchQuery.value) query.set('search', searchQuery.value);

    const res = await authFetch(`${API.MANAGE_CUSTOMER_EXPORT}?${query}`);
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const disposition = res.headers.get('Content-Disposition');
    const filenameMatch = disposition && disposition.match(/filename="?(.+)"?/);
    link.download = filenameMatch
      ? filenameMatch[1]
      : `customers_${new Date().toISOString().slice(0, 10)}.${format}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    addToast({ message: t('customer.manage.batchExportSuccess'), type: 'success' });
  } catch (e) {
    console.error('Export error:', e);
    addToast({ message: t('customer.manage.batchExportFailed'), type: 'error' });
  } finally {
    exporting.value = false;
  }
};

/**
 * 点击外部关闭导出下拉菜单
 */
onClickOutside(exportDropdownRef, () => {
  showExportDropdown.value = false;
});

onMounted(() => {
  stopCustomersRefreshSubscription = subscribeModule('customers', () => {
    if (!showFormModal.value) {
      loadCustomers();
    }
  });

  loadCustomers();
});

onActivated(() => {
  loadCustomers();
});

onUnmounted(() => {
  stopCustomersRefreshSubscription?.();
  stopCustomersRefreshSubscription = null;
});

watch([showDetailPanel, viewingCustomer], ([isOpen, customer]) => {
  if (!isOpen) {
    clearSelection();
  }
  if (isOpen && customer?.id) {
    setContext({
      selectedId: customer.id,
      selectedType: 'customer',
    });
    return;
  }
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

// 监听路由 query 中 id 参数变化，支持从最近访问跳转
watch(
  () => route.query.id,
  async (newId) => {
    if (newId && customers.value.length > 0) {
      const customer = customers.value.find((c) => c.id === newId);
      if (customer) {
        openDetail(customer);
      }
    }
  }
);

// 当详情面板关闭时，自动清理 URL 中的 id 参数
watch(showDetailPanel, (isOpen) => {
  if (!isOpen && route.query.id) {
    const query = { ...route.query };
    delete query.id;
    router.replace({ query });
  }
});
</script>
