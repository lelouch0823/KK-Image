<template>
  <Modal
    :model-value="modelValue"
    :title="backup ? t('settings.backup.restoreDialogTitle', 'Backup Restore Workspace') : t('settings.backup.restoreDialogTitle', 'Backup Restore Workspace')"
    size="xl"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <section class="rounded-2xl border border-(--border-color) bg-(--bg-muted)/35 p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <p class="text-xs font-semibold tracking-[0.14em] text-(--text-muted) uppercase">
              {{ t('settings.backup.restoreSelected', 'Selected Backup') }}
            </p>
            <h3 class="text-base font-semibold text-(--text-main)">
              {{ backup?.name || t('settings.backup.restoreNone', 'No backup selected') }}
            </h3>
            <p class="text-sm text-(--text-secondary)">
              {{ result?.message || t('settings.backup.restoreHint', 'Validate first, dry-run second, and only then consider restore.') }}
            </p>
          </div>
          <StatusBadge :variant="result?.allowed === false ? 'danger' : 'info'" dot>
            {{ result?.environment || t('settings.backup.restoreUnknownEnv', 'unknown environment') }}
          </StatusBadge>
        </div>
      </section>

      <section class="grid gap-3 md:grid-cols-3">
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
          <div class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
            {{ t('settings.backup.filename', 'Filename') }}
          </div>
          <div class="mt-2 text-sm font-medium text-(--text-main)">{{ backup?.name || '-' }}</div>
        </div>
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
          <div class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
            {{ t('settings.backup.restoreMode', 'Last Mode') }}
          </div>
          <div class="mt-2 text-sm font-medium text-(--text-main)">{{ result?.mode || '-' }}</div>
        </div>
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
          <div class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
            {{ t('settings.backup.restoreAllowed', 'Execution Allowed') }}
          </div>
          <div class="mt-2 text-sm font-medium text-(--text-main)">
            {{ result?.allowed === false ? t('common.no', 'No') : t('common.yes', 'Yes') }}
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-sm font-semibold text-(--text-main)">
              {{ t('settings.backup.restoreSummary', 'Latest Summary') }}
            </h4>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{ t('settings.backup.restoreSummaryHint', 'This panel shows the latest validate, dry-run, or restore response for this backup.') }}
            </p>
          </div>
          <StatusBadge
            :variant="result?.mode === 'restore' ? 'warning' : result?.allowed === false ? 'danger' : 'success'"
            outline
          >
            {{ result?.mode || t('settings.backup.restoreIdle', 'idle') }}
          </StatusBadge>
        </div>

        <div
          v-if="result"
          class="mt-4 overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-page)"
        >
          <pre class="max-h-72 overflow-auto p-4 text-xs text-(--text-main)">{{ formattedResult }}</pre>
        </div>
        <div
          v-else
          class="mt-4 rounded-2xl border border-dashed border-(--border-color) p-4 text-sm text-(--text-secondary)"
        >
          {{ t('settings.backup.restoreEmpty', 'No restore summary yet. Use Validate or Dry Run to inspect this backup first.') }}
        </div>
      </section>

      <section class="rounded-2xl border border-warning/25 bg-warning/8 p-4 text-sm text-(--text-secondary)">
        <div class="flex items-start gap-2">
          <AppIcon name="information-circle" class="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            {{ t('settings.backup.restoreDangerNote', 'Restore currently runs in audit-summary-only mode outside production. Production restore requests are blocked.') }}
          </p>
        </div>
      </section>
    </div>

    <template #footer>
      <AppButton
        variant="secondary"
        :disabled="!backup || loading"
        :loading="loading"
        @click="emit('validate')"
      >
        {{ t('settings.backup.validate', 'Validate') }}
      </AppButton>
      <AppButton
        variant="secondary"
        :disabled="!backup || loading"
        :loading="loading"
        @click="emit('dry-run')"
      >
        {{ t('settings.backup.dryRun', 'Dry Run') }}
      </AppButton>
      <AppButton
        variant="danger"
        :disabled="!backup || loading"
        :loading="loading"
        @click="confirmVisible = true"
      >
        {{ t('common.restore', 'Restore') }}
      </AppButton>
    </template>
  </Modal>

  <ConfirmDialog
    v-model="confirmVisible"
    type="danger"
    :title="t('settings.backup.restoreConfirmTitle', 'Confirm Restore Request')"
    :message="t('settings.backup.restoreConfirmMessage', 'This action is restricted and fully audited. Continue only if the selected backup is correct.')"
    :confirm-text="t('common.restore', 'Restore')"
    :cancel-text="t('common.cancel', 'Cancel')"
    :loading="loading"
    @confirm="handleRestoreConfirm"
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  backup: {
    type: Object,
    default: null,
  },
  result: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'validate', 'dry-run', 'restore']);

const { t } = useI18n();
const confirmVisible = ref(false);

const formattedResult = computed(() => JSON.stringify(props.result || {}, null, 2));

function handleRestoreConfirm() {
  confirmVisible.value = false;
  emit('restore');
}
</script>
