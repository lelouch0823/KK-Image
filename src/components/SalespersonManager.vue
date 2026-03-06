<template>
  <div class="rounded-xl border border-(--border-color) bg-(--bg-card) shadow-sm">
    <div v-if="errorCode === 'FORBIDDEN'" class="p-6">
      <PermissionDeniedState
        title="销售人员管理权限不足"
        :description="error || '当前账号没有销售人员管理权限，请联系管理员分配 salespersons:manage。'"
        required-permission="users:read"
        @retry="loadSalespersons()"
      />
    </div>
    <template v-else>
    <!-- 头部操作栏 -->
    <!-- 头部操作栏 -->
    <div
      class="flex flex-col gap-4 border-b border-(--border-color) p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <!-- Title Section -->
      <div class="flex items-center justify-between sm:block">
        <div>
          <h2 class="text-lg font-semibold text-(--text-main)">{{ t('salesperson.title') }}</h2>
          <p class="mt-1 text-sm text-(--text-secondary)">{{ t('salesperson.subtitle') }}</p>
        </div>

        <!-- Mobile Create Button -->
        <button
          class="bg-primary shadow-primary/20 flex size-9 items-center justify-center rounded-xl text-(--text-inverse) shadow-lg transition-all active:scale-95 sm:hidden "
          @click="openModal()"
        >
          <AppIcon name="plus" class="size-5" />
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- 搜索 -->
        <SearchInput
          v-model="searchQuery"
          :placeholder="t('common.searchPlaceholder')"
          class="w-full sm:w-64"
          @search="handleSearch"
        />

        <!-- 新建按钮 (Desktop) -->
        <button
          class="bg-primary shadow-primary/10 hidden items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-(--text-inverse) shadow-lg transition-all hover:bg-(--color-primary-hover) active:scale-95 sm:flex "
          @click="openModal()"
        >
          <AppIcon name="plus" class="size-4" />
          {{ t('salesperson.create') }}
        </button>
      </div>
    </div>

    <!-- 列表内容 -->
    <div class="overflow-x-auto">
      <!-- 桌面表格视图 (lg+) -->
      <div class="hidden lg:block">
        <SalespersonTable
          :data="salespersons"
          :loading="loading"
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
          @edit="openModal"
          @delete="confirmDelete"
          @copy="copyAccessLink"
          @view-orders="handleViewOrders"
          @view-detail="handleViewDetail"
        />
      </div>
    </div>

    <!-- 分页 -->
    <div class="border-t border-(--border-color) p-4">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { useSalespersons } from '@/composables/useSalespersons';
import { useI18n } from '@/composables/useI18n';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Pagination from '@/components/ui/Pagination.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
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
const router = useRouter();

const searchQuery = ref('');
const showModal = ref(false);
const submitting = ref(false);
const editingSalesperson = ref(null);
const showDetailModal = ref(false);
const detailPerson = ref(null);

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
  loadSalespersons(
    {
      page: pagination.page || 1,
      search: searchQuery.value,
    },
    forceRefresh
  );
};

// 初始化
onMounted(() => {
  refreshCurrentList();
});

onActivated(() => {
  refreshCurrentList();
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
      refreshCurrentList(true);
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
  detailPerson.value = person;
  showDetailModal.value = true;
};
</script>
