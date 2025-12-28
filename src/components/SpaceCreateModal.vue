<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <h2 class="text-lg font-semibold text-primary">{{ t('spaceManager.createModalTitle') }}</h2>
        <button @click="$emit('close')" class="p-2 text-secondary hover:text-primary rounded-lg hover:bg-[var(--bg-hover)]">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- 模版选择 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">{{ t('spaceManager.selectTemplate') }}</label>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="t in templates" :key="t.key" type="button"
              @click="form.template = t.key"
              class="flex items-center gap-2 p-3 border rounded-lg text-left transition-all"
              :class="form.template === t.key ? 'border-primary bg-[var(--bg-muted)]' : 'border-[var(--border-color)] hover:border-gray-300'">
              <span v-html="t.icon" class="w-5 h-5 text-secondary shrink-0"></span>
              <div>
                <div class="text-sm font-medium text-primary">{{ t.label }}</div>
                <div class="text-xs text-secondary">{{ t.desc }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- 通用字段: 描述 (仅非商品模版显示，商品模版在详情里填) -->
        <div v-if="form.template !== 'product'">
          <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.descLabel') }}</label>
          <textarea v-model="form.description" rows="2"
            class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
            :placeholder="t('spaceManager.descPlaceholder')"></textarea>
        </div>

        <!-- 动态表单: 商品模版 -->
        <div v-if="form.template === 'product'" class="space-y-4 pt-2 border-t border-[var(--border-color)]">
           <!-- 商品名称 (覆盖通用名称) -->
          <div>
            <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.productName') }} *</label>
            <input v-model="form.name" type="text" required
              class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              :placeholder="t('spaceManager.productNamePlaceholder')">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.brand') }}</label>
              <input v-model="form.templateData.brand" type="text"
                class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none"
                :placeholder="t('spaceManager.brandPlaceholder')">
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.series') }}</label>
              <input v-model="form.templateData.series" type="text"
                class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none"
                :placeholder="t('spaceManager.seriesPlaceholder')">
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.price') }}</label>
              <div class="relative">
                <span class="absolute left-3 top-2.5 text-secondary">¥</span>
                <input v-model="form.templateData.price" type="number" step="0.01"
                  class="w-full pl-8 pr-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none"
                  placeholder="0.00">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.material') }}</label>
              <input v-model="form.templateData.material" type="text"
                class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none"
                :placeholder="t('spaceManager.materialPlaceholder')">
            </div>
          </div>
        </div>

        <!-- 动态表单: 通用模版 -->
        <div v-else>
           <!-- 空间名称 -->
          <div>
            <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.spaceName') }} *</label>
            <input v-model="form.name" type="text" required
              class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              :placeholder="t('spaceManager.spaceNamePlaceholder')">
          </div>
        </div>

        <!-- 提交按钮 -->
        <button type="submit" :disabled="submitting"
          class="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 mt-4">
          {{ submitButtonText }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useI18n } from '@/composables/useI18n';

const emit = defineEmits(['close', 'created']);

const { createSpace } = useSpaces();
const { t } = useI18n();

const form = ref({
  name: '',
  description: '',
  template: 'gallery',
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: ''
  }
});

const submitting = ref(false);

const templates = computed(() => [
  { key: 'gallery', label: t('spaceManager.templates.gallery'), desc: t('spaceManager.templates.galleryDesc'), icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>' },
  { key: 'product', label: t('spaceManager.templates.product'), desc: t('spaceManager.templates.productDesc'), icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>' },
  { key: 'collection', label: t('spaceManager.templates.collection'), desc: t('spaceManager.templates.collectionDesc'), icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>' },
  { key: 'document', label: t('spaceManager.templates.document'), desc: t('spaceManager.templates.documentDesc'), icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>' },
  { key: 'portfolio', label: t('spaceManager.templates.portfolio'), desc: t('spaceManager.templates.portfolioDesc'), icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>' }
]);

const submitButtonText = computed(() => {
  if (submitting.value) return t('spaceManager.creating');
  return form.value.template === 'product' ? t('spaceManager.createProduct') : t('spaceManager.createSpace');
});

const handleSubmit = async () => {
  if (!form.value.name.trim()) return;
  
  submitting.value = true;
  const result = await createSpace(form.value);
  submitting.value = false;
  
  if (result) {
    emit('created', result);
  }
};
</script>
