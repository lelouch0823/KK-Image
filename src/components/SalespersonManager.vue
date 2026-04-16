<template>
  <ManagementListShell :title="t('salesperson.title')" :description="t('salesperson.subtitle')">
    <template #actions>
      <AppButton
        v-if="canManageSalespersons"
        variant="primary"
        class="shadow-lg"
        @click="openModal()"
      >
        <template #icon-left>
          <AppIcon name="plus" class="size-4" />
        </template>
        {{ t('salesperson.create') }}
      </AppButton>
    </template>

    <template #filters>
      <SearchInput
        v-model="searchQuery"
        :placeholder="t('common.searchPlaceholder')"
        class="w-full sm:w-64"
        @search="handleSearch"
      />
    </template>

    <template #content>
    <div v-if="errorCode === 'FORBIDDEN'" class="p-2 sm:p-4">
      <PermissionDeniedState
        title="销售人员管理权限不足"
        :description="error || '当前账号没有销售人员管理权限，请联系管理员分配 salespersons:manage。'"
        required-permission="users:read"
        @retry="loadSalespersons()"
      />
    </div>
    <template v-else>
    <div class="overflow-x-auto">
      <!-- 桌面表格视图 (lg+) -->
      <div class="hidden lg:block">
        <SalespersonTable
          :data="salespersons"
          :loading="loading"
          :row-class="getRowClass"
          :can-manage="canManageSalespersons"
          @edit="openModal"
          @delete="confirmDelete"
          @copy="copyAccessLink"
          @view-orders="handleViewOrders"
          @view-detail="handleViewDetail"
        />
      </div>

      <!-- 移动端卡片视图 (<lg) -->
      <div class="p-4 lg:hidden">
        <SalespersonCards
          :data="salespersons"
          :loading="loading"
          :card-class="getRowClass"
          :can-manage="canManageSalespersons"
          @edit="openModal"
          @delete="confirmDelete"
          @copy="copyAccessLink"
          @view-orders="handleViewOrders"
          @view-detail="handleViewDetail"
        />
      </div>
    </div>

    <!-- 分页 -->
    <div class="mt-4 border-t border-(--border-color)/70 pt-4">
      <Pagination
        v-model:current-page="currentPage"
        :total-pages="pagination.totalPages"
        @change="changePage"
      />
    </div>

    <!-- 编辑/新建弹窗 -->
    <SalespersonForm
      v-model="showModal"
      :salesperson="editingSalesperson"
      :submitting="submitting"
      @submit="handleSubmit"
      @reset-token="handleResetToken"
    />

    <!-- 详情弹窗 -->
    <SalespersonDetailModal
      v-model="showDetailModal"
      :person="detailPerson"
      @view-orders="handleViewOrders"
      @copy="copyAccessLink"
    />

    <!-- 确认弹窗 -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
    </template>
    </template>
  </ManagementListShell>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSalespersons } from '@/composables/useSalespersons';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { useManagedListSelection } from '@/composables/useManagedListSelection';
import { useAccessControl } from '@/composables/useAccessControl';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Pagination from '@/components/ui/Pagination.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import SalespersonTable from './salesperson/SalespersonTable.vue';
import SalespersonCards from './salesperson/SalespersonCards.vue';
import SalespersonForm from './salesperson/SalespersonForm.vue';
import SalespersonDetailModal from './salesperson/SalespersonDetailModal.vue';

const {
  salespersons,
  loading,
  error,
  errorCode,
  pagination,
  loadSalespersons,
  createSalesperson,
  updateSalesperson,
  deleteSalesperson,
  resetToken,
  copyAccessLink,
} = useSalespersons();

const { t } = useI18n();
const { addToast } = useToast();
const router = useRouter();
const { subscribeModule } = useAppRefreshBus();
const { hasPermission, loadPermissions } = useAccessControl();

const searchQuery = ref('');
const showModal = ref(false);
const submitting = ref(false);
const editingSalesperson = ref(null);
const showDetailModal = ref(false);
const detailPerson = ref(null);
let stopSalespersonsRefreshSubscription = null;
const { clearSelection, getRowClass, handleCreated, selectItem } = useManagedListSelection();
const canManageSalespersons = ref(false);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const currentPage = computed({
  get: () => pagination.page,
  set: () => {}, // 由 changePage 处理
});

const refreshCurrentList = (forceRefresh = false) => {
  return loadSalespersons(
    {
      page: pagination.page || 1,
      search: searchQuery.value,
    },
    forceRefresh
  );
};

// 初始化
onMounted(() => {
  loadPermissions().then(() => {
    canManageSalespersons.value = hasPermission('users:write');
  });

  stopSalespersonsRefreshSubscription = subscribeModule('salespersons', () => {
    if (!showModal.value && !showDetailModal.value) {
      refreshCurrentList(true);
    }
  });

  refreshCurrentList();
});

onActivated(() => {
  refreshCurrentList();
});

onUnmounted(() => {
  stopSalespersonsRefreshSubscription?.();
  stopSalespersonsRefreshSubscription = null;
});

// 搜索
const handleSearch = (value) => {
  loadSalespersons({ search: value, page: 1 });
};

// 分页
const changePage = (page) => {
  loadSalespersons({ page, search: searchQuery.value });
};

// 打开弹窗
const openModal = (person = null) => {
  if (!canManageSalespersons.value) return;
  editingSalesperson.value = person;
  showModal.value = true;
};

// 提交表单
const handleSubmit = async (formData) => {
  if (submitting.value) return;
  submitting.value = true;

  try {
    let success;
    if (formData.id) {
      success = await updateSalesperson(formData.id, formData);
    } else {
      success = await createSalesperson(formData);
    }

    if (success) {
      showModal.value = false;
      if (formData.id) {
        await refreshCurrentList(true);
        return;
      }

      await handleCreated({
        createdId: success.id,
        resetToFirstPage: () => {
          pagination.page = 1;
        },
        reload: () => loadSalespersons({ page: 1, search: searchQuery.value }, true),
        getItems: () => salespersons.value,
        autoOpen: true,
        openDetail: (person) => {
          handleViewDetail(person);
        },
        onHiddenByFilters: () => {
          addToast({
            message: t('salesperson.createdHiddenByFilters', '销售人员已创建，但当前筛选条件未显示该项'),
            type: 'info',
          });
        },
      });
    }
  } finally {
    submitting.value = false;
  }
};

// 删除确认
const confirmDelete = (person) => {
  if (person.orderCount > 0) return;

  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('salesperson.deleteConfirm').replace('{name}', person.name),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const success = await deleteSalesperson(person.id);
        if (success) {
          refreshCurrentList(true);
          confirmData.value.show = false;
        }
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

// 重置访问链接
const handleResetToken = () => {
  if (!editingSalesperson.value) return;

  confirmData.value = {
    show: true,
    title: t('salesperson.resetLink'),
    message: t('salesperson.resetLinkConfirm'),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await resetToken(editingSalesperson.value.id);
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

// 查看销售订单 - 跳转到订单管理页面并筛选该销售
const handleViewOrders = (person) => {
  router.push({
    name: 'Orders',
    query: { salesperson: person.id },
  });
};

const handleViewDetail = (person) => {
  selectItem(person);
  detailPerson.value = person;
  showDetailModal.value = true;
};

watch(showDetailModal, (isOpen) => {
  if (!isOpen) {
    clearSelection();
  }
});
</script>
