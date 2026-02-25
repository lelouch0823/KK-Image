/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: [
            'src/**/__tests__/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'functions/**/__tests__/*.{test,spec}.js',
            'test/*.test.js'
        ],
        exclude: [
            'test/api.test.js',
            'test/manage-api.test.js',
            'test/manage-goods-overview.test.js',
            'test/streaming.test.js',
            'test/v1-files-folders.test.js',
            'test/v1-users-webhooks.test.js'
        ],
        root: fileURLToPath(new URL('./', import.meta.url)),
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
