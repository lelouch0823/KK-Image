<template>
  <FloatingSelectionBar :visible="selectedCount > 0">
    <template #summary>
      <span class="text-primary text-sm font-medium">
        {{ t('order.manage.selectedCount', { count: selectedCount }) }}
      </span>
      <AppButton
        variant="link"
        size="sm"
        @click="$emit('cancel')"
      >
        {{ t('order.manage.cancelSelect') }}
      </AppButton>
    </template>

    <AppButton
      :disabled="processing"
      class="shadow-primary/10 shadow-lg"
      @click="$emit('action', 'confirm')"
    >
      <template #icon-left>
        <AppIcon name="check" class="size-4.5" />
      </template>
      {{ t('order.manage.batchConfirm') }}
    </AppButton>
    <AppButton
      :disabled="processing"
      variant="outline"
      class="border-warning/30 bg-warning/10 text-warning shadow-warning/10 hover:border-warning/40 hover:bg-warning/15 hover:text-warning shadow-lg"
      @click="$emit('action', 'reject')"
    >
      <template #icon-left>
        <AppIcon name="x-mark" class="size-4.5" />
      </template>
      {{ t('order.manage.batchReject') }}
    </AppButton>
    <AppButton
      variant="danger"
      :disabled="processing"
      class="shadow-danger/10 shadow-lg"
      @click="$emit('action', 'void')"
    >
      <template #icon-left>
        <AppIcon name="trash" class="size-4" />
      </template>
      {{ t('order.manage.batchVoid') }}
    </AppButton>
  </FloatingSelectionBar>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import FloatingSelectionBar from '@/design-system/composed/FloatingSelectionBar.vue';

defineProps({
  selectedCount: {
    type: Number,
    default: 0,
  },
  processing: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['action', 'cancel']);

const { t } = useI18n();
</script>
