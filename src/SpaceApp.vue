<template>
  <div class="min-h-screen font-sans antialiased text-[var(--text-main)] bg-[var(--bg-page)]">
    
    <!-- 加载状态 -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
        <div class="text-center">
            <div class="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-secondary">加载中...</p>
        </div>
    </div>

    <!-- 密码验证 -->
    <SpacePassword v-else-if="requiresPassword" 
      :error="passwordError" 
      :onSubmit="submitPassword" />

    <!-- 错误状态 -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center">
            <div class="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
                <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <h2 class="text-xl font-semibold text-primary mb-2">无法加载空间</h2>
            <p class="text-secondary">{{ error }}</p>
        </div>
    </div>

    <!-- 空间内容 -->
    <template v-else-if="space">
        <!-- 根据模版渲染不同组件 -->
        <component :is="spaceComponent" :space="space" />

        <!-- Footer -->
        <footer class="py-8 text-center text-sm text-secondary border-t border-[var(--border-color)] bg-white mt-auto">
            <a href="/" class="hover:text-primary transition-colors">Powered by ImgTC</a>
        </footer>
    </template>
    
    <!-- Toast -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import { useToast } from '@/composables/useToast';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import SpacePassword from '@/components/space/SpacePassword.vue';
import { API } from '@/utils/constants';

// 懒加载不同模版组件
const SpaceMasonry = defineAsyncComponent(() => import('@/components/space/SpaceMasonry.vue'));
const SpaceProductDetail = defineAsyncComponent(() => import('@/components/space/SpaceProductDetail.vue'));
const SpaceCollection = defineAsyncComponent(() => import('@/components/space/SpaceCollection.vue'));
// Document, Portfolio 等暂复用 Masonry 或开发简易版
const SpaceDocument = defineAsyncComponent(() => import('@/components/space/SpaceMasonry.vue')); 

const { addToast } = useToast();

const loading = ref(true);
const error = ref('');
const space = ref(null);
const requiresPassword = ref(false);
const passwordError = ref('');

const spaceComponent = computed(() => {
    switch (space.value?.template) {
        case 'product': return SpaceProductDetail;
        case 'collection': return SpaceCollection;
        case 'document': return SpaceDocument;
        default: return SpaceMasonry; // Gallery & others
    }
});

// 从 URL 获取分享令牌
const getShareToken = () => {
    const path = window.location.pathname;
    const match = path.match(/\/space\/([^\/]+)/);
    return match ? match[1] : null;
};

// 加载空间
const loadSpace = async (pwd = null) => {
    const token = getShareToken();
    if (!token) {
        error.value = '无效的分享链接';
        loading.value = false;
        return;
    }

    try {
        let url = API.PUBLIC_SPACE(token);
        if (pwd) url += `?password=${encodeURIComponent(pwd)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            space.value = result.data;
            document.title = `${result.data.name} | ImgTC`;
            requiresPassword.value = false;
        } else if (result.requiresPassword) {
            requiresPassword.value = true;
        } else {
            error.value = result.message || '加载失败';
        }
    } catch (e) {
        error.value = '网络错误，请稍后重试';
    } finally {
        loading.value = false;
    }
};

const submitPassword = async (pwd) => {
    if (!pwd) return;
    passwordError.value = '';
    loading.value = true;
    await loadSpace(pwd);
    if (requiresPassword.value) {
        passwordError.value = '密码错误';
    }
};

onMounted(() => {
    loadSpace();
});
</script>
