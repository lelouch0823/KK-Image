<template>
  <!-- Root Container: Flex Row for Push Layout -->
  <div class="flex h-full overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-page) shadow-sm">
    <!-- Left Side: Main Content -->
    <div class="flex min-w-0 flex-1 flex-col bg-(--bg-card)">
      <!-- 头部操作栏 -->
      <div
        class="flex flex-shrink-0 flex-col justify-between gap-4 border-b border-(--border-color) p-4 sm:flex-row sm:items-center"
      >
        <div>
          <h2 class="text-lg font-semibold text-primary">{{ t('customer.manage.title') }}</h2>
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
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
          </AppButton>
        </div>
      </div>

      <!-- 客户列表 -->
      <div class="flex-1 overflow-auto">
        <!-- 桌面端表格 (lg+) -->
          <div class="relative hidden w-full lg:block">
           <table class="w-full text-left text-sm">
              <thead class="sticky top-0 z-10 bg-(--bg-card)/90 font-medium text-(--text-secondary) shadow-sm backdrop-blur-sm">
              <tr>
                  <th class="px-4 py-3">{{ t('customer.form.name') }}</th>
                  <th class="px-4 py-3">{{ t('customer.form.contact') }}</th>
                  <th class="px-4 py-3">{{ t('customer.form.company') }}</th>
                  <th class="px-4 py-3">{{ t('customer.form.tags') }}</th>
                  <th class="px-4 py-3">{{ t('common.createdAt') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
              </tr>
              </thead>
              <tbody class="divide-y divide-(--border-color)">
              <template v-if="loading">
                  <tr v-for="i in 5" :key="i" class="animate-pulse">
                  <td v-for="j in 6" :key="j" class="p-4">
                      <div class="h-4 w-2/3 rounded bg-(--bg-subtle)"></div>
                  </td>
                  </tr>
              </template>

              <template v-else-if="customers.length > 0">
                  <tr
                  v-for="customer in customers"
                  :key="customer.id"
                  class="group cursor-pointer transition-colors hover:bg-(--bg-hover)"
                  :class="{ 'bg-primary-50 dark:bg-primary/10': viewingCustomer?.id === customer.id }"
                  @click="openDetail(customer)"
                  >
                  <td class="px-4 py-3 font-medium text-(--text-main)">{{ customer.name }}</td>
                  <td class="px-4 py-3 text-(--text-secondary)">
                      <div class="flex flex-col gap-1">
                      <!-- 电话 -->
                      <div v-if="customer.phone" class="flex items-center gap-1">
                          <svg class="size-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                          </svg>
                          <span>{{ customer.phone }}</span>
                      </div>
                      <!-- 邮箱 -->
                      <div v-if="customer.email" class="flex items-center gap-1">
                          <svg class="size-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                          </svg>
                          <span class="max-w-[180px] truncate" :title="customer.email">{{ customer.email }}</span>
                      </div>
                      <!-- 无联系方式 -->
                      <span v-if="!customer.phone && !customer.email" class="text-muted">-</span>
                      </div>
                  </td>
                  <td class="px-4 py-3 text-(--text-secondary)">{{ customer.company || '-' }}</td>
                  <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="tag in customer.tags"
                          :key="tag"
                          class="rounded bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                        >
                          {{ tag }}
                      </span>
                      </div>
                  </td>
                  <td class="px-4 py-3 text-xs text-(--text-secondary)">{{ formatDate(customer.createdAt) }}</td>
                  <td class="px-4 py-3 text-right" @click.stop>
                      <AppButton
                        variant="ghost"
                        size="sm"
                        class="opacity-0 group-hover:opacity-100 !p-1.5"
                        :title="t('common.edit')"
                        @click="openEditModal(customer)"
                      >
                        <template #icon-left>
                          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </template>
                      </AppButton>
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

         <!-- 移动端列表 (<lg) -->
        <div class="p-4 lg:hidden">
           <CustomerCards
              :data="customers"
              :loading="loading"
              @detail="openDetail"
              @edit="openEditModal"
           />
        </div>
      </div>

      <!-- 分页 -->
      <div
        v-if="pagination.totalPages > 1"
        class="flex-shrink-0 border-t border-(--border-color) p-4"
      >
        <Pagination
          :current-page="pagination.page"
          :total-pages="pagination.totalPages"
          @change="changePage"
        />
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onActivated } from 'vue';
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
import CustomerDetailContent from '@/components/customer/CustomerDetailContent.vue';
import CustomerCards from '@/components/customer/CustomerCards.vue';
import AppButton from '@/components/ui/AppButton.vue';

const { t } = useI18n();
const { addToast } = useToast();

const loading = ref(false);
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

const loadCustomers = async (params = {}) => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      page: params.page || pagination.page,
      limit: pagination.limit,
      search: searchQuery.value,
    });

    const res = await fetch(`${API.MANAGE_CUSTOMER}?${query}`);
    const result = await res.json();

    if (result.success) {
      customers.value = result.data.list;
      pagination.total = result.data.total;
      pagination.totalPages = result.data.totalPages;
      pagination.page = result.data.page;
    }
  } catch (_e) {
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

    const res = await fetch(url, {
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
  loadCustomers();
});

onActivated(() => {
  loadCustomers();
});
</script>
