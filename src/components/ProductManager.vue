<template>
  <div class="flex h-full flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] backdrop-blur-sm transition-all duration-500">
    
    <!-- 1. Header & Stats Area -->
    <div class="space-y-6 border-b border-[var(--border-color)] p-6">
      
      <!-- Title & Actions -->
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 class="text-primary flex items-center gap-2 font-[Outfit] text-2xl font-bold">
            <span class="bg-primary/10 text-primary rounded-lg p-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            </span>
            {{ t('product.manager.title') }}
          </h1>
          <p class="mt-1 ml-12 text-sm text-[var(--text-muted)]">
            {{ t('product.manager.subtitle') }}
          </p>
        </div>
        
        <div class="flex items-center gap-3">
            <!-- Add Product Button (Luxury Gradient) -->
            <button 
                class="btn btn-primary group relative overflow-hidden"
                @click="showCreateModal = true"
            >
                <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity duration-300 group-hover:opacity-10"></div>
                <span class="relative flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="size-5 " viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                  </svg>
                  {{ t('product.action.create') }}
                </span>
            </button>
        </div>
      </div>

      <!-- Mobile Stats Toggle -->
      <div class="mb-2 lg:hidden">
        <button
            class="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition-colors dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
            @click="statsCollapsed = !statsCollapsed"
        >
            <span class="flex items-center gap-2">
            <svg class="size-4 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {{ t('product.manager.stats_overview') || t('product.stats.total_products') }}
            </span>
            <svg
            class="size-4  transition-transform duration-200"
            :class="{ 'rotate-180': !statsCollapsed }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </button>
      </div>

      <!-- Stats Cards (Collapsible on Mobile) -->
      <div class="overflow-hidden transition-all duration-300" :class="{'max-h-0 opacity-0 lg:max-h-none lg:opacity-100': statsCollapsed, 'max-h-[500px] opacity-100': !statsCollapsed}">
        <ProductStats />
      </div>
      
      <!-- Filters Toolbar -->
      <ProductFilters 
        v-model:search="filters.search" 
        v-model:status="filters.status"
        @refresh="loadProducts({ page: 1 })"
      />
    </div>

    <!-- 2. Content Area (Table/Grid) -->
    <div class="relative min-h-[400px] flex-1 overflow-hidden">
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-slate-900/50">
        <div class="size-10  animate-spin rounded-full border-b-2 border-indigo-500"></div>
      </div>

      <!-- Desktop Table (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="custom-scrollbar hidden h-full overflow-auto lg:block">
         <ProductTable 
           :products="products" 
           @edit="openEdit" 
           @delete="handleDelete" 
        />
      </div>

      <!-- Mobile Grid (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="h-full overflow-auto p-4 lg:hidden">
        <ProductGrid 
            :products="products" 
            @edit="openEdit"
        />
      </div>

      <!-- Empty State / Error State -->
      <div v-if="!loading && (products.length === 0 || error)" class="flex h-full items-center justify-center p-8">
        <EmptyState
            v-if="error"
            icon="search" 
            :title="t('common.error.network_error')"
            :description="error"
        >
            <template #action>
                 <button class="btn btn-primary" @click="loadProducts()">
                    {{ t('common.action.retry') }}
                 </button>
            </template>
        </EmptyState>
        
        <EmptyState 
            v-else
            icon="plus" 
            :title="t('product.text.empty_title') || t('common.text.empty_data')"
            :description="t('product.text.empty_description') || t('common.text.create_first_item')"
        >
            <template #action>
                <button class="btn btn-primary" @click="showCreateModal = true">
                    {{ t('product.action.create') }}
                </button>
            </template>
        </EmptyState>
      </div>
    </div>
    
    <!-- Footer / Pagination -->
     <div class="border-t border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
        <Pagination
            v-model:current-page="pagination.page"
            :total-pages="pagination.totalPages"
            @change="(p) => loadProducts({ page: p })"
        />
    </div>

    <!-- Creation Modal -->
    <ProductCreateModal 
        v-if="showCreateModal" 
        v-model="showCreateModal"
        @success="handleSuccess"
    />

    <!-- Edit Modal (Reuses Create Modal probably or separate) -->
    <ProductCreateModal
        v-if="showEditModal"
        v-model="showEditModal"
        :edit-mode="true"
        :initial-data="editingProduct"
        @success="handleSuccess"
    />

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';
import ProductStats from './product/ProductStats.vue';
import ProductFilters from './product/ProductFilters.vue';
import ProductTable from './product/ProductTable.vue';
import ProductGrid from './product/ProductGrid.vue';
import ProductCreateModal from './product/ProductCreateModal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { products, loading, error, pagination, loadProducts, deleteProduct } = useProducts();

const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingProduct = ref(null);
const statsCollapsed = ref(true); // Default collapsed on mobile for better focus on list

const filters = reactive({
    search: '',
    status: ''
});

onMounted(() => {
    loadProducts();
});

const openEdit = (product) => {
    editingProduct.value = product;
    showEditModal.value = true;
};

const handleSuccess = () => {
    showCreateModal.value = false;
    showEditModal.value = false;
    loadProducts(); // refresh
};

const handleDelete = async (product) => {
    if (confirm(t('product.action.delete_confirm_message', { name: product.name }))) {
        await deleteProduct(product.id);
    }
}
</script>


