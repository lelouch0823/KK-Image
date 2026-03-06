import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

// 全局缓存状态，避免每次组件挂载都重新请求
const watermarkSettings = ref({
    WATERMARK_ENABLED: 'false',
    WATERMARK_TEXT: 'KK-Image',
    WATERMARK_POSITION: 'bottom-right',
    WATERMARK_OPACITY: '0.4',
    WATERMARK_COLOR: '#ffffff',
    WATERMARK_SIZE_RATIO: '0.05' // 字体大小占图片宽度/高度的比例
});

const isLoaded = ref(false);
const isLoading = ref(false);

export function useWatermarkSettings() {
    const { authFetch } = useAuth();

    const loadSettings = async (force = false) => {
        if (isLoaded.value && !force) return watermarkSettings.value;

        if (isLoading.value) {
            // 如果正在请求中，简单地返回现有值（实际中更严谨可以返回 promise 并在 resolve 时返回）
            return watermarkSettings.value;
        }

        try {
            isLoading.value = true;
            const res = await authFetch('/api/manage/settings');
            const json = await res.json();

            if (json.success && json.data && json.data.watermark) {
                // 合并取到的设置并赋予默认值的备选
                const wm = json.data.watermark;
                watermarkSettings.value = {
                    WATERMARK_ENABLED: wm.WATERMARK_ENABLED || 'false',
                    WATERMARK_TEXT: wm.WATERMARK_TEXT || 'KK-Image',
                    WATERMARK_POSITION: wm.WATERMARK_POSITION || 'bottom-right',
                    WATERMARK_OPACITY: wm.WATERMARK_OPACITY || '0.4',
                    WATERMARK_COLOR: wm.WATERMARK_COLOR || '#ffffff',
                    WATERMARK_SIZE_RATIO: wm.WATERMARK_SIZE_RATIO || '0.05'
                };
            }
            isLoaded.value = true;
        } catch (e) {
            console.warn('Failed to load watermark settings:', e);
        } finally {
            isLoading.value = false;
        }

        return watermarkSettings.value;
    };

    const getSettingsParsed = () => {
        return {
            enabled: watermarkSettings.value.WATERMARK_ENABLED === 'true',
            text: watermarkSettings.value.WATERMARK_TEXT,
            position: watermarkSettings.value.WATERMARK_POSITION,
            opacity: parseFloat(watermarkSettings.value.WATERMARK_OPACITY),
            color: watermarkSettings.value.WATERMARK_COLOR,
            sizeRatio: parseFloat(watermarkSettings.value.WATERMARK_SIZE_RATIO),
        };
    };

    return {
        watermarkSettings,
        isLoaded,
        isLoading,
        loadSettings,
        getSettingsParsed
    };
}
