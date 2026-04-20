<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.backup.title', 'System Backups')"
      :description="t('settings.backup.description', 'Create and download full system backups including database and stored files.')"
      icon="cloud-arrow-up"
    >
      <template #action>
        <AppButton
          :disabled="creating"
          variant="primary"
          :loading="creating"
          @click="createBackup"
        >
          <template v-if="!creating" #icon-left>
            <AppIcon name="plus" class="size-4" />
          </template>
          {{ creating ? t('settings.backup.creating', 'Creating...') : t('settings.backup.create', 'Create Backup') }}
        </AppButton>
      </template>

      <!-- Backup List -->
      <div class="overflow-hidden rounded-lg border border-(--border-color)">
        <AppTable
          :columns="columns"
          :data="backups"
          :loading="loading"
          :empty-text="t('settings.backup.empty', 'No backups found')"
          no-border
          table-layout="fixed"
        >
          <template #cell-name="{ row: backup }">
            <div class="flex min-w-0 items-center gap-3 font-medium text-(--text-main)">
              <AppIcon name="document" class="group-hover:text-primary size-5 text-(--text-muted) transition-colors" />
              <span class="truncate" :title="backup.name">{{ backup.name }}</span>
            </div>
          </template>
          <template #cell-size="{ row: backup }">
            <span class="font-mono text-xs text-(--text-secondary)">{{ formatSize(backup.size) }}</span>
          </template>
          <template #cell-date="{ row: backup }">
            <span class="text-(--text-secondary)">{{ formatDate(backup.uploadedAt) }}</span>
          </template>
          <template #cell-actions="{ row: backup }">
            <div class="flex flex-wrap justify-end gap-2 pr-2">
              <AppButton
                variant="secondary"
                size="sm"
                @click="handleValidateBackup(backup)"
              >
                {{ t('settings.backup.validate', 'Validate') }}
              </AppButton>
              <AppButton
                variant="secondary"
                size="sm"
                @click="handleDryRunBackup(backup)"
              >
                {{ t('settings.backup.dryRun', 'Dry Run') }}
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                @click="openRestoreDialog(backup)"
              >
                {{ t('common.restore', 'Restore') }}
              </AppButton>
              <AppButton
                variant="white"
                size="sm"
                @click="downloadBackup(backup)"
              >
                <template #icon-left>
                  <AppIcon name="arrow-down-tray" class="size-3.5" />
                </template>
                {{ t('common.download', 'Download') }}
              </AppButton>
            </div>
          </template>
        </AppTable>
      </div>
    </SettingsSection>

    <BackupRestoreDialog
      v-model="restoreDialogVisible"
      :backup="selectedBackup"
      :result="restoreResult"
      :loading="restoreLoading"
      @validate="handleValidateBackup()"
      @dry-run="handleDryRunBackup()"
      @restore="handleRestoreBackup()"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import BackupRestoreDialog from '@/components/settings/backup/BackupRestoreDialog.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppTable from '@/components/ui/AppTable.vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { formatSize, formatDate } from '@/utils/formatters';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

const backups = ref([]);
const loading = ref(true);
const creating = ref(false);
const selectedBackup = ref(null);
const restoreDialogVisible = ref(false);
const restoreResult = ref(null);
const restoreLoading = ref(false);

const columns = computed(() => [
  { key: 'name', label: t('settings.backup.filename', 'Filename'), width: '320px', minWidth: '320px' },
  { key: 'size', label: t('settings.backup.size', 'Size'), kind: 'numeric', width: '120px', maxWidth: '120px' },
  { key: 'date', label: t('settings.backup.date', 'Date'), kind: 'datetime', width: '180px', maxWidth: '180px' },
  { key: 'actions', label: t('common.actions', 'Actions'), align: 'right', width: '320px', maxWidth: '320px', nowrap: true },
]);

const fetchBackups = async () => {
  try {
    loading.value = true;
    const res = await authFetch('/api/manage/backups');
    const json = await res.json();
    if (json.success) {
      backups.value = json.data;
    } else {
      addToast({ type: 'error', message: json.error || t('settings.backup.loadFailed') });
    }
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  } finally {
    loading.value = false;
  }
};

const createBackup = async () => {
  try {
    creating.value = true;
    const res = await authFetch('/api/manage/backups', { method: 'POST' });
    const json = await res.json();

    if (json.success) {
      addToast({ type: 'success', message: t('settings.backup.createSuccess') });
      await fetchBackups();
    } else {
      addToast({ type: 'error', message: json.error || t('settings.backup.createFailed') });
    }
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  } finally {
    creating.value = false;
  }
};

const executeRestoreAction = async (action, backup = selectedBackup.value) => {
  if (!backup?.name) return;

  selectedBackup.value = backup;
  restoreDialogVisible.value = true;

  try {
    restoreLoading.value = true;
    const endpoint = `/api/manage/backups/${encodeURIComponent(backup.name)}/${action}`;
    const res = await authFetch(endpoint, { method: 'POST' });
    const json = await res.json();

    if (json.success) {
      restoreResult.value = json.data;
      if (action === 'restore') {
        addToast({ type: 'success', message: t('settings.backup.restoreSuccess') });
        await fetchBackups();
      }
    } else {
      addToast({ type: 'error', message: json.error || t('settings.backup.restoreFailed', 'Backup restore failed') });
    }
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  } finally {
    restoreLoading.value = false;
  }
};

const openRestoreDialog = async (backup) => {
  selectedBackup.value = backup;
  restoreResult.value = null;
  restoreDialogVisible.value = true;
  await executeRestoreAction('validate', backup);
};

const handleValidateBackup = async (backup = selectedBackup.value) => {
  await executeRestoreAction('validate', backup);
};

const handleDryRunBackup = async (backup = selectedBackup.value) => {
  await executeRestoreAction('dry-run', backup);
};

const handleRestoreBackup = async (backup = selectedBackup.value) => {
  await executeRestoreAction('restore', backup);
};

const downloadBackup = async (backup) => {
  try {
    const res = await authFetch(`/api/manage/backups/${backup.name}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  }
};

onMounted(() => {
  fetchBackups();
});
</script>
