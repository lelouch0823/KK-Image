<template>
  <Modal
    v-model="isVisible"
    size="6xl"
    :title="modalTitle"
    body-class="p-0"
  >
    <template #header>
      <div class="flex flex-1 items-center justify-between gap-4">
        <div class="min-w-0">
          <p
            v-if="mode === 'edit_loading'"
            class="text-xs font-medium tracking-[0.18em] text-(--text-secondary) uppercase"
          >
            {{ t('product.workflow.preparing_edit_label', 'Preparing Edit') }}
          </p>
          <h3 class="truncate text-lg font-bold text-(--text-main)">
            {{ modalTitle }}
          </h3>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="mode === 'edit'"
            type="button"
            class="rounded-lg border border-(--border-color) px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-main)"
            @click="returnToDetail"
          >
            {{ t('product.workflow.back_to_detail', 'Back to Detail') }}
          </button>
          <button
            v-else
            type="button"
            data-testid="enter-edit"
            class="hover:bg-primary hover:text-inverse bg-primary/10 text-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="mode === 'edit_loading' || !currentProduct?.id"
            @click="enterEdit"
          >
            <AppIcon
              :name="mode === 'edit_loading' ? 'spinner' : 'pencil-square'"
              class="size-3.5"
              :class="{ 'animate-spin': mode === 'edit_loading' }"
            />
            {{
              mode === 'edit_loading'
                ? t('product.workflow.preparing_edit_action', 'Preparing Edit...')
                : t('product.action.edit')
            }}
          </button>
        </div>
      </div>
    </template>

    <div class="relative min-h-[300px]">
      <div
        v-if="mode !== 'edit' && editHydrationError"
        data-testid="edit-error"
        role="alert"
        class="border-danger/20 bg-danger/5 text-danger mx-6 mt-6 rounded-xl border px-4 py-3 text-sm"
      >
        <div class="flex items-center justify-between gap-3">
          <span>{{ editHydrationError }}</span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              data-testid="retry-edit"
              class="border-danger/20 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-danger/10"
              @click="enterEdit"
            >
              {{ t('common.action.retry', 'Retry') }}
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
              @click="clearEditError"
            >
              {{ t('product.action.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="mode === 'edit'" class="flex min-h-[300px] flex-col">
        <ProductCreateModal
          :model-value="true"
          embedded
          edit-mode
          :initial-data="editDraft"
          @success="handleEditSuccess"
          @update:model-value="handleEditPanelVisibility"
        />
      </div>

      <div v-else class="relative p-6">
        <div
          v-if="detailHydrationPending"
          data-testid="detail-loading"
          class="mb-5 rounded-2xl border border-(--border-color) bg-(--bg-muted)/55 p-4"
        >
          <div class="flex items-start gap-4">
            <div class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
              <AppIcon name="sparkles" class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-(--text-main)">
                {{ t('product.workflow.detail_loading_title', 'Refreshing product details') }}
              </p>
              <p class="mt-1 text-sm text-(--text-secondary)">
                {{ t('product.workflow.detail_loading_body', 'Showing the current snapshot while richer product data loads in the background.') }}
              </p>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <Skeleton height="4" />
                <Skeleton height="4" width="2/3" />
                <Skeleton height="24" container-class="sm:col-span-2" />
              </div>
            </div>
          </div>
        </div>

        <ProductDetail
          v-if="currentProduct"
          :product="currentProduct"
        />

        <div
          v-if="mode === 'edit_loading'"
          data-testid="edit-loading"
          class="absolute inset-0 flex items-start justify-center bg-(--bg-page)/72 px-6 pt-12 backdrop-blur-[1px]"
        >
          <div class="w-full max-w-xl rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-xl">
            <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
              <div class="flex items-start gap-3">
                <div class="bg-primary/10 text-primary mt-0.5 flex size-10 items-center justify-center rounded-full">
                  <AppIcon name="spinner" class="size-5 animate-spin" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-(--text-main)">
                    {{ t('product.workflow.loading_title', 'Loading complete product data') }}
                  </p>
                  <p class="mt-1 text-sm leading-6 text-(--text-secondary)">
                    {{ t('product.workflow.loading_body', 'Syncing dimensions, variants, and inventory details.') }}
                  </p>
                </div>
              </div>

              <div class="rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-secondary) uppercase">
                  {{ t('product.workflow.skeleton_label', 'Editor Preview') }}
                </p>
                <div class="mt-3 space-y-3">
                  <Skeleton height="5" width="2/3" />
                  <Skeleton height="10" />
                  <Skeleton height="10" />
                  <div class="grid grid-cols-2 gap-3">
                    <Skeleton height="9" />
                    <Skeleton height="9" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import { resolveBoundProductMainImageSrc } from '@/utils/product-image.js';
import Modal from '@/components/ui/Modal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import ProductDetail from '@/components/product/ProductDetail.vue';
import ProductCreateModal from '@/components/product/ProductCreateModal.vue';

const isVisible = defineModel('show', { type: Boolean, default: false });

const props = defineProps({
  product: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['success']);

const { t } = useI18n();
const { loadProduct } = useProducts();

const mode = ref('detail');
const currentProduct = ref(null);
const editDraft = ref(null);
const editHydrationError = ref('');
const detailHydrationPending = ref(false);
const detailHydrationPromise = ref(null);
const ignoreNextEmbeddedClose = ref(false);
let detailHydrationRequestId = 0;

const modalTitle = computed(() => {
  if (mode.value === 'edit') return t('product.modal.edit_title');
  if (mode.value === 'edit_loading') {
    return t('product.workflow.preparing_edit_title', 'Preparing Edit');
  }
  return t('product.manager.detail_title') || t('router.product_detail');
});

const normalizeProduct = (product) => {
  if (!product) return null;
  const normalized = { ...product };
  const variants = Array.isArray(normalized.variants) ? normalized.variants : [];
  if (!normalized.selectedVariant && variants.length > 0) {
    normalized.selectedVariant = variants.find((variant) => variant.status === 'active') || variants[0];
  }
  normalized.mainImage =
    resolveBoundProductMainImageSrc(normalized) || normalized.mainImage || null;
  return normalized;
};

const hydrateEditableProduct = async () => {
  return ensureProductHydrated();
};

const clearEditError = () => {
  editHydrationError.value = '';
};

const hasRichProductData = (product) =>
  Array.isArray(product?.variants) && product.variants.length > 0;

const ensureProductHydrated = async () => {
  if (!currentProduct.value?.id) return normalizeProduct(currentProduct.value);
  if (hasRichProductData(currentProduct.value)) return normalizeProduct(currentProduct.value);
  if (detailHydrationPromise.value) return detailHydrationPromise.value;

  const requestId = ++detailHydrationRequestId;
  detailHydrationPending.value = true;
  detailHydrationPromise.value = loadProduct(currentProduct.value.id)
    .then((full) => {
      if (requestId !== detailHydrationRequestId) {
        return normalizeProduct(currentProduct.value);
      }
      const hydrated = normalizeProduct(full || currentProduct.value);
      currentProduct.value = hydrated;
      return hydrated;
    })
    .finally(() => {
      if (requestId !== detailHydrationRequestId) {
        return;
      }
      detailHydrationPending.value = false;
      detailHydrationPromise.value = null;
    });

  return detailHydrationPromise.value;
};

const hydrateDetailProgressively = () => {
  if (!isVisible.value || !currentProduct.value?.id || hasRichProductData(currentProduct.value)) {
    detailHydrationPending.value = false;
    return;
  }
  void ensureProductHydrated().catch(() => {});
};

const enterEdit = async () => {
  if (!currentProduct.value?.id || mode.value === 'edit_loading') return;

  clearEditError();
  mode.value = 'edit_loading';

  try {
    editDraft.value = await hydrateEditableProduct();
    mode.value = 'edit';
  } catch (error) {
    editHydrationError.value =
      error?.message || t('product.workflow.edit_load_failed', 'Failed to load the editor. Please try again.');
    mode.value = 'detail';
  }
};

const returnToDetail = () => {
  ignoreNextEmbeddedClose.value = false;
  mode.value = 'detail';
};

const handleEditSuccess = () => {
  ignoreNextEmbeddedClose.value = true;
  emit('success');
  isVisible.value = false;
};

const handleEditPanelVisibility = (visible) => {
  if (visible) return;
  if (ignoreNextEmbeddedClose.value) {
    ignoreNextEmbeddedClose.value = false;
    return;
  }
  returnToDetail();
};

watch(
  [isVisible, () => props.product],
  ([visible, product]) => {
    if (!visible) {
      mode.value = 'detail';
      editDraft.value = null;
      editHydrationError.value = '';
      detailHydrationRequestId += 1;
      detailHydrationPending.value = false;
      detailHydrationPromise.value = null;
      ignoreNextEmbeddedClose.value = false;
      return;
    }

    detailHydrationRequestId += 1;
    detailHydrationPending.value = false;
    detailHydrationPromise.value = null;
    editHydrationError.value = '';
    currentProduct.value = normalizeProduct(product);
    if (mode.value !== 'edit_loading' && mode.value !== 'edit') {
      mode.value = 'detail';
    }
    hydrateDetailProgressively();
  },
  { immediate: true }
);
</script>
