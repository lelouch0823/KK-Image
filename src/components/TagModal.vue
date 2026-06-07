<template>
  <Modal
    :title="t('fileManager.actions.tag')"
    size="md"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-4">
      <!-- Tag Info -->
      <p class="text-sm text-(--text-secondary)">
        {{ t('fileManager.taggingItems', { count: items.length }) }}
      </p>

      <!-- Search / Create Tag -->
      <div class="flex gap-2">
        <AppInput
          v-model="newTagName"
          :placeholder="t('fileManager.newTagPlaceholder')"
          class="flex-1"
          @keyup.enter="handleCreateTag"
        />
        <AppButton
          variant="secondary"
          :text="t('common.create')"
          :loading="creating"
          :disabled="!newTagName.trim() || creating"
          @click="handleCreateTag"
        />
      </div>

      <!-- Tag List Loading -->
      <div v-if="loadingTags" class="flex justify-center p-4">
        <AppIcon name="spinner" class="text-primary size-6 animate-spin" />
      </div>

      <!-- Tag List -->
      <div v-else-if="tags && tags.length > 0" class="mt-2 flex flex-wrap gap-2">
        <AppButton
          v-for="tag in tags"
          :key="tag.id"
          variant="white"
          size="sm"
          class="!rounded-full border-(--border-color) hover:!border-primary hover:!bg-primary/10 hover:!text-primary"
          @click="handleAssignTag(tag)"
        >
          <span
            class="size-2 rounded-full"
            :style="{ backgroundColor: tag.color || '#94a3b8' }"
          ></span>
          <span>{{ tag.name }}</span>
        </AppButton>
      </div>

      <div v-else class="py-4 text-center text-sm text-(--text-secondary)">
        {{ t('fileManager.noTags') }}
      </div>
    </div>

    <template #footer>
      <div class="mt-6 flex justify-end gap-3">
        <AppButton
          variant="secondary"
          :text="t('common.close')"
          @click="$emit('update:modelValue', false)"
        />
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useTags } from '@/composables/useTags';
import { useToast } from '@/composables/useToast';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'tagged']);

const { t } = useI18n();
const { addToast } = useToast();
const { tags, loadingTags, fetchTags, createTag, assignTag } = useTags();

const newTagName = ref('');
const creating = ref(false);

const handleCreateTag = async () => {
  if (!newTagName.value.trim() || creating.value) return;

  creating.value = true;
  try {
    // Generate a random pastel color for new tags
    const hue = Math.floor(Math.random() * 360);
    const color = `hsl(${hue}, 70%, 50%)`;

    await createTag(newTagName.value.trim(), color);
    newTagName.value = '';
    addToast({ message: t('fileManager.tagCreated'), type: 'success' });
  } catch (err) {
    addToast({ message: err.message || t('common.error'), type: 'danger' });
  } finally {
    creating.value = false;
  }
};

const handleAssignTag = async (tag) => {
  if (!props.items?.length) return;

  try {
    // We bulk assign
    await Promise.all(props.items.map((item) => assignTag(item.id, tag.id)));
    addToast({
      message: t('fileManager.tagAssigned', { count: props.items.length }),
      type: 'success',
    });
    emit('tagged');
    emit('update:modelValue', false);
  } catch (_err) {
    addToast({ message: t('common.error'), type: 'danger' });
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && tags.value.length === 0) {
      fetchTags();
    }
  }
);
</script>
