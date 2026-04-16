<template>
  <Modal
    :model-value="true"
    size="6xl"
    body-class="!p-0"
    @update:model-value="handleModalVisibility"
    @close="$emit('close')"
  >
    <div class="flex h-[90vh] min-h-0 flex-col overflow-hidden bg-(--bg-card) lg:flex-row">
      <!-- 移动端: 顶部标签栏 -->
      <div class="flex items-center border-b border-(--border-color) px-4 py-3 lg:hidden">
        <AppButton
          variant="link"
          class="flex-1 !rounded-none border-b-2 py-2 text-center text-sm font-medium no-underline"
          :class="
            mobileTab === 'info'
              ? 'border-primary text-primary'
              : 'border-transparent text-(--text-secondary)'
          "
          @click="mobileTab = 'info'"
        >
          {{ t('spaceManager.productInfo') }}
        </AppButton>
        <AppButton
          variant="link"
          class="flex-1 !rounded-none border-b-2 py-2 text-center text-sm font-medium no-underline"
          :class="
            mobileTab === 'media'
              ? 'border-primary text-primary'
              : 'border-transparent text-(--text-secondary)'
          "
          @click="mobileTab = 'media'"
        >
          {{ t('spaceManager.media') }}
        </AppButton>
        <AppButton variant="ghost" size="sm" class="ml-2 !w-8 !px-0" @click="$emit('close')">
          <template #icon-left>
            <AppIcon name="x-mark" class="size-5" />
          </template>
        </AppButton>
      </div>

      <!-- 左侧：商品属性编辑器 -->
      <div
        v-show="mobileTab === 'info' || isDesktop"
        class="flex flex-1 flex-col border-r border-(--border-color) bg-(--bg-muted) lg:w-1/3"
        :class="{ hidden: mobileTab !== 'info' }"
      >
        <!-- 桌面端标题 -->
        <div
          class="hidden items-center justify-between border-b border-(--border-color) px-6 py-4 lg:flex"
        >
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-primary text-lg font-semibold">
                {{ t('spaceManager.productInfo') }}
              </h2>
              <span
                v-if="form.isPublic"
                class="text-success rounded-full bg-(--color-success-bg) px-1.5 py-0.5 text-[10px] font-medium"
                >🌐 {{ t('spaceManager.publicOn') }}</span
              >
              <span
                v-else
                class="text-secondary rounded-full bg-(--bg-muted) px-1.5 py-0.5 text-[10px] font-medium"
                >🔒 {{ t('spaceManager.publicOff') }}</span
              >
            </div>
            <p class="text-secondary mt-1 text-xs">{{ t('spaceManager.editParams') }}</p>
          </div>
        </div>

        <!-- 表单区域 -->
        <div class="flex-1 space-y-4 overflow-y-auto p-6">
          <!-- 引入实际商品关联选块 (SOTA 独立组件) -->
          <div v-if="canManageProducts" class="mb-4">
            <ProductBindingSection
              :bound-product="boundProduct"
              :variant-select-policy="'in_stock_only'"
              @select="handleProductSelect"
              @unbind="unbindProduct"
            />

            <CalloutPanel
              v-if="boundProduct"
              class="mt-3"
              tone="info"
              :description="boundProductNotice"
            />

            <CalloutPanel
              v-if="bindingWarning"
              class="mt-3"
              tone="warning"
              :description="bindingWarning"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.productName')
            }}</label>
            <AppInput v-model="form.name" type="text" size="md" />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.brand')
            }}</label>
            <AppInput
              v-model="form.templateData.brand"
              type="text"
              :disabled="hasProductBinding"
              size="md"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.series')
            }}</label>
            <AppInput
              v-model="form.templateData.series"
              type="text"
              :disabled="hasProductBinding"
              size="md"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-primary mb-1 block text-sm font-medium">{{
                t('spaceManager.price')
              }}</label>
              <AppInput
                v-model="form.templateData.price"
                type="number"
                :disabled="hasProductBinding"
                size="md"
              />
            </div>
            <div>
              <label class="text-primary mb-1 block text-sm font-medium">{{
                t('spaceManager.material')
              }}</label>
              <AppInput
                v-model="form.templateData.material"
                type="text"
                :disabled="hasProductBinding"
                size="md"
              />
            </div>
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">SKU</label>
            <AppInput
              v-model="form.templateData.sku"
              type="text"
              :placeholder="t('spaceManager.skuPlaceholder')"
              :disabled="hasProductBinding"
              size="md"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.descLabel')
            }}</label>
            <AppInput
              v-model="form.description"
              textarea
              rows="4"
              class="[&_textarea]:resize-none"
            />
          </div>

          <!-- Share Card -->
          <div class="border-t border-(--border-color)">
            <div class="p-6 pt-4 pb-2">
              <label class="mb-2 block text-sm font-medium text-(--text-main)">{{
                t('spaceManager.shareSettings') || '销售可见性设置'
              }}</label>
              <SpaceVisibilitySelector
                v-model="form.shareMode"
                v-model:selected-salespersons="form.sharedSalespersonIds"
                class="!border-dashed !bg-transparent shadow-none"
              />
            </div>

            <div class="px-6 pt-2 pb-6">
              <SpaceShareCard
                v-model:is-public="form.isPublic"
                v-model:password-enabled="passwordEnabled"
                v-model:password="form.password"
                :share-url="shareUrl"
              />
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <ActionBar
          class="border-none border-t border-(--border-color) bg-transparent px-6 py-4 shadow-none"
        >
          <AppButton variant="white" :text="t('spaceManager.preview')" @click="openPreview">
            <template #icon-left>
              <AppIcon name="eye" class="size-4" />
            </template>
          </AppButton>
          <AppButton
            :loading="saving"
            variant="primary"
            class="min-w-40"
            :text="saving ? t('spaceManager.saving') : t('spaceManager.save')"
            @click="saveChanges"
          />
        </ActionBar>
      </div>

      <!-- 右侧：媒体资源管理 + 数据分析 -->
      <div
        v-show="mobileTab === 'media' || isDesktop"
        class="flex flex-1 flex-col bg-(--bg-card)"
        :class="{ 'hidden lg:flex': mobileTab !== 'media' }"
      >
        <!-- 右侧标签头 (桌面端) -->
        <div
          class="hidden items-center justify-between border-b border-(--border-color) px-6 py-3 lg:flex"
        >
          <div class="flex space-x-4">
            <AppButton
              variant="link"
              class="!rounded-none border-b-2 px-1 py-2 text-sm font-medium no-underline"
              :class="
                activeRightTab === 'media'
                  ? 'border-primary text-primary'
                  : 'text-secondary border-transparent hover:text-(--text-main)'
              "
              @click="activeRightTab = 'media'"
            >
              {{ t('spaceManager.media') }}
            </AppButton>
            <AppButton
              variant="link"
              class="!rounded-none border-b-2 px-1 py-2 text-sm font-medium no-underline"
              :class="
                activeRightTab === 'analytics'
                  ? 'border-primary text-primary'
                  : 'text-secondary border-transparent hover:text-(--text-main)'
              "
              @click="activeRightTab = 'analytics'"
            >
              {{ t('spaceManager.tabs.analytics') }}
            </AppButton>
          </div>
          <div class="flex gap-2">
            <Tooltip v-if="activeRightTab === 'media'" :content="t('spaceManager.addFile')">
              <AppButton
                variant="secondary"
                size="sm"
                class="!h-8 !w-8 !px-0 text-primary"
                @click="showFileSelector = true"
              >
                <template #icon-left>
                  <AppIcon name="plus" class="size-5" />
                </template>
              </AppButton>
            </Tooltip>
            <AppButton variant="ghost" size="sm" class="!h-8 !w-8 !px-0" @click="$emit('close')">
              <template #icon-left>
                <AppIcon name="x-mark" class="size-6" />
              </template>
            </AppButton>
          </div>
        </div>

        <!-- 移动端顶部操作栏 -->
        <div
          class="flex items-center justify-between border-b border-(--border-color) px-4 py-3 lg:hidden"
        >
          <span class="text-primary text-sm font-medium">{{ t('spaceManager.media') }}</span>
          <AppButton
            variant="primary"
            size="sm"
            :text="t('spaceManager.addFile')"
            @click="showFileSelector = true"
          >
            <template #icon-left>
              <AppIcon name="plus" class="size-4" />
            </template>
          </AppButton>
        </div>

        <!-- 媒体标签内容 -->
        <div
          v-show="activeRightTab === 'media' || !isDesktop"
          class="flex-1 overflow-y-auto p-4 lg:p-6"
        >
          <SpaceMediaGrid
            :files="files"
            :cover-file-id="form.coverFileId"
            :product-images="productImages"
            @set-cover="setCover"
            @remove="removeFile"
            @add-files="showFileSelector = true"
            @upload="$refs.fileInput.click()"
            @reorder="handleReorder"
          />
          <input ref="fileInput" type="file" multiple class="hidden" @change="handleNativeUpload" />
        </div>

        <!-- 数据分析标签内容 -->
        <div v-show="activeRightTab === 'analytics'" class="flex-1 overflow-y-auto p-6">
          <SpaceAnalytics :space-id="space.id" />
        </div>
      </div>
    </div>

    <FileSelector v-if="showFileSelector" @close="showFileSelector = false" @select="addFiles" />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </Modal>
