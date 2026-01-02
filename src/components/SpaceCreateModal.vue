<template>
  <Modal
    :model-value="true"
    :title="isSubspace ? t('spaceManager.createSubspace') : t('spaceManager.createModalTitle')"
    size="md"
    @update:model-value="$emit('close')"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- 模版选择 -->
      <div>
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
                ? 'border-primary bg-[var(--bg-muted)]'
                : 'border-[var(--border-color)] hover:border-gray-300'
            "
            @click="form.template = tpl.key"
          >
            <span class="text-secondary size-5 shrink-0" v-html="tpl.icon"></span>
            <div>
              <div class="text-primary text-sm font-medium">{{ tpl.label }}</div>
              <div class="text-secondary text-xs">{{ tpl.desc }}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- 通用字段: 描述 (仅非商品模版显示，商品模版在详情里填) -->
      <div v-if="form.template !== 'product'">
        <label class="text-primary mb-1 block text-sm font-medium">{{
          t('spaceManager.descLabel')
        }}</label>
        <textarea
          v-model="form.description"
          rows="2"
          class="focus:border-primary focus:ring-primary focus:ring-1 w-full resize-none rounded-lg border border-[var(--border-color)] px-4 py-2.5 outline-none"
          :placeholder="t('spaceManager.descPlaceholder')"
        ></textarea>
      </div>

      <!-- 动态表单: 商品模版 -->
      <div
        v-if="form.template === 'product'"
        class="space-y-4 border-t border-[var(--border-color)] pt-2"
      >
        <!-- 商品名称 (覆盖通用名称) -->
        <div>
          <label class="text-primary mb-1 block text-sm font-medium"
            >{{ t('spaceManager.productName') }} *</label
          >
          <input
            v-model="form.name"
            type="text"
            required
            class="focus:border-primary focus:ring-primary focus:ring-1 w-full rounded-lg border border-[var(--border-color)] px-4 py-2.5 outline-none"
            :placeholder="t('spaceManager.productNamePlaceholder')"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.brand')
            }}</label>
            <input
              v-model="form.templateData.brand"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2.5 outline-none"
              :placeholder="t('spaceManager.brandPlaceholder')"
            />
          </div>
          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.series')
            }}</label>
            <input
              v-model="form.templateData.series"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2.5 outline-none"
              :placeholder="t('spaceManager.seriesPlaceholder')"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.price')
            }}</label>
            <div class="relative">
              <span class="text-secondary absolute top-2.5 left-3">¥</span>
              <input
                v-model="form.templateData.price"
                type="number"
                step="0.01"
                class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] py-2.5 pr-4 pl-8 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.material')
            }}</label>
            <input
              v-model="form.templateData.material"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2.5 outline-none"
              :placeholder="t('spaceManager.materialPlaceholder')"
            />
          </div>
        </div>
      </div>

      <!-- 动态表单: 通用模版 -->
      <div v-else>
        <!-- 空间名称 -->
        <div>
          <label class="text-primary mb-1 block text-sm font-medium"
            >{{ t('spaceManager.spaceName') }} *</label
          >
          <input
            v-model="form.name"
            type="text"
            required
            class="focus:border-primary focus:ring-primary focus:ring-1 w-full rounded-lg border border-[var(--border-color)] px-4 py-2.5 outline-none"
            :placeholder="t('spaceManager.spaceNamePlaceholder')"
          />
        </div>
      </div>
    </form>

    <template #footer>
      <button
        class="text-secondary rounded-lg px-4 py-2 transition-colors hover:bg-gray-100"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :disabled="submitting"
        class="bg-primary rounded-lg px-6 py-2 font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
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
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  parentId: { type: String, default: null }, // 如果提供则为创建子空间
});

const emit = defineEmits(['close', 'created']);

const { createSpace, createSubspace } = useSpaces();
const { t } = useI18n();

const isSubspace = computed(() => !!props.parentId);

const form = ref({
  name: '',
  description: '',
  template: 'gallery',
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: '',
  },
});

const submitting = ref(false);

const templates = computed(() => [
  {
    key: 'gallery',
    label: t('spaceManager.templates.gallery'),
    desc: t('spaceManager.templates.galleryDesc'),
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>',
  },
  {
    key: 'product',
    label: t('spaceManager.templates.product'),
    desc: t('spaceManager.templates.productDesc'),
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>',
  },
  {
    key: 'collection',
    label: t('spaceManager.templates.collection'),
    desc: t('spaceManager.templates.collectionDesc'),
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>',
  },
  {
    key: 'document',
    label: t('spaceManager.templates.document'),
    desc: t('spaceManager.templates.documentDesc'),
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>',
  },
  {
    key: 'portfolio',
    label: t('spaceManager.templates.portfolio'),
    desc: t('spaceManager.templates.portfolioDesc'),
    icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>',
  },
]);

const submitButtonText = computed(() => {
  if (submitting.value) return t('spaceManager.creating');
  if (isSubspace.value) return t('spaceManager.createSubspace');
  return form.value.template === 'product'
    ? t('spaceManager.createProduct')
    : t('spaceManager.createSpace');
});

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
</script>
