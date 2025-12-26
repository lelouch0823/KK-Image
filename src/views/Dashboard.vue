<template>
  <div class="space-y-6">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5 flex items-center justify-between">
        <div>
          <div class="text-sm text-secondary mb-1">文件总数</div>
          <div class="text-3xl font-bold text-primary">{{ totalFiles }}<span class="text-sm font-normal text-secondary ml-1">/ ∞</span></div>
        </div>
        <div class="w-20 h-12 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg"></div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">今日上传</div>
        <div class="text-3xl font-bold text-primary">{{ todayUploads }}</div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">总存储</div>
        <div class="text-3xl font-bold text-primary">{{ formatSize(totalSize) }}</div>
      </div>
    </div>

    <!-- Share Management Widget -->
    <div class="bg-white rounded-xl border border-[var(--border-color)]">
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="font-semibold text-primary">已生成的分享链接 (最新10条)</h3>
        <button @click="showShareManager = true" class="text-sm text-secondary hover:text-primary transition-colors">查看更多 / 管理全部 →</button>
      </div>
      <div v-if="recentShares.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
           <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)]">
              <tr>
                <th class="px-6 py-3 font-medium">文件夹</th>
                <th class="px-6 py-3 font-medium">有效期</th>
                <th class="px-6 py-3 font-medium text-right">操作</th>
              </tr>
           </thead>
           <tbody class="divide-y divide-[var(--border-color)]">
              <tr v-for="item in recentShares" :key="item.id" class="hover:bg-gray-50 transition-colors">
                 <td class="px-6 py-3 text-primary">
                     <div class="flex flex-col">
                         <span class="font-medium">{{ item.name }}</span>
                         <span class="text-xs text-secondary font-mono mt-1 select-all cursor-pointer" @click="copyShareLink(item)" title="点击复制">{{ item.shareToken }}</span>
                     </div>
                 </td>
                 <td class="px-6 py-3 text-secondary">{{ formatExpiry(item.expiresAt) }}</td>
                 <td class="px-6 py-3 text-right">
                     <div class="flex items-center justify-end gap-2">
                         <button @click="copyShareLink(item)" class="text-xs bg-gray-100 hover:bg-gray-200 text-secondary px-2 py-1 rounded">复制</button>
                         <button @click="editShare(item)" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded">更改</button>
                         <button @click="revokeShare(item)" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded">删除</button>
                     </div>
                 </td>
              </tr>
           </tbody>
        </table>
      </div>
      <div v-else class="p-6 text-center text-secondary text-sm">
        暂无活动分享
      </div>
      <div class="p-3 border-t border-[var(--border-color)] text-center">
          <button @click="showShareManager = true" class="text-sm text-primary hover:underline">查看更多</button>
      </div>
    </div>

    <!-- 最近文件 -->
    <div class="bg-white rounded-xl border border-[var(--border-color)]">
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="font-semibold text-primary">最近文件</h3>
        <button @click="setView('files')" class="text-sm text-secondary hover:text-primary transition-colors">查看全部 →</button>
      </div>
      <div v-if="recentFiles.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
           <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)]">
              <tr>
                <th class="px-6 py-3 font-medium">名称</th>
                <th class="px-6 py-3 font-medium">大小</th>
                <th class="px-6 py-3 font-medium">上传时间</th>
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
        暂无最近文件
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
import ShareManagementModal from '@/components/ShareManagementModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';

const { setView } = useView();
const { error, success } = useToast();

const totalFiles = ref(0);
const todayUploads = ref(0);
const totalSize = ref(0);
const recentFiles = ref([]);
const recentShares = ref([]);

const showShareManager = ref(false);
const showEditShare = ref(false);
const editingFolder = ref(null);

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // 兼容可能的时间戳格式
    const date = new Date(Number(timestamp));
    return date.toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatExpiry = (ts) => {
    if (!ts) return '永久有效';
    const date = new Date(Number(ts));
    const now = Date.now();
    const days = Math.ceil((ts - now) / (1000 * 60 * 60 * 24));
    
    if (ts < now) return '已过期';
    return `${days}天后 (${date.toLocaleDateString()})`;
};

const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toUpperCase();
};

const fetchStats = async () => {
    try {
        const res = await fetch('/api/manage/stats', {
            headers: { 'Authorization': 'Basic ' + btoa('admin:123456') }
        }).then(r => r.json());

        if (res.overview) {
            totalFiles.value = res.overview.totalFiles;
            todayUploads.value = res.overview.todayUploads;
            totalSize.value = res.overview.totalSize;
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
        const res = await fetch('/api/manage/shares?limit=10', {
            headers: { 'Authorization': 'Basic ' + btoa('admin:123456') }
        }).then(r => r.json());

        if (res.success) {
            recentShares.value = res.data.items;
        }
    } catch (e) {
        console.error('Shares load failed', e);
    }
};

const copyShareLink = (item) => {
    const url = `${window.location.origin}${item.shareUrl}`;
    navigator.clipboard.writeText(url).then(() => success('链接已复制'));
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
    if (!confirm(`确定要取消分享 "${item.name}" 吗？`)) return;
    try {
        const res = await fetch(`/api/manage/folders/${item.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa('admin:123456')
            },
            body: JSON.stringify({ isPublic: false, shareToken: null })
        }).then(r => r.json());

        if (res.success) {
            success('已取消分享');
            fetchRecentShares();
        } else {
            error(res.message);
        }
    } catch (e) {
        error('操作失败');
    }
};

onMounted(() => {
    fetchStats();
    fetchRecentShares();
});
</script>