</template>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAccessControl } from '@/composables/useAccessControl';
import { ROUTES } from '@/utils/constants';

import { useUploadQueue } from '@/composables/useUploadQueue';

// Components
import FileSelector from '@/components/FileSelector.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';
import SpaceShareCard from './space/SpaceShareCard.vue';
import SpaceVisibilitySelector from './space/SpaceVisibilitySelector.vue';
import SpaceMediaGrid from './space/SpaceMediaGrid.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import CalloutPanel from '@/design-system/composed/CalloutPanel.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';
import {
  resolveBoundProductMainImageSrc,
  resolveProductImageSrcList,
  resolveSelectedVariantMainImageSrc,
} from '@/utils/product-image.js';
import { normalizeVariantOptions } from '@/utils/variant-meta';

const props = defineProps({
  space: { type: Object, required: true },
});

const emit = defineEmits(['close', 'updated']);

const handleModalVisibility = (visible) => {
  if (!visible) {
    emit('close');
  }
};

const { updateSpace, addFilesToSpace, removeFilesFromSpace, reorderSpaceFiles, loadSpace } =
  useSpaces();
const { loadProduct } = useProducts();
const { addToast } = useToast();
const { t } = useI18n();
const { can } = useAccessControl();
const { addFiles: enqueueFiles, registerFolderRefresh, unregisterFolderRefresh } = useUploadQueue();

