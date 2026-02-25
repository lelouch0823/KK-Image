<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-(--color-overlay-dim) backdrop-blur-sm transition-opacity" aria-hidden="true" @click="$emit('update:modelValue', false)"></div>

      <!-- Modal Container -->
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Modal Panel -->
        <div class="relative w-full max-w-4xl transform overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) text-left shadow-2xl transition-all">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-(--border-color) bg-(--bg-muted)/50 px-6 py-4">
              <h3 class="font-[Outfit] text-lg leading-6 font-bold text-(--text-main)">
                  {{ editMode ? t('product.modal.edit_title') : t('product.modal.create_title') }}
              </h3>
              <button class="text-(--text-muted) transition-colors hover:text-(--text-secondary) focus:outline-none" @click="$emit('update:modelValue', false)">
                  <span class="sr-only">{{ t('common.close') }}</span>
                  <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          </div>

          <!-- Content -->
          <div class="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
              <form id="product-form" class="grid grid-cols-1 gap-8 lg:grid-cols-3" @submit.prevent="handleSubmit">
                  
                  <!-- Main Column (2 spans) -->
                  <div class="space-y-6 lg:col-span-2">
                      <!-- Basic Info -->
                      <div class="space-y-4">
                          <AppInput
                            v-model="form.name"
                            :label="t('product.form.name')"
                            :placeholder="t('product.form.name_placeholder')"
                            required
                          />
                          
                          <AppInput
                            v-model="form.description"
                            :label="t('product.form.description')"
                            :placeholder="t('product.form.description_placeholder')"
                            textarea
                            :rows="3"
                          />
                      </div>

                      <!-- Brand & Series -->
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <AppInput
                            v-model="form.brand"
                            :label="t('order.form.brand')"
                            :placeholder="t('order.form.brandPlaceholder')"
                          />
                          <AppInput
                            v-model="form.series"
                            :label="t('order.form.series')"
                            :placeholder="t('order.form.seriesPlaceholder')"
                          />
                      </div>

                      <!-- Category -->
                      <AppInput
                        v-model="form.category"
                        :label="t('product.form.category')"
                        :placeholder="t('product.form.category_placeholder')"
                      />

                      <!-- Options Builder -->
                      <div class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4">
                          <div class="flex items-center justify-between">
                              <h4 class="font-bold text-[var(--text-main)]">{{ t('product.form.options_title', 'Product Options') }}</h4>
                              <button type="button" @click="addOption" class="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-hover)]">
                                  <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                                  {{ t('product.form.add_option', 'Add Option') }}
                              </button>
                          </div>
                          <div class="space-y-4">
                              <div v-for="(opt, idx) in form.options" :key="idx" class="relative rounded-lg border border-[var(--border-color)]/50 bg-[var(--bg-card)] p-3">
                                  <button type="button" @click="removeOption(idx)" class="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors">
                                      <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                  </button>
                                  <div class="mb-2 w-2/3 pr-6">
                                      <AppInput v-model="opt.name" :placeholder="t('product.form.option_name', 'Option Name (e.g., Color)')" size="sm" @input="generateVariants" />
                                  </div>
                                  <div>
                                      <AppInput v-model="opt.inputValue" :placeholder="t('product.form.option_values', 'Enter values separated by comma')" size="sm" @keydown.enter.prevent="addOptionValue(opt)" @blur="addOptionValue(opt)" />
                                      <div class="mt-2 flex flex-wrap gap-2">
                                          <span v-for="(val, vIdx) in opt.values" :key="vIdx" class="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-main)] border border-[var(--border-color)]">
                                              {{ val }}
                                              <button type="button" @click="removeOptionValue(opt, vIdx)" class="text-[var(--text-muted)] hover:text-[var(--color-danger)]">&times;</button>
                                          </span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <!-- Variants Matrix -->
                      <div v-if="form.variants.length > 0" class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4">
                          <div class="flex items-center justify-between">
                              <h4 class="font-bold text-[var(--text-main)]">{{ t('product.form.variants_title', 'Variants') }}</h4>
                              <button type="button" class="text-sm font-medium text-[var(--color-primary)]" @click="showVariantImageManager = true">
                                  {{ t('product.form.manage_variant_images', 'Manage Variant Images') }}
                              </button>
                          </div>
                          <div class="overflow-x-auto">
                              <table class="w-full text-left text-sm whitespace-nowrap">
                                  <thead class="text-xs uppercase text-[var(--text-secondary)]">
                                      <tr>
                                          <th class="px-3 py-2">Variant</th>
                                          <th class="px-3 py-2 w-32">SKU</th>
                                          <th class="px-3 py-2 w-28">Price</th>
                                          <th class="px-3 py-2 w-28">Cost</th>
                                          <th class="px-3 py-2 w-24">Stock</th>
                                          <th class="px-3 py-2 w-24">Alert</th>
                                          <th class="px-3 py-2 w-24">Status</th>
                                          <th class="px-3 py-2">Images</th>
                                      </tr>
                                  </thead>
                                  <tbody class="divide-y divide-[var(--border-color)]/30">
                                      <tr v-for="(variant, idx) in form.variants" :key="idx" class="hover:bg-[var(--bg-card)]/50 transition-colors">
                                          <td class="px-3 py-2 font-medium text-[var(--text-main)]">{{ formatVariantName(variant.options_values) }}</td>
                                          <td class="px-3 py-2"><input v-model="variant.sku" type="text" class="input p-1 text-xs w-full bg-[var(--bg-card)] border-[var(--border-color)]"></td>
                                          <td class="px-3 py-2"><input v-model.number="variant.price" type="number" class="input p-1 text-xs w-full bg-[var(--bg-card)] border-[var(--border-color)]"></td>
                                          <td class="px-3 py-2"><input v-model.number="variant.cost_price" type="number" class="input p-1 text-xs w-full bg-[var(--bg-card)] border-[var(--border-color)]"></td>
                                          <td class="px-3 py-2"><input v-model.number="variant.stock_quantity" type="number" class="input p-1 text-xs w-full bg-[var(--bg-card)] border-[var(--border-color)]"></td>
                                          <td class="px-3 py-2"><input v-model.number="variant.alert_threshold" type="number" class="input p-1 text-xs w-full bg-[var(--bg-card)] border-[var(--border-color)]"></td>
                                          <td class="px-3 py-2">
                                            <select v-model="variant.status" class="input p-1 text-xs w-full bg-[var(--bg-card)] border-[var(--border-color)]">
                                              <option value="active">active</option>
                                              <option value="archived">archived</option>
                                            </select>
                                          </td>
                                          <td class="px-3 py-2">
                                              <div class="mb-2 flex flex-wrap gap-1">
                                                  <span
                                                    v-for="image in (variant.images || [])"
                                                    :key="image.image_id"
                                                    class="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 text-xs"
                                                  >
                                                      <button
                                                        type="button"
                                                        :data-testid="`variant-row-set-primary-${idx}-${image.image_id}`"
                                                        class="font-medium"
                                                        :class="Number(image.is_primary) === 1 ? 'text-[var(--color-primary)]' : 'text-[var(--text-secondary)]'"
                                                        @click="handleVariantRowSetPrimary(variant, image.image_id)"
                                                      >
                                                          {{ image.image_id }}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        :data-testid="`variant-row-remove-image-${idx}-${image.image_id}`"
                                                        class="text-[var(--color-danger)]"
                                                        @click="handleVariantRowRemoveImage(variant, image.image_id)"
                                                      >
                                                          ×
                                                      </button>
                                                  </span>
                                              </div>
                                              <div class="flex items-center gap-1">
                                                  <input
                                                    :data-testid="`variant-row-upload-input-${idx}`"
                                                    v-model="variantRowImageDrafts[idx]"
                                                    class="input w-full p-1 text-xs"
                                                    type="text"
                                                    placeholder="Image ID"
                                                  >
                                                  <button
                                                    type="button"
                                                    :data-testid="`variant-row-upload-btn-${idx}`"
                                                    class="rounded border border-[var(--border-color)] px-2 py-1 text-xs"
                                                    @click="handleVariantRowUpload(variant, idx)"
                                                  >
                                                      Add
                                                  </button>
                                              </div>
                                          </td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      <!-- Images -->
                      <div>
                          <ImageUploader 
                              v-model="imageObjects"
                              :label="t('product.form.media')"
                              :hint="t('product.form.media_help')"
                              :upload-endpoint="API.MANAGE_UPLOAD"
                              :max-files="10"
                              context="product"
                          />
                      </div>
                  </div>

                  <!-- Sidebar (1 span) -->
                  <div class="space-y-6">
                       <!-- Product Identity Card -->
                      <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                         <h4 class="font-bold text-(--text-main)">{{ t('product.form.inventory') }}</h4>
                         <AppInput
                           v-model="form.spu"
                           :label="t('product.form.spu')"
                           class="font-mono uppercase"
                         />
                      </div>

                       <!-- Organization Card -->
                      <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                         <h4 class="font-bold text-(--text-main)">{{ t('product.form.organization') }}</h4>
                         <AppInput
                           v-model="form.slug"
                           :label="t('product.form.slug_seo')"
                           :placeholder="t('product.form.slug_placeholder')"
                         />
                      </div>
                  </div>

              </form>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 border-t border-(--border-color) bg-(--bg-muted) px-6 py-4">
              <AppButton
                variant="secondary"
                :text="t('product.action.cancel')"
                @click="$emit('update:modelValue', false)"
              />
              <AppButton
                variant="primary"
                :text="submitting ? t('common.saving') : (editMode ? t('product.action.save') : t('product.action.create'))"
                :loading="submitting"
                @click="handleSubmit"
              />
          </div>

        </div>
      </div>
    </div>
    <VariantImageManagerModal
      v-model="showVariantImageManager"
      :variants="form.variants"
      @upload-image="handleVariantImageUpload"
      @set-primary="handleVariantSetPrimary"
      @sort-images="handleVariantImageSort"
    />
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import ImageUploader from '@/components/common/ImageUploader.vue';
import VariantImageManagerModal from '@/components/product/VariantImageManagerModal.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import { API } from '@/utils/constants';
import { buildVariantSku } from './variant-sku.js';

