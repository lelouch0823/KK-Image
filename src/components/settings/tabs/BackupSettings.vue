<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.backup.title', 'System Backups')"
      :description="t('settings.backup.description', 'Create and download full system backups including database and stored files.')"
      icon="cloud-arrow-up"
    >
      <template #action>
        <button
          :disabled="creating"
          class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          @click="createBackup"
        >
          <AppIcon v-if="creating" name="spinner" class="size-4 animate-spin" />
          <AppIcon v-else name="plus" class="size-4" />
          {{ creating ? t('settings.backup.creating', 'Creating...') : t('settings.backup.create', 'Create Backup') }}
        </button>
      </template>

      <!-- Backup List -->
      <div class="overflow-hidden rounded-lg border border-(--border-color)">
        <AppTable
          :columns="columns"
          :data="backups"
          :loading="loading"
          :empty-text="t('settings.backup.empty', 'No backups found')"
          no-border
        >
          <template #cell-name="{ row: backup }">
            <div class="flex items-center gap-3 font-medium text-(--text-main)">
              <AppIcon name="document" class="size-5 text-(--text-muted) transition-colors group-hover:text-primary" />
              {{ backup.name }}
            </div>
          </template>
          <template #cell-size="{ row: backup }">
            <span class="font-mono text-xs text-(--text-secondary)">{{ formatSize(backup.size) }}</span>
          </template>
          <template #cell-date="{ row: backup }">
            <span class="text-(--text-secondary)">{{ formatDate(backup.uploadedAt) }}</span>
          </template>
          <template #cell-actions="{ row: backup }">
            <div class="flex justify-end pr-2">
              <button
                class="inline-flex items-center gap-1.5 rounded-md border border-(--border-color) bg-(--bg-card) px-3 py-1.5 text-xs font-medium text-(--text-main) shadow-sm transition-colors hover:bg-(--bg-hover) hover:text-primary"
                @click="downloadBackup(backup)"
              >
                <AppIcon name="arrow-down-tray" class="size-3.5" />
                {{ t('common.download', 'Download') }}
              </button>
            </div>
          </template>
        </AppTable>
      </div>
    </SettingsSection>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppTable from '@/components/ui/AppTable.vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/formatters';

const { t } = useI18n();
const { addToast } = useToast();

const backups = ref([]);
const loading = ref(true);
const creating = ref(false);

const columns = computed(() => [
  { key: 'name', label: t('settings.backup.filename', 'Filename') },
  { key: 'size', label: t('settings.backup.size', 'Size') },
  { key: 'date', label: t('settings.backup.date', 'Date') },
  { key: 'actions', label: t('common.actions', 'Actions'), align: 'right' },
]);

const fetchBackups = async () => {
  try {
    loading.value = true;
    const res = await fetch('/api/manage/backups');
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
    const res = await fetch('/api/manage/backups', { method: 'POST' });
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

const downloadBackup = async (backup) => {
  try {
    const res = await fetch(`/api/manage/backups/${backup.name}`);
    if (!res.ok) throw new Error(t('common.loadFailed'));

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
