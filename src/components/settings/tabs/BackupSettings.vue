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
          class="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          @click="createBackup"
        >
          <AppIcon v-if="creating" name="spinner" class="size-4 animate-spin" />
          <AppIcon v-else name="plus" class="size-4" />
          {{ creating ? t('settings.backup.creating', 'Creating...') : t('settings.backup.create', 'Create Backup') }}
        </button>
      </template>

      <!-- Backup List -->
      <div class="overflow-hidden rounded-lg border border-[var(--border-color)]">
        <table class="w-full text-left text-sm">
          <thead class="bg-[var(--bg-muted)] text-xs text-[var(--text-secondary)] uppercase">
            <tr>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.filename', 'Filename') }}</th>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.size', 'Size') }}</th>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.date', 'Date') }}</th>
              <th scope="col" class="px-6 py-3 text-right font-medium">{{ t('common.actions', 'Actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-color)] bg-[var(--bg-card)]">
            <tr v-if="loading" class="animate-pulse">
              <td colspan="4" class="text-secondary px-6 py-8 text-center">
                {{ t('common.loading', 'Loading backups...') }}
              </td>
            </tr>
            <tr v-else-if="backups.length === 0">
              <td colspan="4" class="text-secondary px-6 py-12 text-center">
                <div class="flex flex-col items-center gap-3">
                  <AppIcon name="archive-box-x-mark" class="size-10 text-[var(--text-muted)] opacity-50" />
                  <span>{{ t('settings.backup.empty', 'No backups found') }}</span>
                </div>
              </td>
            </tr>
            <tr
              v-for="backup in backups"
              :key="backup.key"
              class="group transition-colors hover:bg-[var(--bg-hover)]"
            >
              <td class="text-primary px-6 py-4 font-medium">
                <div class="flex items-center gap-3">
                  <AppIcon name="document" class="size-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-primary)]" />
                  {{ backup.name }}
                </div>
              </td>
              <td class="text-secondary px-6 py-4 font-mono text-xs">
                {{ formatSize(backup.size) }}
              </td>
              <td class="text-secondary px-6 py-4">
                {{ formatDate(backup.uploadedAt) }}
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  class="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] shadow-sm transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)]"
                  @click="downloadBackup(backup)"
                >
                  <AppIcon name="arrow-down-tray" class="size-3.5" />
                  {{ t('common.download', 'Download') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SettingsSection>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/formatters';

const { t } = useI18n();
const { addToast } = useToast();

const backups = ref([]);
const loading = ref(true);
const creating = ref(false);

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
