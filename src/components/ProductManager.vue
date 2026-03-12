<template>
  <ManagementListShell :title="t('product.manager.title')" :description="t('product.manager.subtitle')">
      <template #actions>
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
                class="hover:text-info hover:bg-(--bg-hover) flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-secondary) transition-all active:scale-95"
                :title="t('product.action.import')"
                @click="showImportModal = true"
            >
                <AppIcon name="arrow-up-tray" class="size-5" />
            </button>

            <!-- Export Button -->
            <button
                class="hover:text-info hover:bg-(--bg-hover) flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-secondary) transition-all active:scale-95"
                :title="t('product.action.export')"
                @click="handleExport"
            >
                <AppIcon name="arrow-down-tray" class="size-5" />
            </button>

             <!-- Stats Button -->
            <button
                class="text-primary flex size-9 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-card) transition-all hover:bg-(--bg-hover) active:scale-95"
                :title="t('product.manager.stats_overview')"
                @click="showStatsModal = true"
            >
                <AppIcon name="chart-bar" class="size-5" />
            </button>
      </template>

      <template #filters>
            <ProductFilters 
                v-model:search="filters.search" 
                v-model:status="filters.status"
                @refresh="loadProducts({ page: 1, status: filters.status, search: filters.search })"
            />
      </template>

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
        :initializing="queryEditInitializing"
        :initialization-error="queryEditError"
        @retry-init="() => route.query.edit && handleQueryEditOpen(route.query.edit)"
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
    <ProductWorkflowModal
        v-model:show="showDetailModal"
        :product="viewingProduct"
        @success="handleModalSuccess"
    />

      <template #content>
    <div class="relative lg:min-h-[400px] lg:overflow-hidden">
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
     <div class="border-t border-(--border-color) bg-(--bg-muted) p-4">
        <Pagination
            v-model:current-page="pagination.page"
            :total-pages="pagination.totalPages"
            @change="(p) => loadProducts({ page: p })"
        />
    </div>
      </template>
  </ManagementListShell>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, defineAsyncComponent, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProducts } from '@/composables/useProducts';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
const ProductStats = defineAsyncComponent(() => import('./product/ProductStats.vue'));
import ProductFilters from './product/ProductFilters.vue';
import ProductTable from './product/ProductTable.vue';
import ProductCreateModal from './product/ProductCreateModal.vue'; 
import ProductWorkflowModal from './product/ProductWorkflowModal.vue'; 
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
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { setContext } = useAI();
const { subscribeModule } = useAppRefreshBus();

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
const queryEditInitializing = ref(false);
const queryEditError = ref('');
let stopProductsRefreshSubscription = null;

const filters = reactive({
    search: '',
    status: ''
});

onMounted(async () => {
    stopProductsRefreshSubscription = subscribeModule('products', () => {
        if (!showCreateModal.value && !showDetailModal.value && !showImportModal.value && !showExportModal.value) {
            loadProducts({
                page: pagination.page || 1,
                status: filters.status,
                search: filters.search,
            }, true);
        }
    });

    loadProducts();
    
    // Auto-open edit modal if query param is present
    if (route.query.edit) {
        handleQueryEditOpen(route.query.edit);
    }
});

onUnmounted(() => {
    stopProductsRefreshSubscription?.();
    stopProductsRefreshSubscription = null;
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

const handleQueryEditOpen = async (productId) => {
    if (!productId) return;
    isEditMode.value = true;
    showCreateModal.value = true;
    queryEditInitializing.value = true;
    queryEditError.value = '';
    editingProduct.value = editingProduct.value || {};

    try {
        const product = await loadProduct(productId);
        if (product) {
            handleEdit(product);
            const query = { ...route.query };
            delete query.edit;
            router.replace({ query });
            return;
        }
        queryEditError.value = t('product.workflow.edit_load_failed', 'Failed to load the editor. Please try again.');
    } catch (error) {
        queryEditError.value = error?.message || t('product.workflow.edit_load_failed', 'Failed to load the editor. Please try again.');
    } finally {
        queryEditInitializing.value = false;
    }
};

const decorateProductPreview = (product) => {
    if (!product) return null;
    const preview = { ...product };
    const variants = Array.isArray(preview.variants) ? preview.variants : [];
    if (!preview.selectedVariant && variants.length > 0) {
        preview.selectedVariant = variants.find((variant) => variant.status === 'active') || variants[0];
    }
    preview.mainImage = resolveBoundProductMainImageSrc(preview) || preview.mainImage || null;
    return preview;
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
    viewingProduct.value = decorateProductPreview(product);
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

const handleModalSuccess = () => {
    loadProducts(
        {
            page: pagination.page || 1,
            status: filters.status,
            search: filters.search,
        },
        true
    );
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

watch(showCreateModal, (isOpen) => {
    if (!isOpen) {
        queryEditInitializing.value = false;
        queryEditError.value = '';
        editingProduct.value = null;
        isEditMode.value = false;
        if (route.query.edit) {
            const query = { ...route.query };
            delete query.edit;
            router.replace({ query });
        }
    }
});
</script>