const { t } = useI18n();
const { addToast } = useToast();
const props = defineProps({
    modelValue: Boolean,
    editMode: Boolean,
    initialData: {
        type: Object,
        default: () => ({})
    }
});
const emit = defineEmits(['update:modelValue', 'success']);

const { createProduct, updateProduct, addVariantImage, sortVariantImages, setVariantPrimaryImage, removeVariantImage } = useProducts();
const submitting = ref(false);
const showVariantImageManager = ref(false);
const variantRowImageDrafts = reactive({});

const imageObjects = ref([]);

const form = reactive({
    name: '',
    description: '',
    brand: '',
    series: '',
    category: '',
    spu: '',
    slug: '',
    images: [],
    options: [],
    variants: [],
});

// Reset form when modal opens
watch(() => props.modelValue, (isOpen) => {
    if (isOpen) {
        if (props.editMode && props.initialData) {
            fillFormFromData(props.initialData);
        } else {
            resetForm();
        }
    }
}, { immediate: true });

function fillFormFromData(data) {
    const imgs = parseJson(data.images) || [];
    
    Object.assign(form, {
        name: data.name || '',
        description: data.description || '',
        brand: data.brand || '',
        series: data.series || '',
        category: data.category || '',
        spu: data.spu || '',
        slug: data.slug || '',
        images: imgs,
        options: parseJson(data.options) || [],
        variants: (data.variants || []).map((variant) => ({
            ...variant,
            cost_price: variant.cost_price ?? 0,
            alert_threshold: variant.alert_threshold ?? 10,
            status: variant.status || 'active',
            images: Array.isArray(variant.images) ? variant.images : [],
        })),
    });

    // Populate imageObjects for Uploader
    imageObjects.value = imgs.map(id => ({
        id: id,
        url: `/file/${id}`
    }));
}

