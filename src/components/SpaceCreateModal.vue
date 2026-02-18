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
        <label class="mb-2 block text-sm font-medium text-[var(--color-primary)]">{{
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
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]/30 hover:border-[var(--border-hover)]'
            "
            @click="form.template = tpl.key"
          >
            <span class="size-5 shrink-0 text-[var(--text-secondary)]" v-html="tpl.icon"></span>
            <div>
              <div class="text-sm font-medium text-[var(--text-main)]">{{ tpl.label }}</div>
              <div class="text-xs text-[var(--text-secondary)]">{{ tpl.desc }}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- 通用字段: 描述 (仅非商品模版显示，商品模版在详情里填) -->
      <div v-if="form.template !== 'product'">
        <label class="mb-1 block text-sm font-medium text-[var(--text-main)]">{{
          t('spaceManager.descLabel')
        }}</label>
        <textarea
          v-model="form.description"
          rows="2"
          class="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 transition-all outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
          :placeholder="t('spaceManager.descPlaceholder')"
        ></textarea>
      </div>

      <!-- 动态表单: 商品模版 -->
      <div
        v-if="form.template === 'product'"
        class="space-y-4 border-t border-[var(--border-subtle)] pt-2"
      >
        <!-- Form -->
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <AppInput
            v-model="form.name"
            :label="t('space.name')"
            :placeholder="t('space.namePlaceholder')"
            required
          />

          <AppInput
            v-model="form.slug"
            :label="t('space.slug')"
            :placeholder="t('space.slugPlaceholder')"
            required
          />

          <AppInput
            v-model="form.description"
            :label="t('space.description')"
            :placeholder="t('space.descriptionPlaceholder')"
            textarea
            rows="3"
          />

          <!-- Actions -->
          <div class="mt-6 flex justify-end gap-3">
            <AppButton
              variant="secondary"
              :text="t('common.cancel')"
              :disabled="loading"
              @click="close"
            />
            <AppButton
              type="submit"
              variant="primary"
              :text="isEdit ? t('common.save') : t('common.create')"
              :loading="loading"
            />
          </div>
        </form>
      </div>

      <!-- 动态表单: 通用模版 -->
      <div v-else>
        <!-- 空间名称 -->
        <div>
          <label class="mb-1 block text-sm font-medium text-[var(--text-main)]"
            >{{ t('spaceManager.spaceName') }} *</label
          >
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 transition-all outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            :placeholder="t('spaceManager.spaceNamePlaceholder')"
          />
        </div>
      </div>
    </form>

    <template #footer>
      <button
        class="rounded-lg px-4 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        @click="$emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        :disabled="submitting"
        class="rounded-lg bg-[var(--color-primary)] px-6 py-2 font-medium text-[var(--text-inverse)] shadow-[var(--color-primary)]/20 shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleSubmit"
      >
        {{ submitButtonText }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useModalStack } from '@/composables/useModalStack';
import { useSpaces } from '@/composables/useSpaces';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
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
