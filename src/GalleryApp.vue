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
    <div v-else-if="requiresPassword" class="min-h-screen flex items-center justify-center px-4">
        <div class="w-full max-w-sm">
            <div class="bg-white rounded-2xl border border-[var(--border-color)] shadow-lg p-8">
                <div class="text-center mb-6">
                    <div class="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg class="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <h2 class="text-xl font-semibold text-primary">需要密码</h2>
                    <p class="text-sm text-secondary mt-1">该相册受密码保护</p>
                </div>
                <form @submit.prevent="submitPassword">
                    <input v-model="password" type="password" placeholder="请输入密码"
                        class="w-full h-12 px-4 text-sm border border-[var(--border-color)] rounded-xl bg-[var(--bg-muted)] focus:bg-white focus:border-primary focus:outline-none mb-4 transition-colors">
                    <button type="submit"
                        class="w-full h-12 bg-primary text-white font-medium rounded-xl hover:bg-gray-800 transition-colors">
                        确认
                    </button>
                </form>
                <p v-if="passwordError" class="text-red-500 text-sm text-center mt-4">{{ passwordError }}</p>
            </div>
        </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center">
            <div class="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
                <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <h2 class="text-xl font-semibold text-primary mb-2">无法加载相册</h2>
            <p class="text-secondary">{{ error }}</p>
        </div>
    </div>

    <!-- 相册内容 -->
    <template v-else-if="album">
        <!-- Header -->
        <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[var(--border-color)]">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                <div>
                    <h1 class="text-xl font-semibold text-primary px-1">{{ album.name }}</h1>
                    <p class="text-sm text-secondary mt-0.5 px-1">{{ album.fileCount }} 个文件</p>
                </div>
                <div class="flex items-center gap-3">
                    <button @click="shareAlbum"
                        class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                        </svg>
                        分享
                    </button>
                </div>
            </div>
        </header>

        <!-- Description -->
        <div v-if="album.description" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p class="text-secondary text-sm bg-gray-50 p-4 rounded-xl border border-[var(--border-color)]">{{ album.description }}</p>
        </div>

        <!-- File Grid -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <div v-for="(file, index) in album.files" :key="file.id" @click="openFile(file, index)"
                    class="aspect-square rounded-xl overflow-hidden cursor-pointer group relative bg-gray-100 border border-[var(--border-color)] hover:border-gray-300 transition-colors shadow-sm hover:shadow-md">
                    <!-- 图片 -->
                    <img v-if="file.type === 'image'" :src="file.thumbnailUrl || file.url" :alt="file.name"
                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy" 
                        @error="handleImgError">

                    <!-- PDF -->
                    <div v-else-if="file.type === 'pdf'"
                        class="w-full h-full flex flex-col items-center justify-center text-secondary bg-gray-50">
                        <svg class="w-12 h-12 mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <span class="text-xs font-medium bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">PDF</span>
                    </div>

                    <!-- 其他文件 -->
                    <div v-else class="w-full h-full flex flex-col items-center justify-center text-secondary bg-gray-50">
                        <svg class="w-12 h-12 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                        </svg>
                        <span class="text-xs font-medium uppercase bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">{{ file.name.split('.').pop() }}</span>
                    </div>

                    <!-- Hover Overlay -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span class="text-white text-xs font-medium truncate w-full">{{ file.name }}</span>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-if="album.files.length === 0" class="py-20 text-center">
                <div class="w-20 h-20 mx-auto mb-6 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
                    <svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-primary">暂无文件</h3>
                <p class="text-secondary text-sm mt-1">该相册还没有添加任何文件</p>
            </div>
        </main>

        <!-- Footer -->
        <footer class="py-8 text-center text-sm text-secondary border-t border-[var(--border-color)] bg-white">
            <a href="/" class="hover:text-primary transition-colors">Powered by ImgTC</a>
        </footer>
    </template>

    <!-- ========== Lightbox ========== -->
    <div v-if="lightbox.visible" 
        class="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm transition-opacity" 
        @click.self="closeLightbox"
        @wheel.prevent="handleWheel">
        
        <!-- Toolbar -->
        <div class="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/50 to-transparent">
             <div class="text-white/90 text-sm font-medium px-2">
                {{ lightbox.index + 1 }} / {{ album.files.length }}
             </div>
             
             <div class="flex items-center gap-4">
                 <!-- Download Button -->
                 <a v-if="lightbox.file" :href="lightbox.file.url" download
                    class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm font-medium backdrop-blur-md">
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                     </svg>
                     下载
                 </a>
                 
                 <!-- Close Button -->
                 <button @click="closeLightbox"
                    class="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                 </button>
             </div>
        </div>

        <!-- Navigation Buttons -->
        <button v-if="lightbox.index > 0" @click="prevFile"
            class="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
        </button>
        <button v-if="lightbox.index < album.files.length - 1" @click="nextFile"
            class="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
        </button>

        <!-- Content -->
        <div class="absolute inset-0 flex items-center justify-center p-4 sm:p-8 md:p-12 pb-20 pt-20" @click.self="closeLightbox">
            <!-- Image -->
            <img v-if="lightbox.file?.type === 'image'" :src="lightbox.file.url" :alt="lightbox.file.name"
                class="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in duration-300">

            <!-- PDF Viewer -->
            <div v-else-if="lightbox.file?.type === 'pdf'"
                class="w-full h-full max-w-5xl bg-white rounded-lg overflow-hidden flex flex-col shadow-2xl">
                <iframe :src="lightbox.file.url" class="flex-1 w-full border-none"></iframe>
            </div>

            <!-- Other Files -->
            <div v-else class="text-center text-white">
                <div class="w-24 h-24 mx-auto mb-6 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                </div>
                <!-- Reuse Toolbar Download is better -->
                <h3 class="text-lg font-medium mb-4">{{ lightbox.file?.name }}</h3>
                <p class="text-white/60 mb-6 text-sm">此文件不支持预览</p>
            </div>
        </div>

        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
             支持滚轮切换 • ESC 关闭
        </div>
    </div>
    
    <!-- Toast -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import ToastContainer from '@/components/ui/ToastContainer.vue';

