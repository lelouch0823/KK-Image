import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './styles/main.css';

// In development, force-disable any stale service worker to avoid cached assets/i18n.
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
    }).catch(() => {
        // no-op
    });
}

const app = createApp(App);

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error]', err, info, instance);
};

app.use(router);
if (import.meta.env.DEV) {
    window.__VUE_APP__ = app;
}
app.mount('#app');
