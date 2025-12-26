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

    <!-- 最近文件 (Mock) -->
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useView } from '@/composables/useView';
import { useToast } from '@/composables/useToast';

const { setView } = useView();
const { error } = useToast();

const totalFiles = ref(0);
const todayUploads = ref(0);
const totalSize = ref(0);

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const recentFiles = ref([]);

const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // 兼容可能的时间戳格式
    const date = new Date(Number(timestamp));
    return date.toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
};

const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toUpperCase();
};

onMounted(async () => {
    try {
        const res = await fetch('/api/manage/stats', {
            headers: {
                'Authorization': 'Basic ' + btoa('admin:123456')
            }
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
        // error('加载统计失败');
        console.error('Stats load failed', e);
    }
});
</script>
