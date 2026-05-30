<template>
  <ManagementListShell :title="t('product.manager.title')" :description="t('product.manager.subtitle')">
      <template #actions>
            <!-- Create Button -->
            <AppButton
                variant="primary"
                size="sm"
                class="shadow-sm max-sm:size-9 max-sm:!px-0 lg:hidden"
                :title="t('product.action.create')"
                @click="handleCreate"
            >
                <template #icon-left>
                    <AppIcon name="plus" class="size-5 sm:size-4" />
                </template>
                <span class="hidden sm:inline">{{ t('product.action.create') }}</span>
            </AppButton>

            <!-- Import Button -->
            <AppButton
                variant="white"
                size="sm"
                class="size-9 !px-0 hover:text-info lg:hidden"
                :title="t('product.action.import')"
                @click="showImportModal = true"
            >
                <template #icon-left>
                    <AppIcon name="arrow-up-tray" class="size-5" />
                </template>
            </AppButton>

            <!-- Export Button -->
            <AppButton
                variant="white"
                size="sm"
                class="size-9 !px-0 hover:text-info lg:hidden"
                :title="t('product.action.export')"
                @click="handleExport"
            >
                <template #icon-left>
                    <AppIcon name="arrow-down-tray" class="size-5" />
                </template>
            </AppButton>

             <!-- Stats Button -->
            <AppButton
                variant="white"
                size="sm"
                class="size-9 !px-0 text-primary hover:text-primary lg:hidden"
                :title="t('product.manager.stats_overview')"
                @click="showStatsModal = true"
            >
                <template #icon-left>
                    <AppIcon name="chart-bar" class="size-5" />
                </template>
            </AppButton>
      </template>

      <template #filters>
            <ProductFilters 
                v-model:search="filters.search" 
                v-model:status="filters.status"
                v-model:brand="filters.brand"
                v-model:category="filters.category"
                v-model:has-stock="filters.hasStock"
                :brand-options="brandOptions"
                :category-options="categoryOptions"
                @refresh="handleFilterRefresh"
            >
                <template #actions>
                    <AppButton
                        data-testid="product-create-trigger"
                        variant="primary"
                        size="sm"
                        class="whitespace-nowrap shadow-sm"
                        :title="t('product.action.create')"
                        @click="handleCreate"
                    >
                        <template #icon-left>
                            <AppIcon name="plus" class="size-4" />
                        </template>
                        <span>{{ t('product.action.create') }}</span>
                    </AppButton>

                    <AppButton
                        data-testid="product-import-trigger"
                        variant="white"
                        size="sm"
                        class="size-9 !px-0 hover:text-info"
                        :title="t('product.action.import')"
                        @click="showImportModal = true"
                    >
                        <template #icon-left>
                            <AppIcon name="arrow-up-tray" class="size-5" />
                        </template>
                    </AppButton>

                    <AppButton
                        variant="white"
                        size="sm"
                        class="size-9 !px-0 hover:text-info"
                        :title="t('product.action.export')"
                        @click="handleExport"
                    >
                        <template #icon-left>
                            <AppIcon name="arrow-down-tray" class="size-5" />
                        </template>
                    </AppButton>

                    <AppButton
                        variant="white"
                        size="sm"
                        class="size-9 !px-0 text-primary hover:text-primary"
                        :title="t('product.manager.stats_overview')"
                        @click="showStatsModal = true"
                    >
                        <template #icon-left>
                            <AppIcon name="chart-bar" class="size-5" />
                        </template>
                    </AppButton>
                </template>
            </ProductFilters>
      </template>

    <!-- Stats Modal (Popup) -->
    <Modal v-model="showStatsModal" :title="t('product.manager.stats_overview')">
        <ProductStats :active="showStatsModal" :filters="filters" />
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
        @close="handleShareClose"
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
           :row-class="getRowClass"
           :sort-by="filters.sortBy"
           :sort-order="filters.sortOrder"
           @view="handleView"
           @edit="handleEditWithHydration" 
           @delete="handleDelete" 
           @share="handleShare"
           @sort-change="handleSortChange"
        />
      </div>

      <!-- Mobile Grid (Show only if data exists) -->
      <div v-if="!loading && !error && products.length > 0" class="p-4 lg:hidden">
        <ProductGrid 
            :products="products"
            :card-class="getRowClass"
            @view="handleView"
            @edit="handleEditWithHydration"
            @share="handleShare"
        />
      </div>

      <!-- Empty State / Error State -->
      <div v-if="!loading && (products.length === 0 || error)" class="flex h-full items-center justify-center p-8">
        <PermissionDeniedState
            v-if="error && errorCode === ErrorCode.FORBIDDEN"
            :reason="error"
            @retry="reloadProducts"
        />
        <EmptyState
            v-else-if="error"
            icon="search"
            :title="t('common.error.network_error')"
            :description="error"
        >
            <template #action>
                 <AppButton variant="primary" size="sm" @click="reloadProducts">
                    {{ t('common.action.retry') }}
                 </AppButton>
            </template>
        </EmptyState>
        
        <EmptyState 
            v-else
            icon="plus" 
            :title="t('product.text.empty_title') || t('common.text.empty_data')"
            :description="t('product.text.empty_description') || t('common.text.create_first_item')"
        >
            <template #action>
                <AppButton variant="primary" size="sm" @click="handleCreate">
                    {{ t('product.action.create') }}
                </AppButton>
            </template>
        </EmptyState>
      </div>
    </div>
     <div class="mt-4 border-t border-(--border-color)/70 pt-4">
        <Pagination
            v-model:current-page="pagination.page"
            :total-pages="pagination.totalPages"
            @change="(p) => loadProducts(buildProductQuery({ page: p }))"
        />
    </div>
      </template>
    <ConfirmDialog
        v-model="confirmData.show"
        :title="confirmData.title"
        :message="confirmData.message"
        :type="confirmData.type"
        :loading="confirmData.loading"
        @confirm="confirmData.onConfirm"
    />
  </ManagementListShell>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, defineAsyncComponent, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProducts } from '@/composables/useProducts';
