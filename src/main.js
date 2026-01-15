import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './styles/main.css';

const app = createApp(App);

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue Error]', err, info, instance);
};

app.use(router);
app.mount('#app');
