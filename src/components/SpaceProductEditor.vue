<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
    @click.self="$emit('close')"
  >
    <!-- 移动端: 全屏底部抽屉 | 桌面端: 居中弹窗 -->
    <div
      class="flex size-full flex-col overflow-hidden rounded-t-2xl bg-white lg:mx-4 lg:h-[90vh] lg:max-w-5xl lg:flex-row lg:rounded-2xl lg:rounded-t-2xl dark:bg-gray-900"
    >
      <!-- 移动端: 顶部标签栏 -->
      <div class="flex items-center border-b border-[var(--border-color)] px-4 py-3 lg:hidden">
        <button
          class="flex-1 border-b-2 py-2 text-center text-sm font-medium transition-colors"
          :class="
            mobileTab === 'info'
              ? 'border-primary text-primary'
              : 'border-transparent text-(--text-secondary)'
          "
          @click="mobileTab = 'info'"
        >
          {{ t('spaceManager.productInfo') }}
        </button>
        <button
          class="flex-1 border-b-2 py-2 text-center text-sm font-medium transition-colors"
          :class="
            mobileTab === 'media'
              ? 'border-primary text-primary'
              : 'border-transparent text-(--text-secondary)'
          "
          @click="mobileTab = 'media'"
        >
          {{ t('spaceManager.media') }}
        </button>
        <button class="text-muted ml-2 p-2 hover:text-primary" @click="$emit('close')">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- 左侧：商品属性编辑器 -->
      <div
        v-show="mobileTab === 'info' || isDesktop"
        class="flex flex-1 flex-col border-r border-[var(--border-color)] bg-[var(--bg-muted)] lg:w-1/3"
        :class="{ hidden: mobileTab !== 'info' }"
      >
        <!-- 桌面端标题 -->
        <div
          class="hidden items-center justify-between border-b border-[var(--border-color)] px-6 py-4 lg:flex"
        >
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-primary text-lg font-semibold">
                {{ t('spaceManager.productInfo') }}
              </h2>
              <span
                v-if="form.isPublic"
                class="rounded-full bg-[var(--color-success-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]"
                >🌐 {{ t('spaceManager.publicOn') }}</span
              >
              <span
                v-else
                class="text-secondary rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-medium"
                >🔒 {{ t('spaceManager.publicOff') }}</span
              >
            </div>
            <p class="text-secondary mt-1 text-xs">{{ t('spaceManager.editParams') }}</p>
          </div>
        </div>

        <!-- 表单区域 -->
        <div class="flex-1 space-y-4 overflow-y-auto p-6">
          <!-- 引入实际商品关联选块 (SOTA 独立组件) -->
          <div class="mb-4">
            <ProductBindingSection
              :bound-product="boundProduct"
              @select="handleProductSelect"
              @unbind="unbindProduct"
            />
            
            <div v-if="boundProduct" class="mt-3 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-50/50 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-300">
                <svg class="mt-0.5 size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>该空间已绑定商品，品牌、系列、价格等核心参数由商品关联系统自动接管。如需修改，请点击上方的<strong>“编辑”</strong>按钮前往商品库修改。保存该空间后修改即可全局生效。</p>
            </div>
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.productName')
            }}</label>
            <input
              v-model="form.name"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.brand')
            }}</label>
            <input
              v-model="form.templateData.brand"
              type="text"
              :disabled="!!boundProduct"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.series')
            }}</label>
            <input
              v-model="form.templateData.series"
              type="text"
              :disabled="!!boundProduct"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-primary mb-1 block text-sm font-medium">{{
                t('spaceManager.price')
              }}</label>
              <input
                v-model="form.templateData.price"
                type="number"
                :disabled="!!boundProduct"
                class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
              />
            </div>
            <div>
              <label class="text-primary mb-1 block text-sm font-medium">{{
                t('spaceManager.material')
              }}</label>
              <input
                v-model="form.templateData.material"
                type="text"
                :disabled="!!boundProduct"
                class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">SKU</label>
            <input
              v-model="form.templateData.sku"
              type="text"
              :placeholder="t('spaceManager.skuPlaceholder')"
              :disabled="!!boundProduct"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-hover)] disabled:text-[var(--text-muted)]"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.descLabel')
            }}</label>
            <textarea
              v-model="form.description"
              rows="4"
              class="focus:border-primary w-full resize-none rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            ></textarea>
          </div>

          <!-- Share Card -->
          <div class="border-t border-[var(--border-color)]">
            <div class="p-6 pt-4 pb-2">
              <label class="mb-2 block text-sm font-medium text-[var(--text-main)]">{{
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
        <div class="flex gap-3 border-t border-[var(--border-color)] px-6 py-4">
          <button
            class="hover:text-primary flex items-center gap-1.5 rounded-lg border border-(--border-color) px-4 py-2 text-(--text-secondary) transition-colors"
            @click="openPreview"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            {{ t('spaceManager.preview') }}
          </button>
          <button
            :disabled="saving"
            class="bg-primary flex-1 rounded-lg py-2 text-(--text-inverse) transition-colors hover:bg-primary-hover disabled:opacity-50"
            @click="saveChanges"
          >
            {{ saving ? t('spaceManager.saving') : t('spaceManager.save') }}
          </button>
        </div>
      </div>

      <!-- 右侧：媒体资源管理 + 数据分析 -->
      <div
        v-show="mobileTab === 'media' || isDesktop"
        class="flex flex-1 flex-col bg-white dark:bg-gray-900"
        :class="{ 'hidden lg:flex': mobileTab !== 'media' }"
      >
        <!-- 右侧标签头 (桌面端) -->
        <div
          class="hidden items-center justify-between border-b border-[var(--border-color)] px-6 py-3 lg:flex"
        >
          <div class="flex space-x-4">
            <button
              class="border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200"
              :class="
                activeRightTab === 'media'
                  ? 'border-primary text-primary'
                  : 'text-secondary border-transparent hover:text-[var(--text-main)] dark:text-gray-400 dark:hover:text-gray-200'
              "
              @click="activeRightTab = 'media'"
            >
              {{ t('spaceManager.media') }}
            </button>
            <button
              class="border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200"
              :class="
                activeRightTab === 'analytics'
                  ? 'border-primary text-primary'
                  : 'text-secondary border-transparent hover:text-[var(--text-main)] dark:text-gray-400 dark:hover:text-gray-200'
              "
              @click="activeRightTab = 'analytics'"
            >
              {{ t('spaceManager.tabs.analytics') }}
            </button>
          </div>
          <div class="flex gap-2">
            <Tooltip v-if="activeRightTab === 'media'" :content="t('spaceManager.addFile')">
              <button
                class="text-primary flex size-8 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                @click="showFileSelector = true"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </Tooltip>
            <button
              class="text-secondary rounded-lg p-2 hover:text-primary hover:bg-[var(--bg-hover)]"
              @click="$emit('close')"
            >
              <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- 移动端顶部操作栏 -->
        <div
          class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3 lg:hidden"
        >
          <span class="text-primary text-sm font-medium">{{ t('spaceManager.media') }}</span>
          <button
            class="bg-primary flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[var(--text-inverse)]"
            @click="showFileSelector = true"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            {{ t('spaceManager.addFile') }}
          </button>
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
          <input
            ref="fileInput"
            type="file"
            multiple
            class="hidden"
            @change="handleNativeUpload"
          />
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { ROUTES } from '@/utils/constants';

import { useUploadQueue } from '@/composables/useUploadQueue';

// Components
import FileSelector from '@/components/FileSelector.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';
import SpaceShareCard from './space/SpaceShareCard.vue';
import SpaceVisibilitySelector from './space/SpaceVisibilitySelector.vue';
import SpaceMediaGrid from './space/SpaceMediaGrid.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const emit = defineEmits(['close', 'updated']);

const { updateSpace, addFilesToSpace, removeFilesFromSpace, reorderSpaceFiles, loadSpace } = useSpaces();
const { loadProduct } = useProducts();
const { addToast } = useToast();
const { t } = useI18n();
const { addFiles: enqueueFiles, registerFolderRefresh, unregisterFolderRefresh } = useUploadQueue();

const showFileSelector = ref(false);
const saving = ref(false);
const files = ref([]);
const activeRightTab = ref('media');
const passwordEnabled = ref(false);
const mobileTab = ref('info');
const isDesktop = ref(window.innerWidth >= 1024);
const boundProduct = ref(null);

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

const productImages = computed(() => {
  if (!boundProduct.value || !boundProduct.value._images) return [];
  try {
    const imgs = typeof boundProduct.value._images === 'string' 
      ? JSON.parse(boundProduct.value._images) 
      : boundProduct.value._images;
    return Array.isArray(imgs) ? imgs : [];
  } catch (_e) {
    return [];
  }
});

const resolveVariantImageId = (variant) => {
  if (!variant) return null;
  if (variant.primaryImage) return variant.primaryImage;
  if (Array.isArray(variant.images) && variant.images.length > 0) {
    const primary = variant.images.find((img) => Number(img.is_primary) === 1) || variant.images[0];
    return primary?.image_id || null;
  }
  return null;
};

const initData = async () => {
  const data = await loadSpace(props.space.id);
  if (data) {
    if (data.productId) {
      const product = await loadProduct(data.productId);
      if (product) {
        let mainImage = null;
        if (product.display_image_id) {
           mainImage = product.display_image_id;
        } else if (product.images) {
           const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
           mainImage = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
        }
        boundProduct.value = {
          id: product.id,
          name: product.name,
          sku: product.spu,
          brand: product.brand,
          series: product.series,
          mainImage,
          _images: product.images, // Store raw images for computed property
        };
      }
    } else {
      boundProduct.value = null;
    }

    form.value = {
      name: data.name || '',
      description: data.description || '',
      isPublic: data.isPublic || false,
      shareMode: data.shareMode || 'none',
      sharedSalespersonIds: data.sharedSalespersons ? data.sharedSalespersons.map(sp => sp.id) : [],
      coverFileId: data.coverFileId || null,
      password: data.password || '',
      productId: data.productId || null,
      variantId: data.variantId || data.variant_id || null,
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
  let mainImage = null;
  const variant = product.selectedVariant;

  if (product?.mainImage) {
    mainImage = product.mainImage.replace('/file/', '');
  } else {
    mainImage = resolveVariantImageId(variant);
  }

  if (!mainImage && product.images) {
    const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    mainImage = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
  }
  if (!mainImage && product.display_image_id) {
    mainImage = product.display_image_id;
  }
  
  boundProduct.value = {
    id: product.id,
    name: product.name,
    sku: variant ? variant.sku : product.spu,
    brand: product.brand,
    series: product.series,
    mainImage,
    _images: product.images, // Store raw images
  };
  form.value.productId = product.id;
  form.value.variantId = variant ? variant.id : null;

  // Force overwrite template data from product
  if (!form.value.name) form.value.name = product.name || '';
  form.value.templateData.brand = product.brand || '';
  form.value.templateData.series = product.series || '';
  form.value.templateData.sku = variant ? variant.sku : (product.spu || '');
  
  let priceStr = variant ? String(variant.price || '') : (product.price != null ? String(product.price) : '');
  form.value.templateData.price = priceStr;
  
  let materialStr = '';
  try {
     const specs = typeof product.specifications === 'string' ? JSON.parse(product.specifications) : product.specifications;
     materialStr = specs?.material || '';
  } catch {
     /* ignore */
  }
  form.value.templateData.material = materialStr;
};

const unbindProduct = () => {
  boundProduct.value = null;
  form.value.productId = null;
  form.value.variantId = null;
};

const addFiles = async (fileIds) => {
  showFileSelector.value = false;
  await addFilesToSpace(props.space.id, fileIds);
  await initData();
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
        await removeFilesFromSpace(props.space.id, [fileId]);
        await initData();
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
  
  const fileIds = newFiles.map(f => f.id);
  const success = await reorderSpaceFiles(props.space.id, fileIds);
  
  if (!success) {
    // Revert logic could be implemented here if strict consistency is needed,
    // but usually reloading the space or showing an error is enough.
    await initData(); 
  }
};

onMounted(() => {
  initData();
  registerFolderRefresh(`space_${props.space.id}`, () => {
    initData();
    emit('updated');
  });
});

onUnmounted(() => {
  unregisterFolderRefresh(`space_${props.space.id}`);
});
</script>
