<template>
  <Modal
    :model-value="true"
    :title="isSubspace ? t('spaceManager.createSubspace') : t('spaceManager.createModalTitle')"
    size="md"
    @update:model-value="$emit('close')"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- 模版选择 (如果有初始商品传入，则隐藏或置灰其他模板以强调当前语境) -->
      <div v-if="!initialProduct">
        <label class="text-primary mb-2 block text-sm font-medium">{{
          t('spaceManager.selectTemplate')
        }}</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="tpl in templates"
            :key="tpl.key"
            type="button"
            class="flex items-center gap-2 rounded-lg border p-3 text-left transition-all"
            :class="
              form.template === tpl.key
                ? 'border-primary bg-primary/5'
                : 'border-(--border-subtle) bg-(--bg-muted)/30 hover:border-(--border-hover)'
            "
            @click="form.template = tpl.key"
          >
            <AppIcon :name="tpl.icon" class="size-5 shrink-0 text-(--text-secondary)" />
            <div>
              <div class="text-sm font-medium text-(--text-main)">{{ tpl.label }}</div>
              <div class="text-xs text-(--text-secondary)">{{ tpl.desc }}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- 通用字段: 描述 (仅非商品模版显示，商品模版在详情里填) -->
      <div v-if="form.template !== 'product'">
        <label class="mb-1 block text-sm font-medium text-(--text-main)">{{
          t('spaceManager.descLabel')
        }}</label>
        <textarea
          v-model="form.description"
          rows="2"
          class="focus:border-primary focus:ring-primary focus:ring-1 w-full resize-none rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2.5 transition-all outline-none"
          :placeholder="t('spaceManager.descPlaceholder')"
        ></textarea>
      </div>

      <!-- 动态表单: 商品模版 -->
      <div
        v-if="form.template === 'product'"
        class="space-y-4 border-t border-(--border-subtle) pt-4"
      >
        <div class="space-y-4">
          <ProductBindingSection
            :bound-product="boundProduct"
            @select="handleProductSelect"
            @unbind="unbindProduct"
          />

          <AppInput
            v-model="form.name"
            :label="t('space.name')"
            :placeholder="t('space.namePlaceholder')"
            required
          />

          <AppInput
            v-model="form.description"
            :label="t('space.description')"
            :placeholder="t('space.descriptionPlaceholder')"
            textarea
            rows="3"
          />
        </div>
      </div>

      <!-- 动态表单: 通用模版 -->
      <div v-else>
        <!-- 空间名称 -->
        <div>
          <label class="mb-1 block text-sm font-medium text-(--text-main)"
            >{{ t('spaceManager.spaceName') }} *</label
          >
          <input
            v-model="form.name"
            type="text"
            required
            class="focus:border-primary focus:ring-primary focus:ring-1 w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2.5 transition-all outline-none"
            :placeholder="t('spaceManager.spaceNamePlaceholder')"
          />
        </div>
      </div>
    </form>

    <div class="px-6 pt-4 pb-2">
      <label class="mb-2 block text-sm font-medium text-(--text-main)">{{
        t('spaceManager.shareSettings') || '销售可见性设置'
      }}</label>
      <SpaceVisibilitySelector
        v-model="form.shareMode"
        v-model:selected-salespersons="form.sharedSalespersonIds"
        class="!border-dashed !bg-transparent shadow-none"
      />
    </div>

    <template #footer>
      <button
        class="rounded-lg px-4 py-2 text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :disabled="submitting"
        class="bg-primary shadow-primary/20 rounded-lg px-6 py-2 font-medium text-(--text-inverse) shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleSubmit"
      >
        {{ submitButtonText }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useI18n } from '@/composables/useI18n';
import AppInput from '@/components/ui/AppInput.vue';
import SpaceVisibilitySelector from '@/components/space/SpaceVisibilitySelector.vue';
import Modal from '@/components/ui/Modal.vue';
import ProductBindingSection from '@/components/order/ProductBindingSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { resolveSelectedVariantMainImageSrc } from '@/utils/product-image.js';

const props = defineProps({
  parentId: { type: String, default: null }, // 如果提供则为创建子空间
  initialProduct: { type: Object, default: null }, // 快捷分享：初始绑定的商品对象
});

const emit = defineEmits(['close', 'created']);

const { createSpace, createSubspace } = useSpaces();
const { t } = useI18n();

const isSubspace = computed(() => !!props.parentId);

const boundProduct = ref(null);

const form = ref({
  name: '',
  description: '',
  template: props.initialProduct ? 'product' : 'gallery',
  productId: props.initialProduct ? props.initialProduct.id : null,
  shareMode: 'none',
  sharedSalespersonIds: [],
  templateData: {

    brand: '',
    series: '',
    price: '',
    material: '',
    sku: '',
  },
});

const submitting = ref(false);

const templates = computed(() => [
  {
    key: 'gallery',
    label: t('spaceManager.templates.gallery'),
    desc: t('spaceManager.templates.galleryDesc'),
    icon: 'photo',
  },
  {
    key: 'product',
    label: t('spaceManager.templates.product'),
    desc: t('spaceManager.templates.productDesc'),
    icon: 'shopping-cart',
  },
  {
    key: 'collection',
    label: t('spaceManager.templates.collection'),
    desc: t('spaceManager.templates.collectionDesc'),
    icon: 'rectangle-group',
  },
  {
    key: 'document',
    label: t('spaceManager.templates.document'),
    desc: t('spaceManager.templates.documentDesc'),
    icon: 'document-text',
  },
  {
    key: 'portfolio',
    label: t('spaceManager.templates.portfolio'),
    desc: t('spaceManager.templates.portfolioDesc'),
    icon: 'squares-2x2',
  },
]);

const submitButtonText = computed(() => {
  if (submitting.value) return t('spaceManager.creating');
  if (isSubspace.value) return t('spaceManager.createSubspace');
  return t('spaceManager.createSpace');
});

const handleProductSelect = (product) => {
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
  };
  form.value.productId = product.id;
  form.value.variantId = variant.id;

  if (!form.value.name) form.value.name = product.name || '';
};

const unbindProduct = () => {
  boundProduct.value = null;
  form.value.productId = null;
};

const handleSubmit = async () => {
  if (!form.value.name.trim()) return;

  submitting.value = true;
  let result;

  if (isSubspace.value) {
    // 创建子空间
    result = await createSubspace(props.parentId, form.value);
  } else {
    // 创建顶级空间
    result = await createSpace(form.value);
  }

  submitting.value = false;

  if (result) {
    emit('created', result);
  }
};

// Handle optional initialization for Pseudo-Merge quick-share flows
import { onMounted } from 'vue';
onMounted(() => {
  if (props.initialProduct) {
    handleProductSelect(props.initialProduct);
    
    // Auto-generate a default share name if not provided
    if (form.value.name === props.initialProduct.name || !form.value.name) {
      const dateStr = new Date().toLocaleDateString();
      form.value.name = `${props.initialProduct.name} - ${dateStr}`;
    }
  }
});
</script>
