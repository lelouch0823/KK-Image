import { ref } from 'vue';
import { useI18n } from './useI18n';

const currentView = ref('dashboard');
const viewTitle = ref('');

export function useView() {
    const { t } = useI18n();

    // 初始化默认标题
    if (!viewTitle.value) {
        viewTitle.value = t('views.dashboard');
    }

    const setView = (view, title) => {
        currentView.value = view;
        if (title) {
            viewTitle.value = title;
        } else {
            // 默认标题映射
            const titleMap = {
                'dashboard': t('views.dashboard'),
                'files': t('views.files'),
                'stats': t('views.stats'),
                'customers': t('views.customers')
            };
            viewTitle.value = titleMap[view] || t('views.admin');
        }
    };

    return {
        currentView,
        viewTitle,
        setView
    };
}