const { addToast } = useToast();

const loading = ref(true);
const error = ref('');
const album = ref(null);
const requiresPassword = ref(false);
const password = ref('');
const passwordError = ref('');
const lightbox = ref({ visible: false, file: null, index: 0 });

// 从 URL 获取分享令牌
const getShareToken = () => {
    const path = window.location.pathname;
    const match = path.match(/\/gallery\/([^\/]+)/);
    return match ? match[1] : null;
};

// 加载相册
const loadAlbum = async (pwd = null) => {
    const token = getShareToken();
    if (!token) {
        error.value = '无效的分享链接';
        loading.value = false;
        return;
    }

    try {
        let url = `/api/gallery/${token}`;
        if (pwd) url += `?password=${encodeURIComponent(pwd)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            
            // Normalize files
            const files = result.data.files.map(f => {
                const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(f.name.split('.').pop().toLowerCase());
                const isPdf = f.name.toLowerCase().endsWith('.pdf');
                return {
                    ...f,
                    type: isImg ? 'image' : (isPdf ? 'pdf' : 'other'),
                    thumbnailUrl: f.url // If you had thumbnails, use them here. Using full url for now.
                };
            });
            
            album.value = { ...result.data, files };
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

const submitPassword = async () => {
    if (!password.value) {
        passwordError.value = '请输入密码';
        return;
    }
    passwordError.value = '';
    loading.value = true;
    await loadAlbum(password.value);
    if (requiresPassword.value) {
        passwordError.value = '密码错误';
    }
};

const openFile = (file, index) => {
    lightbox.value = { visible: true, file, index };
    document.body.style.overflow = 'hidden';
};

const closeLightbox = () => {
    lightbox.value.visible = false;
    document.body.style.overflow = '';
};

const prevFile = () => {
    if (lightbox.value.index > 0) {
        lightbox.value.index--;
        lightbox.value.file = album.value.files[lightbox.value.index];
    }
};

const nextFile = () => {
    if (lightbox.value.index < album.value.files.length - 1) {
        lightbox.value.index++;
        lightbox.value.file = album.value.files[lightbox.value.index];
    }
};

const handleWheel = (e) => {
    if (e.deltaY > 0) nextFile();
    else if (e.deltaY < 0) prevFile();
};

const handleKeydown = (e) => {
    if (!lightbox.value.visible) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevFile();
    if (e.key === 'ArrowRight') nextFile();
};

const shareAlbum = async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        addToast({ message: '链接已复制', type: 'success' });
    } catch {
        addToast({ message: '复制失败', type: 'error' });
    }
};

const handleImgError = (e) => {
    e.target.src = 'data:image/svg+xml;base64,...'; // Placeholder if needed
};

onMounted(() => {
    loadAlbum();
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>
