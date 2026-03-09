<template>
  <div class="flex h-full overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-page) shadow-sm">
    <div v-if="errorCode === 'FORBIDDEN'" class="flex w-full items-center justify-center p-8">
      <PermissionDeniedState
        title="客户管理权限不足"
        :description="error || '当前账号没有客户读取权限，请联系管理员分配 customers:read。'"
        home-to="/admin/forbidden"
        home-text="查看权限说明"
        @retry="loadCustomers"
      />
    </div>
    <template v-else>
    <!-- Left Side: Main Content -->
    <div class="flex min-w-0 flex-1 flex-col bg-(--bg-card)">
      <!-- 头部操作栏 -->
      <div
        class="flex shrink-0 flex-col justify-between gap-4 border-b border-(--border-color) p-4 sm:flex-row sm:items-center"
      >
        <div>
          <h2 class="text-primary text-lg font-semibold">{{ t('customer.manage.title') }}</h2>
          <p class="mt-1 text-sm text-(--text-secondary)">{{ t('customer.manage.subtitle') }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- 搜索 -->
          <SearchInput
            v-model="searchQuery"
            :placeholder="t('customer.manage.searchPlaceholder')"
            class="w-full sm:w-64"
            @search="handleSearch"
          />

          <!-- 添加按钮 -->
          <AppButton
            variant="primary"
            :text="t('customer.manage.addCustomer')"
            @click="openCreateModal"
          >
            <template #icon-left>
                <AppIcon name="plus" class="size-4" />
            </template>
          </AppButton>
        </div>
      </div>

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
            no-border
            clickable
            @row-click="openDetail"
          >

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
                    <span class="max-w-[180px] truncate" :title="row.email">{{ row.email }}</span>
                </div>
                <!-- 无联系方式 -->
                <span v-if="!row.phone && !row.email" class="text-(--text-muted)">-</span>
              </div>
            </template>
            
            <template #cell-company="{ value }">
               <span class="text-(--text-secondary)">{{ value || '-' }}</span>
            </template>

            <template #cell-tags="{ value }">
              <div class="flex flex-wrap gap-1">
                <StatusBadge
                  v-for="tag in value"
                  :key="tag"
                  variant="primary"
                >
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
      class="hidden w-96 shrink-0 flex-col border-l border-(--border-color) bg-(--bg-card) transition-all duration-300 ease-in-out lg:flex"
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
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onActivated, onUnmounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { formatDate } from '@/utils/formatters';
import { API } from '@/utils/constants';
import SearchInput from '@/components/ui/SearchInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import CustomerForm from '@/components/customer/CustomerForm.vue';
import CustomerDetailPanel from '@/components/customer/CustomerDetailPanel.vue';
import CustomerDetailContent from '@/components/customer/CustomerDetailContent.vue';
import CustomerCards from '@/components/customer/CustomerCards.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();
const { setContext } = useAI();
const { subscribeModule } = useAppRefreshBus();

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

const getRowClass = (row) => {
  return viewingCustomer.value?.id === row.id ? 'bg-(--color-primary-bg)/50' : '';
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
      customers.value = result.data.list;
      pagination.total = result.data.total;
      pagination.totalPages = result.data.totalPages;
      pagination.page = result.data.page;
      return;
    }
    if ((result.error || result.message || '').includes('权限不足')) {
      errorCode.value = 'FORBIDDEN';
      error.value = result.error || result.message || '权限不足';
      return;
    }
    error.value = result.error || result.message || t('common.loadFailed');
    addToast({ message: error.value, type: 'error' });
  } catch (_e) {
    const status = Number(_e?.status || 0);
    if (status === 403) {
      errorCode.value = 'FORBIDDEN';
      error.value = _e?.data?.error || _e?.message || '权限不足';
      return;
    }
    if (status === 401) {
      errorCode.value = 'UNAUTHORIZED';
      error.value = _e?.data?.error || _e?.message || '未授权';
      return;
    }
    errorCode.value = 'NETWORK_ERROR';
    error.value = _e?.message || t('common.loadFailed');
    addToast({ message: t('common.loadFailed'), type: 'error' });
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
  viewingCustomer.value = customer;
  showDetailPanel.value = true;
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
      loadCustomers();

      // Update viewing customer if open
      if (viewingCustomer.value && viewingCustomer.value.id === editingId.value) {
        viewingCustomer.value = { ...viewingCustomer.value, ...formData };
      }
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

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
</script>