import { useAI } from '@/composables/useAI';
import { useToast } from '@/composables/useToast';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { useManagedListSelection } from '@/composables/useManagedListSelection';
const ProductStats = defineAsyncComponent(() => import('./product/ProductStats.vue'));
import ProductFilters from './product/ProductFilters.vue';
import ProductTable from './product/ProductTable.vue';
import ProductCreateModal from './product/ProductCreateModal.vue'; 
import ProductWorkflowModal from './product/ProductWorkflowModal.vue'; 
const ProductImportModal = defineAsyncComponent(() => import('./product/ProductImportModal.vue'));
const ProductExportModal = defineAsyncComponent(() => import('./product/ProductExportModal.vue'));
import ProductGrid from './product/ProductGrid.vue';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import Pagination from '@/components/ui/Pagination.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Modal from '@/components/ui/Modal.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import { useI18n } from '@/composables/useI18n';
import { resolveBoundProductMainImageSrc } from '@/utils/product-image.js';
import { findDefaultCatalogActiveVariant } from '@/utils/product-variants.js';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import { ErrorCode } from '@/utils/error-codes';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { setContext } = useAI();
const { addToast } = useToast();
const { subscribeModule } = useAppRefreshBus();
const { clearSelection, getRowClass, handleCreated, selectItem } = useManagedListSelection();

const { products, loading, error, errorCode, availableFilters, pagination, loadProducts, deleteProduct, loadProduct } = useProducts();

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
const confirmData = ref({
    show: false,
    title: '',
    message: '',
    type: 'danger',
    loading: false,
    onConfirm: async () => {},
});
const queryEditInitializing = ref(false);
const queryEditError = ref('');
let stopProductsRefreshSubscription = null;
let queryEditRequestId = 0;
let editHydrationRequestId = 0;
let shareHydrationRequestId = 0;

const filters = reactive({
    search: '',
    status: '',
    brand: '',
    category: '',
    hasStock: '',
    sortBy: '',
    sortOrder: '',
});

const buildProductQuery = (overrides = {}) => {
    const query = {
        page: pagination.page || 1,
        search: filters.search,
        status: filters.status,
        brand: filters.brand,
        category: filters.category,
        hasStock: filters.hasStock,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...overrides,
    };

    return Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
};

const reloadProducts = (overrides = {}, forceRefresh = false) => loadProducts(buildProductQuery(overrides), forceRefresh);
const handleFilterRefresh = () => reloadProducts({ page: 1 });

const brandOptions = computed(() => availableFilters.value?.brands || []);

const categoryOptions = computed(() => availableFilters.value?.categories || []);

