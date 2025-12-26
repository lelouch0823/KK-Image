import { ref } from 'vue';

const currentView = ref('dashboard');
const viewTitle = ref('概览');

export function useView() {
    const setView = (view, title) => {
        currentView.value = view;
        if (title) {
            viewTitle.value = title;
        } else {
            // 默认标题映射
            const titleMap = {
                'dashboard': '概览',
                'files': '文件管理',
                'stats': '统计'
            };
            viewTitle.value = titleMap[view] || '管理后台';
        }
    };

    return {
        currentView,
        viewTitle,
        setView
    };
}
