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
        <div class="relative">
          <input 
            v-model="searchQuery"
            type="text"
            :placeholder="t('common.searchPlaceholder')"
            class="pl-9 pr-4 py-2 w-full sm:w-64 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
            @input="handleSearch"
          >
          <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>

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
      <table class="w-full text-sm text-left">
        <thead class="bg-gray-50 text-gray-500 font-medium">
          <tr>
            <th class="px-4 py-3">{{ t('salesperson.name') }}</th>
            <th class="px-4 py-3">{{ t('salesperson.store') }}</th>
            <th class="px-4 py-3 hidden sm:table-cell">{{ t('salesperson.phone') }}</th>
            <th class="px-4 py-3">{{ t('salesperson.orderCount') }}</th>
            <th class="px-4 py-3 text-center">{{ t('salesperson.status') }}</th>
            <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="loading" v-for="i in 3" :key="i" class="animate-pulse">
            <td v-for="j in 6" :key="j" class="px-4 py-4">
              <div class="h-4 bg-gray-200 rounded w-2/3"></div>
            </td>
          </tr>
          
          <template v-else-if="salespersons.length > 0">
            <tr v-for="person in salespersons" :key="person.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ person.name }}</div>
                <div class="text-xs text-gray-500 sm:hidden mt-0.5">{{ person.phone }}</div>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ person.store || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 hidden sm:table-cell">{{ person.phone || '-' }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {{ person.orderCount }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span 
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                  :class="person.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                >
                  {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button 
                    @click="copyAccessLink(person.accessToken)"
                    class="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                    :title="t('salesperson.copyLink')"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </button>
                  <button 
                    @click="openModal(person)"
                    class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    :title="t('salesperson.edit')"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                  </button>
                  <button 
                    @click="confirmDelete(person)"
                    class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    :title="t('common.delete')"
                    :disabled="person.orderCount > 0"
                    :class="{ 'opacity-50 cursor-not-allowed': person.orderCount > 0 }"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>

          <tr v-else>
            <td colspan="6" class="px-4 py-12 text-center text-gray-500">
              <div class="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              </div>
              <p>{{ t('salesperson.emptyList') }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="p-4 border-t border-gray-200 flex justify-center">
      <nav class="flex gap-1">
        <button 
          v-for="page in pagination.totalPages" 
          :key="page"
          @click="changePage(page)"
          class="px-3 py-1 text-sm rounded-md transition-colors"
          :class="page === pagination.page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'"
        >
          {{ page }}
        </button>
      </nav>
    </div>

    <!-- 编辑/新建弹窗 -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" @click.self="showModal = false">
      <div class="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ isEditing ? t('salesperson.edit') : t('salesperson.create') }}
          </h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <!-- 姓名 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('salesperson.name') }} <span class="text-red-500">*</span>
            </label>
            <input 
              v-model="form.name"
              type="text"
              :placeholder="t('salesperson.namePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
              required
            >
          </div>

          <!-- 门店 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('salesperson.store') }}
            </label>
            <input 
              v-model="form.store"
              type="text"
              :placeholder="t('salesperson.storePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
            >
          </div>

          <!-- 电话 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('salesperson.phone') }}
            </label>
            <input 
              v-model="form.phone"
              type="tel"
              :placeholder="t('salesperson.phonePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
            >
          </div>

          <!-- 密码 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t('salesperson.password') }}
              <span v-if="!isEditing" class="text-red-500">*</span>
            </label>
            <input 
              v-model="form.password"
              type="text"
              :placeholder="isEditing ? '不修改请留空' : t('salesperson.passwordPlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary outline-none transition-shadow"
              :required="!isEditing"
            >
            <p class="text-xs text-gray-500 mt-1">{{ t('salesperson.passwordHint') }}</p>
          </div>

          <!-- 状态 & 重置链接 (编辑模式) -->
          <div v-if="isEditing" class="pt-4 border-t border-gray-100 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">{{ t('salesperson.status') }}</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="form.isActive" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">{{ t('salesperson.accessLink') }}</span>
              <button 
                type="button"
                @click="handleResetToken"
                class="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                {{ t('salesperson.resetLink') }}
              </button>
            </div>
          </div>

          <!-- 提交按钮 -->
          <div class="pt-2 flex gap-3">
            <button 
              type="button" 
              @click="showModal = false"
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {{ t('common.cancel') }}
            </button>
            <button 
              type="submit"
              :disabled="submitting"
              class="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <svg v-if="submitting" class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ t('common.confirm') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useSalespersons } from '@/composables/useSalespersons';
import { useI18n } from '@/composables/useI18n';
import debounce from 'lodash/debounce'; // 假设项目有 lodash，如果没有即使手写也是简单的

const { salespersons, loading, pagination, loadSalespersons, createSalesperson, updateSalesperson, deleteSalesperson, resetToken, copyAccessLink } = useSalespersons();
const { t } = useI18n();

const searchQuery = ref('');
const showModal = ref(false);
const submitting = ref(false);
const editingId = ref(null);

const isEditing = computed(() => !!editingId.value);

const form = reactive({
  name: '',
  store: '',
  phone: '',
  password: '',
  isActive: true
});

// 初始化
onMounted(() => {
  loadSalespersons();
});

// 搜索 (防抖)
let searchTimeout;
const handleSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadSalespersons({ search: searchQuery.value, page: 1 });
  }, 300);
};

// 分页
const changePage = (page) => {
  loadSalespersons({ page, search: searchQuery.value });
};

// 打开弹窗
const openModal = (person = null) => {
  if (person) {
    editingId.value = person.id;
    form.name = person.name;
    form.store = person.store || '';
    form.phone = person.phone || '';
    form.password = ''; // 编辑时不回显密码
    form.isActive = person.isActive;
  } else {
    editingId.value = null;
    form.name = '';
    form.store = '';
    form.phone = '';
    form.password = '';
    form.isActive = true;
  }
  showModal.value = true;
};

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return;
  submitting.value = true;

  try {
    let success;
    if (isEditing.value) {
      success = await updateSalesperson(editingId.value, form);
    } else {
      success = await createSalesperson(form);
    }

    if (success) {
      showModal.value = false;
      loadSalespersons({ page: pagination.value.page }); // 刷新列表
    }
  } finally {
    submitting.value = false;
  }
};

// 删除确认
const confirmDelete = async (person) => {
  if (person.orderCount > 0) return;
  if (!confirm(t('salesperson.deleteConfirm').replace('{name}', person.name))) return;
  
  const success = await deleteSalesperson(person.id);
  if (success) {
    loadSalespersons({ page: pagination.value.page });
  }
};

// 重置链接
const handleResetToken = async () => {
  if (!confirm(t('salesperson.resetLinkConfirm'))) return;
  
  const result = await resetToken(editingId.value);
  if (result) {
    // 可以在这里显示新链接，或者只是提示成功
  }
};
</script>

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}
</style>
