<template>
  <div class="flex flex-col rounded-xl border border-(--border-color) bg-(--bg-page) backdrop-blur-sm transition-all duration-500 lg:h-full">
    
    <!-- 1. Header (Compact like OrderManager) -->
    <div class="shrink-0 border-b border-(--border-color) p-3 sm:p-4">
      <div class="flex items-center justify-between gap-3">
        <!-- Title -->
        <div class="min-w-0">
            <h2 class="truncate text-base font-semibold text-(--text-main) sm:text-lg">{{ t('product.manager.title') }}</h2>
            <p class="hidden text-sm text-(--text-secondary) sm:block">{{ t('product.manager.subtitle') }}</p>
        </div>

        <!-- Actions -->
        <div class="flex shrink-0 items-center gap-1 sm:gap-2">
            <!-- Create Button -->
            <button 
                class="bg-primary shadow-primary/20 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:bg-primary-hover active:scale-95 max-sm:size-9 sm:h-9 sm:px-4"
                :title="t('product.action.create')"
                @click="handleCreate"
            >
                <AppIcon name="plus" class="size-5 sm:size-4" />
                <span class="hidden sm:inline">{{ t('product.action.create') }}</span>
            </button>

            <!-- Import Button -->
            <button
                class="flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-input) text-(--text-secondary) transition-all hover:bg-(--bg-card-hover) hover:text-indigo-600 active:scale-95"
                :title="t('product.action.import')"
                @click="showImportModal = true"
            >
                <AppIcon name="arrow-up-tray" class="size-5" />
            </button>

            <!-- Export Button -->
            <button
                class="flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-input) text-(--text-secondary) transition-all hover:bg-(--bg-card-hover) hover:text-indigo-600 active:scale-95"
                :title="t('product.action.export')"
                @click="handleExport"
            >
                <AppIcon name="arrow-down-tray" class="size-5" />
            </button>

             <!-- Stats Button -->
            <button
                class="text-primary flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-input) transition-all hover:bg-(--bg-card-hover) active:scale-95"
                :title="t('product.manager.stats_overview')"
                @click="showStatsModal = true"
            >
                <AppIcon name="chart-bar" class="size-5" />
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

    <!-- Export Modal -->
    <ProductExportModal
        v-model="showExportModal"
        :filters="filters"
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
                class="hover:bg-primary hover:text-inverse bg-primary/10 text-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                @click="handleEditFromDetail(product)"
            >
                <AppIcon name="pencil-square" class="size-3.5" />
                {{ t('product.action.edit') }}
            </button>
        </template>
    </ProductDetailModal>
    
    <!-- 2. Content Area (Table/Grid) -->
    <div class="relative flex-1 lg:min-h-[400px] lg:overflow-hidden">
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-(--bg-page)/50 backdrop-blur-[1px]">
        <AppIcon name="spinner" class="text-primary size-10 animate-spin" />
      </div>

      <!-- Desktop Table (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="custom-scrollbar hidden h-full overflow-auto lg:block">
         <ProductTable 
           :products="products" 
           @view="handleView"
           @edit="handleEditWithHydration" 
           @delete="handleDelete" 
           @share="handleShare"
        />
      </div>

      <!-- Mobile Grid (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="p-4 lg:hidden">
        <ProductGrid 
            :products="products" 
            @view="handleView"
            @edit="handleEditWithHydration"
            @share="handleShare"
        />
      </div>

      <!-- Empty State / Error State -->
      <div v-if="!loading && (products.length === 0 || error)" class="flex h-full items-center justify-center p-8">
        <PermissionDeniedState
            v-if="error && errorCode === 'FORBIDDEN'"
            :reason="error"
            @retry="loadProducts()"
        />
        <EmptyState
            v-else-if="error"
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
     <div class="shrink-0 border-t border-(--border-color) bg-(--bg-muted) p-4">
        <Pagination
            v-model:current-page="pagination.page"
            :total-pages="pagination.totalPages"
            @change="(p) => loadProducts({ page: p })"
        />
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, defineAsyncComponent, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProducts } from '@/composables/useProducts';
import { useAI } from '@/composables/useAI';
const ProductStats = defineAsyncComponent(() => import('./product/ProductStats.vue'));
import ProductFilters from './product/ProductFilters.vue';
import ProductTable from './product/ProductTable.vue';
import ProductCreateModal from './product/ProductCreateModal.vue'; 
import ProductDetailModal from './product/ProductDetailModal.vue'; 
const ProductImportModal = defineAsyncComponent(() => import('./product/ProductImportModal.vue'));
const ProductExportModal = defineAsyncComponent(() => import('./product/ProductExportModal.vue'));
import ProductGrid from './product/ProductGrid.vue';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Modal from '@/components/ui/Modal.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import { useI18n } from '@/composables/useI18n';
import { resolveBoundProductMainImageSrc } from '@/utils/product-image.js';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { setContext } = useAI();

const { products, loading, error, errorCode, pagination, loadProducts, deleteProduct, loadProduct } = useProducts();

const showStatsModal = ref(false);
const showCreateModal = ref(false); 
const showDetailModal = ref(false);
const showImportModal = ref(false);
const showExportModal = ref(false);
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
    showCreateModal.value = true;
    editingProduct.value = { ...product };
};

const hydrateProductWithVariants = async (product) => {
    const full = await loadProduct(product.id);
    const hydrated = full ? { ...full } : { ...product };
    const variants = Array.isArray(hydrated.variants) ? hydrated.variants : [];
    if (!hydrated.selectedVariant && variants.length > 0) {
        hydrated.selectedVariant = variants.find((variant) => variant.status === 'active') || variants[0];
    }
    hydrated.mainImage = resolveBoundProductMainImageSrc(hydrated) || hydrated.mainImage || null;
    return hydrated;
};

const handleEditWithHydration = async (product) => {
    isEditMode.value = true;
    editingProduct.value = await hydrateProductWithVariants(product);
    showCreateModal.value = true;
};

const handleView = async (product) => {
    viewingProduct.value = await hydrateProductWithVariants(product);
    showDetailModal.value = true;
};

const handleShare = async (product) => {
    sharingProduct.value = await hydrateProductWithVariants(product);
    showShareModal.value = true;
};

const handleShareCreated = (space) => {
    showShareModal.value = false;
    // Redirect to the space management page automatically for this new space
    router.push(`/manage/space/${space.id}`);
};

const handleEditFromDetail = async (product) => {
    showDetailModal.value = false;
    await handleEditWithHydration(product);
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
    showExportModal.value = true;
};

watch([showDetailModal, viewingProduct], ([isOpen, product]) => {
    if (isOpen && product?.id) {
        setContext({
            selectedId: product.id,
            selectedType: 'product',
        });
        return;
    }
    setContext({
        selectedId: null,
        selectedType: null,
    });
});
</script>