function resetForm() {
    Object.assign(form, {
        name: '',
        description: '',
        brand: '',
        series: '',
        category: '',
        spu: '',
        slug: '',
        images: [],
        options: [],
        variants: [],
    });
    imageObjects.value = [];
}

function parseJson(str) {
    try { return typeof str === 'string' ? JSON.parse(str) : (str || null); } catch { return null; }
}

const addOption = () => {
    form.options.push({ name: '', values: [], inputValue: '' });
};

const removeOption = (idx) => {
    form.options.splice(idx, 1);
    generateVariants();
};

const addOptionValue = (opt) => {
    if (!opt.inputValue) return;
    const vals = opt.inputValue.split(',').map(v => v.trim()).filter(Boolean);
    vals.forEach(v => {
        if (!opt.values.includes(v)) opt.values.push(v);
    });
    opt.inputValue = '';
    generateVariants();
};

const removeOptionValue = (opt, vIdx) => {
    opt.values.splice(vIdx, 1);
    generateVariants();
};

const formatVariantName = (optionsValues) => {
    return Object.values(optionsValues).join(' / ');
};

const generateVariants = () => {
    const validOptions = form.options.filter(o => o.name && o.values.length > 0);
    if (validOptions.length === 0) {
        form.variants = [];
        return;
    }

    const cartesian = validOptions.reduce((acc, opt) => {
        const res = [];
        acc.forEach(oldObj => {
            opt.values.forEach(val => {
                res.push({ ...oldObj, [opt.name]: val });
            });
        });
        return res;
    }, [{}]);

    const oldVariantsMap = new Map();
    form.variants.forEach(v => {
        const key = JSON.stringify(v.options_values);
        oldVariantsMap.set(key, v);
    });

    form.variants = cartesian.map(combo => {
        const key = JSON.stringify(combo);
        const old = oldVariantsMap.get(key);
        if (old) return old;
        
        return {
            sku: buildVariantSku({ spu: form.spu, optionsValues: combo, seed: `${Date.now()}-${Math.random()}` }),
            price: 0,
            cost_price: 0,
            stock_quantity: 0,
            alert_threshold: 10,
            options_values: combo,
            status: 'active'
        };
    });
};

