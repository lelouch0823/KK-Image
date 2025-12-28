<template>
  <div class="space-y-6">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5 flex items-center justify-between">
        <div>
          <div class="text-sm text-secondary mb-1">{{ t('dashboard.totalFiles') }}</div>
          <div class="text-3xl font-bold text-primary">{{ totalFiles }}<span class="text-sm font-normal text-secondary ml-1">/ ∞</span></div>
        </div>
        <div class="w-20 h-12 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg"></div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">{{ t('dashboard.todayUploads') }}</div>
        <div class="text-3xl font-bold text-primary">{{ todayUploads }}</div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">{{ t('dashboard.totalStorage') }}</div>
        <div class="text-3xl font-bold text-primary">{{ formatSize(totalSize) }}</div>
      </div>
    </div>

    <!-- Share Management Widget -->
    <div class="bg-white rounded-xl border border-[var(--border-color)]">
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="font-semibold text-primary">{{ t('dashboard.recentShares') }}</h3>
        <button @click="showShareManager = true" class="text-sm text-secondary hover:text-primary transition-colors">{{ t('dashboard.viewMore') }}</button>
      </div>
      <div v-if="recentShares.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
           <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)]">
              <tr>
                <th class="px-6 py-3 font-medium">{{ t('dashboard.folder') }}</th>
                <th class="px-6 py-3 font-medium">{{ t('dashboard.expiry') }}</th>
                <th class="px-6 py-3 font-medium text-right">{{ t('dashboard.actions') }}</th>
              </tr>
           </thead>
           <tbody class="divide-y divide-[var(--border-color)]">
              <tr v-for="item in recentShares" :key="item.id" class="hover:bg-gray-50 transition-colors">
                 <td class="px-6 py-3 text-primary">
                     <div class="flex flex-col">
                         <span class="font-medium">{{ item.name }}</span>
                         <span class="text-xs text-secondary font-mono mt-1 select-all cursor-pointer" @click="copyShareLink(item)" :title="t('dashboard.clickToCopy')">{{ item.shareToken }}</span>
                     </div>
                 </td>
                 <td class="px-6 py-3 text-secondary">{{ formatExpiry(item.expiresAt, t) }}</td>
                 <td class="px-6 py-3 text-right">
                     <div class="flex items-center justify-end gap-2">
                         <button @click="copyShareLink(item)" class="text-xs bg-gray-100 hover:bg-gray-200 text-secondary px-2 py-1 rounded">{{ t('dashboard.copy') }}</button>
                         <button @click="editShare(item)" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded">{{ t('dashboard.edit') }}</button>
                         <button @click="revokeShare(item)" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded">{{ t('dashboard.revoke') }}</button>
                     </div>
                 </td>
              </tr>
           </tbody>
        </table>
      </div>
      <div v-else class="p-6 text-center text-secondary text-sm">
        {{ t('dashboard.noActiveShares') }}
      </div>
      <div class="p-3 border-t border-[var(--border-color)] text-center">
          <button @click="showShareManager = true" class="text-sm text-primary hover:underline">{{ t('dashboard.viewMore') }}</button>
      </div>
    </div>

    <!-- 最近文件 -->
    <div class="bg-white rounded-xl border border-[var(--border-color)]">
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="font-semibold text-primary">{{ t('dashboard.recentFiles') }}</h3>
        <button @click="setView('files')" class="text-sm text-secondary hover:text-primary transition-colors">{{ t('dashboard.viewAll') }}</button>
      </div>
      <div v-if="recentFiles.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
           <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)]">
              <tr>
                <th class="px-6 py-3 font-medium">{{ t('dashboard.name') }}</th>
                <th class="px-6 py-3 font-medium">{{ t('dashboard.size') }}</th>
                <th class="px-6 py-3 font-medium">{{ t('dashboard.uploadTime') }}</th>
              </tr>
           </thead>
           <tbody class="divide-y divide-[var(--border-color)]">
              <tr v-for="(file, index) in recentFiles" :key="index" class="hover:bg-gray-50 transition-colors">
                 <td class="px-6 py-3 text-primary">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs text-secondary uppercase border border-[var(--border-color)]">
                            {{ file.type || getFileExtension(file.name) }}
                        </div>
                        <span class="truncate max-w-[200px]" :title="file.name">{{ file.name }}</span>
                    </div>
                 </td>
                 <td class="px-6 py-3 text-secondary">{{ formatSize(file.size) }}</td>
                 <td class="px-6 py-3 text-secondary">{{ formatDate(file.timestamp) }}</td>
              </tr>
           </tbody>
        </table>
      </div>
      <div v-else class="p-6 text-center text-secondary text-sm">
        {{ t('dashboard.noRecentFiles') }}
      </div>
    </div>

    <!-- Modals -->
    <ShareManagementModal 
        v-model="showShareManager" 
        @edit="handleManagerEdit"
    />
    <ShareFolderModal
        v-model="showEditShare"
        :folder="editingFolder"
        @updated="handleEditUpdated"
    />

  </div>
</template>


<script setup>
import { ref, onMounted } from 'vue';
import { useView } from '@/composables/useView';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import ShareManagementModal from '@/components/ShareManagementModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import { formatSize, formatDate, formatExpiry, getFileExtension } from '@/utils/formatters';
import { API } from '@/utils/constants';

const { setView } = useView();
const { error, success } = useToast();
const { getHeaders, authFetchJson } = useAuth();
const { t } = useI18n();

const totalFiles = ref(0);
const todayUploads = ref(0);
const totalSize = ref(0);
const recentFiles = ref([]);
const recentShares = ref([]);

const showShareManager = ref(false);
const showEditShare = ref(false);
const editingFolder = ref(null);

const fetchStats = async () => {
    try {
        const res = await authFetchJson(API.STATS);

        if (res.success && res.data) {
            totalFiles.value = res.data.files?.total || 0;
            todayUploads.value = res.data.files?.todayUploads || 0;
            totalSize.value = res.data.files?.totalSize || 0;
        }
        
        if (res.recent) {
            recentFiles.value = res.recent;
        }
    } catch (e) {
        console.error('Stats load failed', e);
    }
};

const fetchRecentShares = async () => {
    try {
        const res = await authFetchJson(`${API.SHARES}?limit=10`);

        if (res.success) {
            recentShares.value = res.data.items;
        }
    } catch (e) {
        console.error('Shares load failed', e);
    }
};

const copyShareLink = (item) => {
    const url = `${window.location.origin}${item.shareUrl}`;
    navigator.clipboard.writeText(url).then(() => success(t('dashboard.linkCopied')));
};

const editShare = (item) => {
    editingFolder.value = item;
    showEditShare.value = true;
};

const handleEditUpdated = () => {
    fetchRecentShares();
    // Maybe also refresh manager if open? Manager does its own fetch on open.
};

const handleManagerEdit = (item) => {
    // Called from View More Modal
    editingFolder.value = item;
    showEditShare.value = true;
};

const revokeShare = async (item) => {
    if (!confirm(t('dashboard.confirmRevoke', { name: item.name }))) return;
    try {
        const res = await fetch(API.FOLDER_BY_ID(item.id), {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify({ isPublic: false, shareToken: null })
        }).then(r => r.json());

        if (res.success) {
            success(t('dashboard.shareRevoked'));
            fetchRecentShares();
        } else {
            error(res.message);
        }
    } catch (e) {
        error(t('dashboard.operationFailed'));
    }
};

onMounted(() => {
    fetchStats();
    fetchRecentShares();
});
</script>
