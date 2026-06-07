<template>
  <Modal
    :model-value="modelValue"
    :title="isEditing ? t('product.categoryTree.edit') : t('product.categoryTree.add')"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('update:modelValue', false)"
  >
    <div class="space-y-4">
      <!-- 分类名称 -->
      <div>
        <label class="mb-1 block text-sm font-medium text-(--text-main)">
          {{ t('product.form.name') }}
        </label>
        <AppInput
          v-model="form.name"
          :placeholder="t('product.categoryTree.name_placeholder')"
          autofocus
        />
      </div>

      <!-- 父分类选择 -->
      <div>
        <label class="mb-1 block text-sm font-medium text-(--text-main)">
          {{ t('product.categoryTree.parent') }}
        </label>
        <select
          v-model="form.parent_id"
          class="w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-sm text-(--text-main)"
        >
          <option :value="null">{{ t('product.categoryTree.root') }}</option>
          <option v-for="opt in parentOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- 排序 -->
      <div>
        <label class="mb-1 block text-sm font-medium text-(--text-main)">
          {{ t('product.categoryTree.sort_order') }}
        </label>
        <AppInput v-model.number="form.sort_order" type="number" min="0" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <AppButton
          variant="white"
          :text="t('product.action.cancel')"
          @click="$emit('update:modelValue', false)"
        />
        <AppButton
          variant="primary"
          :text="isEditing ? t('product.action.save') : t('product.categoryTree.add')"
          :loading="submitting"
          @click="handleSubmit"
        />
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import type { CategoryNode, CategoryPayload } from '@/composables/useCategories';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  category?: CategoryNode | null; // 编辑时传入
  parentOptions: { value: string; label: string; level: number }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [payload: CategoryPayload & { id?: string }];
}>();

const submitting = ref(false);
const isEditing = computed(() => !!props.category);

const form = reactive({
  name: '',
  parent_id: null as string | null,
  sort_order: 0,
});

// 当 category 变化时，填充表单
watch(
  () => props.category,
  (cat) => {
    if (cat) {
      form.name = cat.name;
      form.parent_id = cat.parent_id;
      form.sort_order = cat.sort_order;
    } else {
      form.name = '';
      form.parent_id = null;
      form.sort_order = 0;
    }
  },
  { immediate: true }
);

const handleSubmit = async () => {
  if (!form.name.trim()) return;
  submitting.value = true;
  try {
    emit('submit', {
      id: props.category?.id,
      name: form.name.trim(),
      parent_id: form.parent_id,
      sort_order: form.sort_order,
    });
  } finally {
    submitting.value = false;
  }
};
</script>
