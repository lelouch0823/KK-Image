<template>
  <div class="mx-auto max-w-7xl space-y-6 p-6">
    <!-- Header -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-primary text-2xl font-bold tracking-tight">{{ t('settings.title') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('settings.subtitle') }}</p>
      </div>
    </div>

    <!-- Backup Section -->
    <div class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-white shadow-sm">
      <div
        class="flex flex-col justify-between gap-4 border-b border-[var(--border-color)] p-6 sm:flex-row sm:items-center"
      >
        <div>
          <div class="flex items-center gap-3">
            <div
              class="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                ></path>
              </svg>
            </div>
            <div>
              <h2 class="text-primary text-lg font-semibold">{{ t('settings.backup.title') }}</h2>
              <p class="text-secondary text-sm">{{ t('settings.backup.description') }}</p>
            </div>
          </div>
        </div>
        <button
          :disabled="creating"
          class="bg-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          @click="createBackup"
        >
          <svg
            v-if="creating"
            class="size-4 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          <svg v-else class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            ></path>
          </svg>
          {{ creating ? t('settings.backup.creating') : t('settings.backup.create') }}
        </button>
      </div>

      <!-- Backup List -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead
            class="text-secondary border-b border-[var(--border-color)] bg-[var(--bg-muted)] text-xs uppercase"
          >
            <tr>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.filename') }}</th>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.size') }}</th>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.date') }}</th>
              <th scope="col" class="px-6 py-3 text-right font-medium">
                {{ t('common.actions') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-color)]">
            <tr v-if="loading" class="animate-pulse">
              <td colspan="4" class="text-secondary px-6 py-4 py-8 text-center">
                {{ t('common.loading') }}
              </td>
            </tr>
            <tr v-else-if="backups.length === 0">
              <td colspan="4" class="text-secondary px-6 py-8 text-center">
                <div class="flex flex-col items-center gap-2">
                  <svg
                    class="size-10 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    ></path>
                  </svg>
                  <span>{{ t('settings.backup.empty') }}</span>
                </div>
              </td>
            </tr>
            <tr
              v-for="backup in backups"
              :key="backup.key"
              class="group bg-white transition-colors hover:bg-[var(--bg-hover)]"
            >
              <td class="text-primary px-6 py-4 font-medium">
                <div class="flex items-center gap-2">
                  <svg
                    class="text-secondary size-4 transition-colors group-hover:text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                    ></path>
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
                  class="text-primary inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:border-blue-200 hover:bg-[var(--bg-hover)] hover:text-blue-600"
                  @click="downloadBackup(backup)"
                >
                  <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    ></path>
                  </svg>
                  {{ t('common.download') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatSize, formatDate } from '@/utils/formatters';

const { t } = useI18n();
const { addToast } = useToast();

const backups = ref([]);
const loading = ref(true);
const creating = ref(false);

// 直接使用 formatters.js 的函数，无需额外封装

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
