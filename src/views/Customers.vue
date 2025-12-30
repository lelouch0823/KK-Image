<template>
  <div class="h-full flex flex-col bg-white rounded-xl shadow-sm border border-[var(--border-color)]">
    <!-- 头部操作栏 -->
    <div class="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-primary">{{ t('customer.manage.title') }}</h2>
        <p class="text-sm text-secondary mt-1">{{ t('customer.manage.subtitle') }}</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- 搜索 -->
        <SearchInput 
          v-model="searchQuery"
          :placeholder="t('customer.manage.searchPlaceholder')"
          @search="handleSearch"
          class="w-full sm:w-64"
        />

        <!-- 添加按钮 -->
        <button
          @click="openCreateModal"
          class="h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2 flex-shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          {{ t('customer.manage.addCustomer') }}
        </button>
      </div>
    </div>

    <!-- 客户列表 -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-sm text-left relative">
        <thead class="bg-[var(--bg-muted)] text-secondary font-medium sticky top-0 z-10 shadow-sm">
          <tr>
            <th class="px-4 py-3">{{ t('customer.form.name') }}</th>
            <th class="px-4 py-3">{{ t('customer.form.contact') }}</th>
            <th class="px-4 py-3">{{ t('customer.form.company') }}</th>
            <th class="px-4 py-3">{{ t('customer.form.tags') }}</th>
            <th class="px-4 py-3">{{ t('common.createdAt') }}</th>
            <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-color)]">
          <template v-if="loading">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td v-for="j in 6" :key="j" class="px-4 py-4">
                <div class="h-4 bg-[var(--bg-subtle)] rounded w-2/3"></div>
              </td>
            </tr>
          </template>
          
          <template v-else-if="customers.length > 0">
            <tr 
              v-for="customer in customers" 
              :key="customer.id" 
              class="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              @click="openDetail(customer)"
            >
              <td class="px-4 py-3 font-medium text-primary">{{ customer.name }}</td>
              <td class="px-4 py-3 text-secondary">
                <div v-if="customer.phone" class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  {{ customer.phone }}
                </div>
                <!-- TODO: Email support -->
              </td>
              <td class="px-4 py-3 text-secondary">{{ customer.company || '-' }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in customer.tags" :key="tag" class="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {{ tag }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-secondary text-xs">{{ formatDate(customer.createdAt) }}</td>
              <td class="px-4 py-3 text-right" @click.stop>
                <button 
                  @click="openEditModal(customer)"
                  class="text-primary hover:text-primary-hover p-1"
                  :title="t('common.edit')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
              </td>
            </tr>
          </template>

          <tr v-else>
            <td colspan="6" class="px-4 py-16 text-center">
              <EmptyState icon="users" :title="t('customer.manage.empty')" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="p-4 border-t border-[var(--border-color)] flex-shrink-0">
      <Pagination 
        :currentPage="pagination.page" 
        :totalPages="pagination.totalPages"
        @change="changePage"
      />
    </div>

    <!-- 客户表单弹窗 -->
    <Modal v-model="showFormModal" :title="editingId ? t('customer.manage.editTitle') : t('customer.manage.createTitle')">
      <CustomerForm 
        v-if="showFormModal"
        :initialData="editingCustomer"
        @submit="handleFormSubmit"
        @cancel="showFormModal = false"
      />
    </Modal>

    <!-- 客户详情侧边栏 -->
    <CustomerDetailPanel
      v-model="showDetailPanel"
      :customer="viewingCustomer"
      @refresh="loadCustomers"
      @edit="openEditModal"
    />

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatDate } from '@/utils/formatters';
import { API } from '@/utils/constants';
import SearchInput from '@/components/ui/SearchInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Modal from '@/components/ui/Modal.vue';
import CustomerForm from '@/components/customer/CustomerForm.vue';
import CustomerDetailPanel from '@/components/customer/CustomerDetailPanel.vue';

const { t } = useI18n();
const { addToast } = useToast();

const loading = ref(false);
const customers = ref([]);
const searchQuery = ref('');
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1
});

const showFormModal = ref(false);
const editingId = ref(null);
const editingCustomer = ref(null);
const showDetailPanel = ref(false);
const viewingCustomer = ref(null);

const loadCustomers = async (params = {}) => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      page: params.page || pagination.page,
      limit: pagination.limit,
      search: searchQuery.value
    });
    
    const res = await fetch(`${API.MANAGE_CUSTOMER}?${query}`);
    const result = await res.json();
    
    if (result.success) {
      customers.value = result.data.list;
      pagination.total = result.data.total;
      pagination.totalPages = result.data.totalPages;
      pagination.page = result.data.page;
    }
  } catch (e) {
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
    const url = editingId.value 
      ? `${API.MANAGE_CUSTOMER}/${editingId.value}`
      : API.MANAGE_CUSTOMER;
      
    const method = editingId.value ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const result = await res.json();
    
    if (result.success) {
      addToast({ message: editingId.value ? t('common.updateSuccess') : t('common.createSuccess'), type: 'success' });
      showFormModal.value = false;
      loadCustomers();
      
      // Update viewing customer if open
      if (viewingCustomer.value && viewingCustomer.value.id === editingId.value) {
        viewingCustomer.value = { ...viewingCustomer.value, ...formData };
      }
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

onMounted(() => {
  loadCustomers();
});
</script>
