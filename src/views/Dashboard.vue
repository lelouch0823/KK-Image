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
      <div class="p-6 text-center text-secondary text-sm">
        (数据加载功能开发中)
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

onMounted(async () => {
  // TODO: 从 API 获取 dashboard 数据
  // const res = await fetch('/api/stats/dashboard')...
  // Mock data
  totalFiles.value = 128;
  todayUploads.value = 12;
  totalSize.value = 1024 * 1024 * 450;
});
</script>
