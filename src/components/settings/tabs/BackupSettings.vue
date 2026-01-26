<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.backup.title', 'System Backups')"
      :description="t('settings.backup.description', 'Create and download full system backups including database and stored files.')"
      :icon="CloudArrowUpIcon"
    >
      <template #action>
        <button
          :disabled="creating"
          class="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          @click="createBackup"
        >
          <!-- Spinner -->
          <svg v-if="creating" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <!-- Plus Icon -->
          <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
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
                  <!-- Archive Box X Mark Icon -->
                  <svg class="size-10 text-[var(--text-muted)] opacity-50" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
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
                  <!-- Document Icon -->
                  <svg class="size-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
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
                  <!-- Arrow Down Tray Icon -->
                  <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
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
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/formatters';

const { t } = useI18n();
const { addToast } = useToast();

// 内联 SVG 图标组件
const CloudArrowUpIcon = {
  template: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>`
};

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