const showFileSelector = ref(false);
const saving = ref(false);
const files = ref([]);
const activeRightTab = ref('media');
const passwordEnabled = ref(false);
const mobileTab = ref('info');
const isDesktop = ref(window.innerWidth >= 1024);
const boundProduct = ref(null);
const canManageProducts = ref(true);
const bindingState = ref('unbound');
let initDataRequestId = 0;
let mediaRefreshRequestId = 0;
let registeredRefreshKey = '';

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const form = ref({
  name: '',
  description: '',
  isPublic: false,
  shareMode: 'none',
  sharedSalespersonIds: [],
  coverFileId: null,
  password: '',
  productId: null,
  variantId: null,
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: '',
    sku: '',
  },
});

const shareUrl = computed(() => {
  if (!props.space.shareToken) return t('spaceManager.saveToGenerate');
  return `${window.location.origin}${ROUTES.SPACE(props.space.shareToken)}`;
});

const hasProductBinding = computed(() => !!form.value.productId);

const productImages = computed(() => {
  if (!boundProduct.value || !boundProduct.value._images) return [];
  return resolveProductImageSrcList({ images: boundProduct.value._images });
});

const bindingWarningMap = computed(() => ({
  archived_product: t(
    'spaceManager.bindingIssues.archivedProduct',
    '该空间绑定的商品已归档，当前仅保留空间自己的快照信息。你可以改绑到新的在售商品，或解绑后改为普通空间内容。'
  ),
  archived_variant: t(
    'spaceManager.bindingIssues.archivedVariant',
    '该空间绑定的规格已归档，当前仅保留空间自己的快照信息。请重新选择可售规格，或解绑后手动维护空间内容。'
  ),
  missing_product: t(
    'spaceManager.bindingIssues.missingProduct',
    '该空间原先绑定的商品已不存在，当前只剩历史快照。请尽快重新绑定商品，或解除绑定后改为静态内容。'
  ),
  missing_variant: t(
    'spaceManager.bindingIssues.missingVariant',
    '该空间原先绑定的规格已不存在，当前只剩历史快照。请重新选择有效规格，或解除绑定后改为静态内容。'
  ),
}));

