<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <!-- 头部操作栏 -->
    <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">{{ t('salesperson.title') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('salesperson.subtitle') }}</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- 搜索 -->
        <SearchInput 
          v-model="searchQuery" 
          :placeholder="t('common.searchPlaceholder')"
          @search="handleSearch"
          class="w-full sm:w-64"
        />

        <!-- 新建按钮 -->
        <button 
          @click="openModal()"
          class="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
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
        />
      </div>

      <!-- 移动端卡片视图 (<lg) -->
      <div class="lg:hidden p-4">
        <SalespersonCards 
          :data="salespersons" 
          :loading="loading"
          @edit="openModal"
          @delete="confirmDelete"
          @copy="copyAccessLink"
        />
      </div>
    </div>

    <!-- 分页 -->
    <div class="p-4 border-t border-gray-200">
      <Pagination 
        v-model:currentPage="currentPage"
        :totalPages="pagination.totalPages"
        @change="changePage"
      />
    </div>

    <!-- 编辑/新建弹窗 -->
    <SalespersonForm 
      v-model="showModal"
      :salesperson="editingSalesperson"
      :submitting="submitting"
      @submit="handleSubmit"
      @resetToken="handleResetToken"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue';
import { useSalespersons } from '@/composables/useSalespersons';
import { useI18n } from '@/composables/useI18n';
import SearchInput from '@/components/ui/SearchInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import SalespersonTable from './salesperson/SalespersonTable.vue';
import SalespersonCards from './salesperson/SalespersonCards.vue';
import SalespersonForm from './salesperson/SalespersonForm.vue';

const { 
  salespersons, 
  loading, 
  pagination, 
  loadSalespersons, 
  createSalesperson, 
  updateSalesperson, 
  deleteSalesperson, 
  resetToken, 
  copyAccessLink 
} = useSalespersons();

const { t } = useI18n();

const searchQuery = ref('');
const showModal = ref(false);
const submitting = ref(false);
const editingSalesperson = ref(null);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {}
});

const currentPage = computed({
  get: () => pagination.value.page,
  set: () => {} // 由 changePage 处理
});

// 初始化
onMounted(() => {
  loadSalespersons();
});

onActivated(() => {
  loadSalespersons();
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
      loadSalespersons({ page: pagination.value.page });
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
          loadSalespersons({ page: pagination.value.page });
          confirmData.value.show = false;
        }
      } finally {
        confirmData.value.loading = false;
      }
    }
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
    }
  };
};
</script>