const handleSubmit = async () => {
    if (!form.name) {
        addToast({ 
            message: t('common.validation_error', '请填写必填项 (商品名称)'), 
            type: 'error' 
        });
        return;
    }
    if (!Array.isArray(form.variants) || form.variants.length === 0) {
        addToast({
            message: t('common.validation_error', '请至少添加一个变体'),
            type: 'error'
        });
        return;
    }
    const invalidVariant = form.variants.find((variant) => (
        variant.price === undefined ||
        variant.cost_price === undefined ||
        variant.stock_quantity === undefined ||
        variant.alert_threshold === undefined ||
        !variant.status
    ));
    if (invalidVariant) {
        addToast({
            message: t('common.validation_error', '请完善每个变体的价格/成本/库存/预警/状态'),
            type: 'error'
        });
        return;
    }
    
    submitting.value = true;
    try {
        // Extract IDs from imageObjects
        const currentImageIds = imageObjects.value.map(f => f.id).filter(Boolean);

        // Transform to snake_case for API
        const payload = {
            name: form.name,
            description: form.description,
            brand: form.brand,
            series: form.series,
            category: form.category,
            spu: form.spu || undefined,
            slug: form.slug || undefined,
            images: currentImageIds, // Send array of IDs
            options: form.options.map(o => ({ name: o.name, values: o.values })),
            variants: form.variants,
        };
        
        let success = false;
        
        if (props.editMode) {
            success = await updateProduct(props.initialData.id, payload);
        } else {
            success = await createProduct(payload);
        }

        if (success) {
            emit('success');
            emit('update:modelValue', false);
        }
    } finally {
        submitting.value = false;
    }
};