const bindingWarning = computed(() => bindingWarningMap.value[bindingState.value] || '');
const boundProductNotice = computed(() =>
  t(
    'spaceManager.bindingNotice',
    '该空间已绑定商品，品牌、系列、价格等核心参数由商品关联系统自动接管。如需修改，请点击上方的“编辑”按钮前往商品库修改。保存该空间后修改即可全局生效。'
  )
);

const resolveFallbackBoundProductName = (data) => {
  const brand = String(data?.templateData?.brand || '').trim();
  const series = String(data?.templateData?.series || '').trim();
  return [brand, series].filter(Boolean).join(' ') || data?.name || 'Historical Product';
};

const buildFallbackBoundProduct = (data) => {
  const images = Array.isArray(data?.templateData?.images) ? data.templateData.images : [];
  const imageList = resolveProductImageSrcList({ images });
  return {
    id: data?.productId || data?.product_id || '',
    productId: data?.productId || data?.product_id || '',
    variantId: data?.variantId || data?.variant_id || null,
    name: resolveFallbackBoundProductName(data),
    sku: data?.templateData?.sku || '',
    brand: data?.templateData?.brand || '',
    series: data?.templateData?.series || '',
    mainImage: imageList[0] || '',
    _images: images,
  };
};

const initData = async () => {
  const requestId = ++initDataRequestId;
  canManageProducts.value = await can('products:manage');
  if (requestId !== initDataRequestId) return;
  const data = await loadSpace(props.space.id);
  if (requestId !== initDataRequestId || !data) return;
  if (data) {
    bindingState.value = String(data.bindingState || (data.productId ? 'active' : 'unbound'));
    if (data.productId && canManageProducts.value) {
      if (bindingState.value !== 'active' && bindingState.value !== 'unbound') {
        boundProduct.value = buildFallbackBoundProduct(data);
      } else {
        const product = await loadProduct(data.productId);
        if (requestId !== initDataRequestId) return;
        if (product) {
          const selectedVariant =
            (product.variants || []).find((v) => v.id === data.variantId) || null;
          const mainImage = resolveBoundProductMainImageSrc({
            ...product,
            selectedVariant,
          });
          boundProduct.value = {
            id: product.id,
            name: product.name,
            sku: selectedVariant?.sku || '',
            brand: product.brand,
            series: product.series,
            mainImage,
            _images: product.images, // Store raw images for computed property
          };
        } else {
          boundProduct.value = null;
        }
      }
    } else {
      boundProduct.value = null;
    }

    form.value = {
      name: data.name || '',
      description: data.description || '',
      isPublic: data.isPublic || false,
      shareMode: data.shareMode || 'none',
      sharedSalespersonIds: data.sharedSalespersons
        ? data.sharedSalespersons.map((sp) => sp.id)
        : [],
      coverFileId: data.coverFileId || null,
      password: data.password || '',
      productId: data.productId || null,
      variantId: data.variantId || null,
      templateData: {
        brand: data.templateData?.brand || '',
        series: data.templateData?.series || '',
        price: data.templateData?.price || '',
        material: data.templateData?.material || '',
        sku: data.templateData?.sku || '',
      },
    };
    files.value = data.files || [];
    passwordEnabled.value = !!data.password;
  }
};

const refreshMediaState = async () => {
  const spaceId = props.space.id;
  const requestId = ++mediaRefreshRequestId;
  const data = await loadSpace(spaceId);
  if (requestId !== mediaRefreshRequestId || props.space.id !== spaceId || !data) return false;
  files.value = data.files || [];
  form.value.coverFileId = data.coverFileId || null;
  return true;
};

