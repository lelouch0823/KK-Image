<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="text-lg font-semibold text-primary">分享链接管理</h3>
        <button @click="close" class="text-secondary hover:text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-auto p-6">
         <table class="w-full text-left text-sm">
           <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)] sticky top-0">
              <tr>
                <th class="px-6 py-3 font-medium">文件夹名称</th>
                <th class="px-6 py-3 font-medium">链接 / Token</th>
                <th class="px-6 py-3 font-medium">有效期</th>
                <th class="px-6 py-3 font-medium text-right">操作</th>
              </tr>
           </thead>
           <tbody class="divide-y divide-[var(--border-color)]">
              <tr v-for="item in shares" :key="item.id" class="hover:bg-gray-50 transition-colors">
                 <td class="px-6 py-3 text-primary font-medium">{{ item.name }}</td>
                 <td class="px-6 py-3 text-secondary">
                     <div class="flex items-center gap-2">
                         <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded select-all">{{ item.shareToken }}</span>
                         <button @click="copyLink(item)" class="text-primary hover:text-blue-600" title="复制链接">
                             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                         </button>
                     </div>
                 </td>
                 <td class="px-6 py-3">
                     <span :class="getExpiryClass(item.expiresAt)">{{ formatExpiry(item.expiresAt) }}</span>
                 </td>
                 <td class="px-6 py-3 text-right">
                     <button @click="editShare(item)" class="text-primary hover:text-blue-600 mr-3">编辑</button>
                     <button @click="revokeShare(item)" class="text-red-500 hover:text-red-700">取消分享</button>
                 </td>
              </tr>
           </tbody>
         </table>

         <!-- Empty State -->
         <div v-if="shares.length === 0 && !loading" class="text-center py-12 text-secondary">
             暂无分享链接
         </div>

         <!-- Loading -->
         <div v-if="loading" class="text-center py-12 text-secondary">
             加载中...
         </div>
      </div>

      <!-- Footer / Pagination -->
      <div class="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between bg-gray-50 rounded-b-xl">
         <span class="text-sm text-secondary">共 {{ total }} 条</span>
         <div class="flex gap-2">
             <button @click="page--" :disabled="page <= 1" class="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50">上一页</button>
             <span class="flex items-center px-2 text-sm text-secondary">{{ page }} / {{ totalPages }}</span>
             <button @click="page++" :disabled="page >= totalPages" class="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50">下一页</button>
         </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { formatExpiry } from '@/utils/formatters';
import { API } from '@/utils/constants';

const props = defineProps({
  modelValue: Boolean
});

const emit = defineEmits(['update:modelValue', 'edit']);

const { success, error } = useToast();
const { getHeaders, authFetchJson } = useAuth();

const loading = ref(false);
const shares = ref([]);
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);

const fetchShares = async () => {
    loading.value = true;
    try {
        const res = await authFetchJson(`${API.SHARES}?page=${page.value}&limit=20`);

        if (res.success) {
            shares.value = res.data.items;
            total.value = res.data.total;
            totalPages.value = res.data.totalPages;
        }
    } catch (e) {
        error('加载失败');
    } finally {
        loading.value = false;
    }
};

// 格式化过期时间类名
const getExpiryClass = (ts) => {
    if (!ts) return 'text-green-600';
    if (ts < Date.now()) return 'text-red-500 font-medium';
    if (ts - Date.now() < 24 * 60 * 60 * 1000 * 3) return 'text-orange-500'; // < 3 days
    return 'text-secondary';
};

const copyLink = (item) => {
    const url = `${window.location.origin}${item.shareUrl}`;
    navigator.clipboard.writeText(url).then(() => success('链接已复制'));
};

const revokeShare = async (item) => {
    if (!confirm(`确定要取消分享 "${item.name}" 吗？取消后链接将失效。`)) return;
    
    try {
        const res = await fetch(API.FOLDER_BY_ID(item.id), {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify({ isPublic: false, shareToken: null })
        }).then(r => r.json());

        if (res.success) {
            success('已取消分享');
            fetchShares();
        } else {
            error(res.message);
        }
    } catch (e) {
        error('操作失败');
    }
};

const editShare = (item) => {
    // We can emit event to open parent's ShareFolderModal
    // But we need the full folder object. 
    // Ideally we pass the ID to parent to fetch and open.
    emit('edit', item);
};

const close = () => {
    emit('update:modelValue', false);
};

watch(() => props.modelValue, (val) => {
    if (val) {
        page.value = 1;
        fetchShares();
    }
});

watch(page, fetchShares);

</script>