const getEditableProductId = () => props.editMode ? props.initialData?.id : null;

const findVariant = (variantId) => form.variants.find(v => v.id === variantId);

const handleVariantImageUpload = async ({ variantId, imageId }) => {
    const variant = findVariant(variantId);
    if (!variant) return;

    const productId = getEditableProductId();
    if (productId) {
        const response = await addVariantImage(productId, variantId, { imageId });
        if (!response?.success) {
            addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
            return;
        }
    }

    if (!Array.isArray(variant.images)) variant.images = [];
    if (!variant.images.find((img) => img.image_id === imageId)) {
        variant.images.push({ image_id: imageId, is_primary: variant.images.length === 0 ? 1 : 0 });
    }
};

const handleVariantSetPrimary = async ({ variantId, imageId }) => {
    const variant = findVariant(variantId);
    if (!variant) return;

    const productId = getEditableProductId();
    if (productId) {
        const response = await setVariantPrimaryImage(productId, variantId, imageId);
        if (!response?.success) {
            addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
            return;
        }
    }

    if (!Array.isArray(variant.images)) return;
    variant.images = variant.images.map((img) => ({
        ...img,
        is_primary: img.image_id === imageId ? 1 : 0,
    }));
};

const handleVariantImageSort = async ({ variantId, imageIds }) => {
    const variant = findVariant(variantId);
    if (!variant || !Array.isArray(variant.images)) return;

    const productId = getEditableProductId();
    if (productId) {
        const response = await sortVariantImages(productId, variantId, imageIds);
        if (!response?.success) {
            addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
            return;
        }
    }

    const imageMap = new Map(variant.images.map((img) => [img.image_id, img]));
    variant.images = imageIds.map((id) => imageMap.get(id)).filter(Boolean);
};

const ensureVariantImages = (variant) => {
    if (!Array.isArray(variant.images)) variant.images = [];
    return variant.images;
};

const handleVariantRowUpload = async (variant, rowIndex) => {
    const imageId = String(variantRowImageDrafts[rowIndex] || '').trim();
    if (!imageId) return;
    const previous = [...ensureVariantImages(variant)];

    variant.images.push({ image_id: imageId, is_primary: variant.images.length === 0 ? 1 : 0 });
    variantRowImageDrafts[rowIndex] = '';

    const productId = getEditableProductId();
    if (!productId || !variant.id) return;

    const response = await addVariantImage(productId, variant.id, { imageId });
    if (!response?.success) {
        variant.images = previous;
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
    }
};

const handleVariantRowSetPrimary = async (variant, imageId) => {
    const previous = [...ensureVariantImages(variant)];
    variant.images = variant.images.map((img) => ({
        ...img,
        is_primary: img.image_id === imageId ? 1 : 0,
    }));

    const productId = getEditableProductId();
    if (!productId || !variant.id) return;

    const response = await setVariantPrimaryImage(productId, variant.id, imageId);
    if (!response?.success) {
        variant.images = previous;
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
    }
};

const handleVariantRowRemoveImage = async (variant, imageId) => {
    const previous = [...ensureVariantImages(variant)];
    variant.images = variant.images.filter((img) => img.image_id !== imageId);
    if (!variant.images.some((img) => Number(img.is_primary) === 1) && variant.images[0]) {
        variant.images[0].is_primary = 1;
    }

    const productId = getEditableProductId();
    if (!productId || !variant.id) return;

    const response = await removeVariantImage(productId, variant.id, imageId);
    if (!response?.success) {
        variant.images = previous;
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
    }
};
</script>