const saveChanges = async () => {
  saving.value = true;
  try {
    const success = await updateSpace(props.space.id, {
      ...form.value,
      password: passwordEnabled.value ? form.value.password : null,
    });
    if (success) {
      emit('updated');
    }
  } finally {
    saving.value = false;
  }
};

const openPreview = () => {
  if (props.space.shareToken) {
    window.open(ROUTES.SPACE(props.space.shareToken), '_blank');
  } else {
    addToast({ message: t('spaceManager.saveFirst'), type: 'warning' });
  }
};

const handleProductSelect = (product) => {
  if (!canManageProducts.value) return;
  const variant = product.selectedVariant;
  if (!variant) return;
  const mainImage = resolveSelectedVariantMainImageSrc(product);

  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: variant.sku,
    brand: product.brand,
    series: product.series,
    mainImage,
    _images: product.images, // Store raw images
  };
  form.value.productId = product.id;
  form.value.variantId = variant.id;

  // Force overwrite template data from product
  if (!form.value.name) form.value.name = product.name || '';
  form.value.templateData.brand = product.brand || '';
  form.value.templateData.series = product.series || '';
  form.value.templateData.sku = variant.sku || '';

  let priceStr = String(variant.price || '');
  form.value.templateData.price = priceStr;

  let materialStr = '';
  const variantMeta = normalizeVariantOptions(variant.options_values || {});
  try {
    const specs =
      typeof product.specifications === 'string'
        ? JSON.parse(product.specifications)
        : product.specifications;
    materialStr = variantMeta.material || specs?.material || '';
  } catch {
    materialStr = variantMeta.material || '';
  }
  form.value.templateData.material = materialStr;
};

const unbindProduct = () => {
  if (!canManageProducts.value) return;
  boundProduct.value = null;
  bindingState.value = 'unbound';
  form.value.productId = null;
  form.value.variantId = null;
};

const addFiles = async (fileIds) => {
  showFileSelector.value = false;
  const added = await addFilesToSpace(props.space.id, fileIds);
  if (!added) return;
  await refreshMediaState();
  emit('updated');
};

const removeFile = (fileId) => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('spaceManager.removeFileConfirm'),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const removed = await removeFilesFromSpace(props.space.id, [fileId]);
        if (!removed) return;
        await refreshMediaState();
        emit('updated');
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const setCover = (file) => {
  form.value.coverFileId = file.id;
  addToast({ message: t('spaceManager.coverSet'), type: 'success' });
};

const handleNativeUpload = (event) => {
  const selectedFiles = event.target.files;
  if (!selectedFiles || selectedFiles.length === 0) return;

  // Use Space details or ID to determine upload targets.
  enqueueFiles(selectedFiles, null, { spaceId: props.space.id });

  // Clear the input so the same files can be selected again
  event.target.value = '';
};

const handleReorder = async (newFiles) => {
  // Optimistic update
  files.value = newFiles;

  const fileIds = newFiles.map((f) => f.id);
  const success = await reorderSpaceFiles(props.space.id, fileIds);

  if (!success) {
    await refreshMediaState();
  }
};

const bindRefreshHandler = (spaceId) => {
  const nextKey = spaceId ? `space_${spaceId}` : '';
  if (registeredRefreshKey && registeredRefreshKey !== nextKey) {
    unregisterFolderRefresh(registeredRefreshKey);
    registeredRefreshKey = '';
  }
  if (!nextKey || registeredRefreshKey === nextKey) return;

  registeredRefreshKey = nextKey;
  registerFolderRefresh(nextKey, () => {
    void refreshMediaState().then((refreshed) => {
      if (!refreshed) return;
      emit('updated');
    });
  });
};

watch(
  () => props.space?.id,
  (spaceId) => {
    initDataRequestId += 1;
    mediaRefreshRequestId += 1;
    bindRefreshHandler(spaceId);
    if (!spaceId) return;
    void initData();
  },
  { immediate: true }
);

onUnmounted(() => {
  initDataRequestId += 1;
  mediaRefreshRequestId += 1;
  if (registeredRefreshKey) {
    unregisterFolderRefresh(registeredRefreshKey);
    registeredRefreshKey = '';
  }
});
</script>