onMounted(async () => {
    stopProductsRefreshSubscription = subscribeModule('products', () => {
        if (!showCreateModal.value && !showDetailModal.value && !showImportModal.value && !showExportModal.value) {
            reloadProducts({}, true);
        }
    });

    reloadProducts();
    
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
    editHydrationRequestId += 1;
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
    const requestId = ++queryEditRequestId;
    editHydrationRequestId += 1;
    isEditMode.value = true;
    showCreateModal.value = true;
    queryEditInitializing.value = true;
    queryEditError.value = '';
    editingProduct.value = editingProduct.value || {};

    try {
        const product = await loadProduct(productId);
        if (requestId !== queryEditRequestId || !showCreateModal.value) {
            return;
        }
        if (product) {
            handleEdit(product);
            const query = { ...route.query };
            delete query.edit;
            router.replace({ query });
            return;
        }
        queryEditError.value = t('product.workflow.edit_load_failed', 'Failed to load the editor. Please try again.');
    } catch (error) {
        if (requestId !== queryEditRequestId || !showCreateModal.value) {
            return;
        }
        queryEditError.value = error?.message || t('product.workflow.edit_load_failed', 'Failed to load the editor. Please try again.');
    } finally {
        if (requestId === queryEditRequestId) {
            queryEditInitializing.value = false;
        }
    }
};

const decorateProductPreview = (product) => {
    if (!product) return null;
    const preview = { ...product };
    const variants = Array.isArray(preview.variants) ? preview.variants : [];
    if (!preview.selectedVariant && variants.length > 0) {
        preview.selectedVariant = findDefaultCatalogActiveVariant(variants) || undefined;
    }
    preview.mainImage = resolveBoundProductMainImageSrc(preview) || preview.mainImage || null;
    return preview;
};

const hydrateProductWithVariants = async (product) => {
    const full = await loadProduct(product.id);
    const hydrated = full ? { ...full } : { ...product };
    const variants = Array.isArray(hydrated.variants) ? hydrated.variants : [];
    if (!hydrated.selectedVariant && variants.length > 0) {
        hydrated.selectedVariant = findDefaultCatalogActiveVariant(variants) || undefined;
    }
    hydrated.mainImage = resolveBoundProductMainImageSrc(hydrated) || hydrated.mainImage || null;
    return hydrated;
};

const handleEditWithHydration = async (product) => {
    const requestId = ++editHydrationRequestId;
    isEditMode.value = true;
    try {
        const hydrated = await hydrateProductWithVariants(product);
        if (requestId !== editHydrationRequestId) {
            return;
        }
        editingProduct.value = hydrated;
        showCreateModal.value = true;
    } catch (error) {
        if (requestId !== editHydrationRequestId) {
            return;
        }
        isEditMode.value = false;
        editingProduct.value = null;
        showCreateModal.value = false;
        addToast({
            message: error?.message || t('product.workflow.edit_load_failed', 'Failed to load the editor. Please try again.'),
            type: 'error',
        });
    }
};

const handleView = async (product) => {
    selectItem(product);
    viewingProduct.value = decorateProductPreview(product);
    showDetailModal.value = true;
};

const handleShare = async (product) => {
    const requestId = ++shareHydrationRequestId;
    try {
        const hydrated = await hydrateProductWithVariants(product);
        if (requestId !== shareHydrationRequestId) {
            return;
        }
        sharingProduct.value = hydrated;
        showShareModal.value = true;
    } catch (error) {
        if (requestId !== shareHydrationRequestId) {
            return;
        }
        sharingProduct.value = null;
        showShareModal.value = false;
        addToast({
            message: error?.message || t('common.loadFailed'),
            type: 'error',
        });
    }
};

const handleShareClose = () => {
    shareHydrationRequestId += 1;
    showShareModal.value = false;
};

const handleShareCreated = (space) => {
    handleShareClose();
    // Redirect to the space management page automatically for this new space
    router.push({
        name: 'Spaces',
        query: { id: space.id },
    });
};

const handleModalSuccess = async (createdProduct = null) => {
    if (!createdProduct?.id || isEditMode.value) {
        await reloadProducts({}, true);
        return;
    }

    await handleCreated({
        createdId: createdProduct.id,
        resetToFirstPage: () => {
            pagination.page = 1;
        },
        reload: () => reloadProducts({ page: 1 }, true),
        getItems: () => products.value,
        autoOpen: true,
        openDetail: (product) => {
            handleView(product);
        },
        onHiddenByFilters: () => {
            addToast({
                message: t('product.manager.createdHiddenByFilters', '商品已创建，但当前筛选条件未显示该项'),
                type: 'info',
            });
        },
    });
};

const handleDelete = (product) => {
    confirmData.value = {
        show: true,
        title: t('common.delete'),
        message: t('product.action.delete_confirm_message', { name: product.name }),
        type: 'danger',
        loading: false,
        onConfirm: async () => {
            confirmData.value.loading = true;
            try {
                await deleteProduct(product.id);
                await reloadProducts();
                confirmData.value.show = false;
            } finally {
                confirmData.value.loading = false;
            }
        },
    };
};

const handleExport = () => {
    showExportModal.value = true;
};

const handleSortChange = async ({ sortBy, sortOrder }) => {
    filters.sortBy = sortBy;
    filters.sortOrder = sortOrder;
    await reloadProducts({ page: 1 });
};

watch([showDetailModal, viewingProduct], ([isOpen, product]) => {
    if (!isOpen) {
        clearSelection();
    }
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
        queryEditRequestId += 1;
        editHydrationRequestId += 1;
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
