/// <reference types="vitest" />
import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'jsdom',
        // jsdom 27 对 opaque origin（无 URL）不再提供 localStorage/sessionStorage
        // ——显式指定 origin，恢复 Web Storage API（存量 composable 测试依赖）
        environmentOptions: {
            jsdom: {
                url: 'http://localhost/',
            },
        },
        clearMocks: true,
        restoreMocks: true,
        setupFiles: ['./test/setup/jsdom-storage-polyfill.js'],
        coverage: {
            exclude: [
                ...coverageConfigDefaults.exclude,
                'minisales/**',
                '.worktrees/**',
            ],
        },
        include: [
            'src/**/__tests__/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'functions/**/__tests__/*.{test,spec}.js',
            'scripts/**/__tests__/*.{test,spec}.{js,mjs}',
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
