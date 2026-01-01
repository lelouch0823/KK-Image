<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-primary tracking-tight">{{ t('settings.title') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('settings.subtitle') }}</p>
      </div>
    </div>

    <!-- Backup Section -->
    <div class="bg-white rounded-xl border border-[var(--border-color)] shadow-sm overflow-hidden">
      <div class="p-6 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                </svg>
              </div>
              <div>
                <h2 class="text-lg font-semibold text-primary">{{ t('settings.backup.title') }}</h2>
                <p class="text-sm text-secondary">{{ t('settings.backup.description') }}</p>
              </div>
           </div>
        </div>
        <button 
          @click="createBackup"
          :disabled="creating"
          class="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
        >
          <svg v-if="creating" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          {{ creating ? t('settings.backup.creating') : t('settings.backup.create') }}
        </button>
      </div>

      <!-- Backup List -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-secondary uppercase bg-[var(--bg-muted)] border-b border-[var(--border-color)]">
            <tr>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.filename') }}</th>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.size') }}</th>
              <th scope="col" class="px-6 py-3 font-medium">{{ t('settings.backup.date') }}</th>
              <th scope="col" class="px-6 py-3 font-medium text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-color)]">
            <tr v-if="loading" class="animate-pulse">
              <td colspan="4" class="px-6 py-4 text-center text-secondary py-8">
                {{ t('common.loading') }}
              </td>
            </tr>
            <tr v-else-if="backups.length === 0">
              <td colspan="4" class="px-6 py-8 text-center text-secondary">
                 <div class="flex flex-col items-center gap-2">
                    <svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <span>{{ t('settings.backup.empty') }}</span>
                 </div>
              </td>
            </tr>
            <tr 
              v-for="backup in backups" 
              :key="backup.key" 
              class="bg-white hover:bg-[var(--bg-hover)] transition-colors group"
            >
              <td class="px-6 py-4 font-medium text-primary">
                 <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-secondary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                    </svg>
                    {{ backup.name }}
                 </div>
              </td>
              <td class="px-6 py-4 text-secondary font-mono text-xs">
                {{ formatSize(backup.size) }}
              </td>
              <td class="px-6 py-4 text-secondary">
                {{ formatDate(backup.uploadedAt) }}
              </td>
              <td class="px-6 py-4 text-right">
                <a 
                  :href="`/api/manage/backups/${backup.name}`" 
                  download
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-white border border-[var(--border-color)] rounded-md hover:bg-[var(--bg-hover)] hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  {{ t('common.download') }}
                </a>
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
import { useFormat } from '@/composables/useFormat';

const { t } = useI18n();
const { addToast } = useToast();
const { formatFileSize, formatDateTime } = useFormat();

const backups = ref([]);
const loading = ref(true);
const creating = ref(false);

const formatSize = (bytes) => formatFileSize(bytes);
const formatDate = (date) => formatDateTime(date);

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

onMounted(() => {
  fetchBackups();
});
</script>
