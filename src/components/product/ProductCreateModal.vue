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

                      <!-- Specifications: Size, Color, Material -->
                      <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                          <h4 class="font-bold text-(--text-main)">{{ t('product.form.specifications') }}</h4>
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <AppInput
                                v-model="form.specifications.size"
                                :label="t('order.form.size')"
                                :placeholder="t('order.form.sizePlaceholder')"
                                size="sm"
                              />
                              <AppInput
                                v-model="form.specifications.color"
                                :label="t('order.form.color')"
                                :placeholder="t('order.form.colorPlaceholder')"
                                size="sm"
                              />
                              <AppInput
                                v-model="form.specifications.material"
                                :label="t('order.form.material')"
                                :placeholder="t('order.form.materialPlaceholder')"
                                size="sm"
                              />
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
                       <!-- Pricing Card -->
                       <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                          <h4 class="font-bold text-(--text-main)">{{ t('product.form.pricing_inventory') }}</h4>
                          <div>
                              <label class="mb-1 block text-xs font-medium text-(--text-secondary) uppercase">{{ t('product.form.price') }} <span class="text-danger">*</span></label>
                              <div class="relative mt-1 rounded-md shadow-sm">
                                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <span class="text-(--text-secondary) sm:text-sm">¥</span>
                                  </div>
                                  <input v-model.number="form.price" type="number" required class="input block w-full pl-7" placeholder="0.00">
                              </div>
                          </div>
                          <div>
                              <label class="mb-1 block text-xs font-medium text-(--text-secondary) uppercase">{{ t('product.form.cost') }}</label>
                              <div class="relative mt-1 rounded-md shadow-sm">
                                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <span class="text-(--text-secondary) sm:text-sm">¥</span>
                                  </div>
                                  <input v-model.number="form.costPrice" type="number" class="input block w-full pl-7" placeholder="0.00">
                              </div>
                          </div>
                       </div>

                       <!-- Inventory Card -->
                      <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                         <h4 class="font-bold text-(--text-main)">{{ t('product.form.inventory') }}</h4>
                         <AppInput
                           v-model="form.sku"
                           :label="t('product.form.sku')"
                           required
                           class="font-mono uppercase"
                         />
                          <div class="grid grid-cols-2 gap-4">
                             <AppInput
                               v-model.number="form.stockQuantity"
                               type="number"
                               :label="t('product.form.stock')"
                             />
                             <AppInput
                               v-model.number="form.alertThreshold"
                               type="number"
                               :label="t('product.form.alert_at')"
                             />
                          </div>
                      </div>

                       <!-- Organization Card -->
                      <div class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4">
                         <h4 class="font-bold text-(--text-main)">{{ t('product.form.organization') }}</h4>
                         <AppInput
                           v-model="form.slug"
                           :label="t('product.form.slug_seo')"
                           :placeholder="t('product.form.slug_placeholder')"
                         />
                         <div>
                             <label class="mb-1 block text-xs font-medium text-(--text-secondary) uppercase">{{ t('product.table.header.status') }}</label>
                             <Select
                               v-model="form.status"
                               :options="statusOptions"
                               :placeholder="t('product.filters.status.active')"
                               size="sm"
                             />
                         </div>
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
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import ImageUploader from '@/components/common/ImageUploader.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Select from '@/components/ui/Select.vue';
import { API } from '@/utils/constants';

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

const { createProduct, updateProduct } = useProducts();
const submitting = ref(false);

const imageObjects = ref([]);

const statusOptions = computed(() => [
  { label: t('product.filters.status.active'), value: 'active' },
  { label: t('product.filters.status.draft'), value: 'draft' },
  { label: t('product.filters.status.archived'), value: 'archived' },
]);

const form = reactive({
    name: '',
    description: '',
    brand: '',
    series: '',
    category: '',
    price: null,
    costPrice: null,
    sku: '',
    stockQuantity: 0,
    alertThreshold: 10,
    slug: '',
    status: 'active',
    images: [],
    specifications: {
        size: '',
        color: '',
        material: '',
    },
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

const fillFormFromData = (data) => {
    const imgs = parseJson(data.images) || [];
    
    Object.assign(form, {
        name: data.name || '',
        description: data.description || '',
        brand: data.brand || '',
        series: data.series || '',
        category: data.category || '',
        price: data.price ?? null,
        costPrice: data.cost_price ?? null,
        sku: data.sku || '',
        stockQuantity: data.stock_quantity ?? 0,
        alertThreshold: data.alert_threshold ?? 10,
        slug: data.slug || '',
        status: data.status || 'active',
        images: imgs,
        specifications: parseJson(data.specifications) || { size: '', color: '', material: '' },
    });

    // Populate imageObjects for Uploader
    imageObjects.value = imgs.map(id => ({
        id: id,
        url: `/file/${id}`
    }));
};

const resetForm = () => {
    Object.assign(form, {
        name: '',
        description: '',
        brand: '',
        series: '',
        category: '',
        price: null,
        costPrice: null,
        sku: '',
        stockQuantity: 0,
        alertThreshold: 10,
        slug: '',
        status: 'active',
        images: [],
        specifications: { size: '', color: '', material: '' },
    });
    imageObjects.value = [];
};

const parseJson = (str) => {
    try { return typeof str === 'string' ? JSON.parse(str) : (str || null); } catch { return null; }
};

const handleSubmit = async () => {
    if (!form.name || !form.sku) {
        addToast({ 
            message: t('common.validation_error', '请填写必填项 (商品名称, SKU)'), 
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
            price: form.price,
            cost_price: form.costPrice,
            sku: form.sku,
            stock_quantity: form.stockQuantity,
            alert_threshold: form.alertThreshold,
            slug: form.slug || undefined,
            status: form.status,
            images: currentImageIds, // Send array of IDs
            specifications: form.specifications,
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
</script>
