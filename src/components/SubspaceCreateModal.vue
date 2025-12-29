<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <h2 class="text-lg font-semibold text-primary">{{ t('spaceManager.createSubspace') }}</h2>
        <button @click="$emit('close')" class="p-2 text-secondary hover:text-primary rounded-lg hover:bg-[var(--bg-hover)]">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-4">
        <!-- Template Selection -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">{{ t('spaceManager.selectTemplate') }}</label>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="tpl in templates" :key="tpl.key"
              @click="form.template = tpl.key"
              class="p-3 border rounded-xl text-left transition-all"
              :class="form.template === tpl.key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-[var(--border-color)] hover:border-gray-300'">
              <span class="font-medium text-sm text-primary">{{ tpl.label }}</span>
              <span class="block text-xs text-secondary mt-0.5">{{ tpl.desc }}</span>
            </button>
          </div>
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.spaceName') }} *</label>
          <input v-model="form.name" type="text" 
            class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            :placeholder="t('spaceManager.spaceNamePlaceholder')">
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.descLabel') }}</label>
          <textarea v-model="form.description" rows="2"
            class="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            :placeholder="t('spaceManager.descPlaceholder')"></textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
        <button @click="$emit('close')" 
          class="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">
          {{ t('common.cancel') }}
        </button>
        <button @click="submit" :disabled="!form.name.trim() || submitting"
          class="px-5 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          <svg v-if="submitting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ submitting ? t('common.creating') : t('spaceManager.createSpace') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  parentId: { type: String, required: true }
});

const emit = defineEmits(['close', 'created']);

const { createSubspace } = useSpaces();
const { t } = useI18n();

const templates = [
  { key: 'gallery', label: t('spaceManager.templates.gallery'), desc: t('spaceManager.templates.galleryDesc') },
  { key: 'product', label: t('spaceManager.templates.product'), desc: t('spaceManager.templates.productDesc') },
  { key: 'document', label: t('spaceManager.templates.document'), desc: t('spaceManager.templates.documentDesc') },
  { key: 'portfolio', label: t('spaceManager.templates.portfolio'), desc: t('spaceManager.templates.portfolioDesc') }
];

const form = reactive({
  name: '',
  description: '',
  template: 'gallery'
});

const submitting = ref(false);

const submit = async () => {
  if (!form.name.trim()) return;
  
  submitting.value = true;
  const result = await createSubspace(props.parentId, {
    name: form.name.trim(),
    description: form.description.trim(),
    template: form.template,
    isPublic: false,
    templateData: {}
  });
  submitting.value = false;
  
  if (result) {
    emit('created', result);
  }
};
</script>
