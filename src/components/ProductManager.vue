<template>
  <div class="flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] backdrop-blur-sm transition-all duration-500 lg:h-full">
    
    <!-- 1. Header (Compact like OrderManager) -->
    <div class="flex-shrink-0 border-b border-[var(--border-color)] p-3 sm:p-4">
      <div class="flex items-center justify-between gap-3">
        <!-- Title -->
        <div class="min-w-0">
            <h2 class="truncate text-base font-semibold text-[var(--text-main)] sm:text-lg">{{ t('product.manager.title') }}</h2>
            <p class="hidden text-sm text-[var(--text-secondary)] sm:block">{{ t('product.manager.subtitle') }}</p>
        </div>

        <!-- Actions -->
        <div class="flex shrink-0 items-center gap-1 sm:gap-2">
            <!-- Create Button -->
            <button 
                class="bg-primary shadow-primary/20 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:bg-primary-hover active:scale-95 max-sm:size-9 sm:h-9 sm:px-4"
                :title="t('product.action.create')"
                @click="handleCreate"
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 sm:size-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
                <span class="hidden sm:inline">{{ t('product.action.create') }}</span>
            </button>

            <!-- Import Button -->
            <button
                class="flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-indigo-600 active:scale-95"
                :title="t('product.action.import')"
                @click="showImportModal = true"
            >
                <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            </button>

            <!-- Export Button -->
            <button
                class="flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card-hover)] hover:text-indigo-600 active:scale-95"
                :title="t('product.action.export')"
                @click="handleExport"
            >
                <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>

             <!-- Stats Button -->
            <button
                class="flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--color-primary)] transition-all hover:bg-[var(--bg-card-hover)] active:scale-95"
                :title="t('product.manager.stats_overview')"
                @click="showStatsModal = true"
            >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </button>
        </div>
      </div>

       <!-- Filters Toolbar -->
       <div class="mt-2.5 sm:mt-3">
            <ProductFilters 
                v-model:search="filters.search" 
                v-model:status="filters.status"
                @refresh="loadProducts({ page: 1, status: filters.status, search: filters.search })"
            />
       </div>
    </div>

    <!-- Stats Modal (Popup) -->
    <Modal v-model="showStatsModal" :title="t('product.manager.stats_overview')">
        <ProductStats />
    </Modal>

    <!-- Import Modal -->
    <ProductImportModal
        v-model="showImportModal"
        @success="handleModalSuccess"
    />
    
    <!-- Create/Edit Modal -->
    <ProductCreateModal
        v-model="showCreateModal"
        :edit-mode="isEditMode"
        :initial-data="editingProduct"
        @success="handleModalSuccess"
    />

    <!-- Quick Share Space Modal -->
    <SpaceCreateModal
        v-if="showShareModal"
        :initial-product="sharingProduct"
        @close="showShareModal = false"
        @created="handleShareCreated"
    />

    <!-- Detail Modal -->
    <ProductDetailModal
        v-model:show="showDetailModal"
        :initial-data="viewingProduct"
    >
        <template #header-actions="{ product }">
            <button 
                class="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--text-inverse)]"
                @click="handleEditFromDetail(product)"
            >
                <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {{ t('product.action.edit') }}
            </button>
        </template>
    </ProductDetailModal>
    
    <!-- 2. Content Area (Table/Grid) -->
    <div class="relative flex-1 lg:min-h-[400px] lg:overflow-hidden">
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-page)]/50 backdrop-blur-[1px]">
        <div class="border-primary size-10 animate-spin rounded-full border-b-2"></div>
      </div>

      <!-- Desktop Table (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="custom-scrollbar hidden h-full overflow-auto lg:block">
         <ProductTable 
           :products="products" 
           @view="handleView"
           @edit="handleEdit" 
           @delete="handleDelete" 
           @share="handleShare"
        />
      </div>

      <!-- Mobile Grid (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="p-4 lg:hidden">
        <ProductGrid 
            :products="products" 
            @view="handleView"
            @edit="handleEdit"
            @share="handleShare"
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
                <button class="btn btn-primary" @click="handleCreate">
                    {{ t('product.action.create') }}
                </button>
            </template>
        </EmptyState>
      </div>
    </div>
    
    <!-- Footer / Pagination -->
     <div class="flex-shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-muted)] p-4">
        <Pagination
            v-model:current-page="pagination.page"
            :total-pages="pagination.totalPages"
            @change="(p) => loadProducts({ page: p })"
        />
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProducts } from '@/composables/useProducts';
const ProductStats = defineAsyncComponent(() => import('./product/ProductStats.vue'));
import ProductFilters from './product/ProductFilters.vue';
import ProductTable from './product/ProductTable.vue';
import ProductCreateModal from './product/ProductCreateModal.vue'; 
import ProductDetailModal from './product/ProductDetailModal.vue'; 
const ProductImportModal = defineAsyncComponent(() => import('./product/ProductImportModal.vue'));
import ProductGrid from './product/ProductGrid.vue';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Modal from '@/components/ui/Modal.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { products, loading, error, pagination, loadProducts, deleteProduct, loadProduct } = useProducts();

const showStatsModal = ref(false);
const showCreateModal = ref(false); 
const showDetailModal = ref(false);
const showImportModal = ref(false);
const showShareModal = ref(false);
const isEditMode = ref(false);
const editingProduct = ref(null);
const viewingProduct = ref(null);
const sharingProduct = ref(null);

const filters = reactive({
    search: '',
    status: ''
});

onMounted(async () => {
    loadProducts();
    
    // Auto-open edit modal if query param is present
    if (route.query.edit) {
        const product = await loadProduct(route.query.edit);
        if (product) {
            handleEdit(product);
            // Clean up the query param without reloading page
            const query = { ...route.query };
            delete query.edit;
            router.replace({ query });
        }
    }
});

const handleCreate = () => {
    isEditMode.value = false;
    editingProduct.value = {};
    showCreateModal.value = true;
};

const handleEdit = (product) => {
    isEditMode.value = true;
    editingProduct.value = { ...product };
    showCreateModal.value = true;
};

const handleView = (product) => {
    viewingProduct.value = { ...product };
    showDetailModal.value = true;
};

const handleShare = (product) => {
    sharingProduct.value = { ...product };
    showShareModal.value = true;
};

const handleShareCreated = (space) => {
    showShareModal.value = false;
    // Redirect to the space management page automatically for this new space
    router.push(`/manage/space/${space.id}`);
};

const handleEditFromDetail = (product) => {
    showDetailModal.value = false;
    handleEdit(product);
};

const handleModalSuccess = () => {
    loadProducts();
};

const handleDelete = async (product) => {
    if (confirm(t('product.action.delete_confirm_message', { name: product.name }))) {
        await deleteProduct(product.id);
        loadProducts(); 
    }
};

const handleExport = () => {
    // Open the backend export endpoint
    window.open('/api/manage/products/export?format=csv', '_blank');
};
</script>
