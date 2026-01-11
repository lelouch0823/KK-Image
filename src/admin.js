import { createApp } from 'vue';
import App from './App.vue';
import './styles/main.css';

const app = createApp(App);

// 全局错误边界 (SOTA): 捕获未处理的 Vue 组件错误
app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error]', err, info, instance);
    // 可选: 集成 Sentry 或其他错误上报服务
    // 这里不使用 Toast，因为错误可能发生在 Toast 挂载之前
};

app.mount('#app');
