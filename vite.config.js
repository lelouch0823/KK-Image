import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    // 自定义插件：将 src/pages 下的 HTML 输出到根目录
    {
      name: 'flatten-html',
      enforce: 'post',
      generateBundle(options, bundle) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (fileName.endsWith('.html') && fileName.includes('src/pages/')) {
            const newName = fileName.split('/').pop();
            chunk.fileName = newName;
            delete bundle[fileName];
            bundle[newName] = chunk;
          }
        }
      }
    }
  ],

  // 构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'admin': resolve(__dirname, 'src/pages/admin.html'),
        'login': resolve(__dirname, 'src/pages/login.html'),
        'upload': resolve(__dirname, 'src/pages/upload.html'),
        'admin-stats': resolve(__dirname, 'src/pages/admin-stats.html')
      },
      output: {
        // 代码分割配置
        manualChunks: {
          'vue-vendor': ['vue'],
          'element-plus': ['element-plus', '@element-plus/icons-vue']
        },
        // 静态资源文件名
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name)) {
            return `media/[name]-[hash].${ext}`;
          }
          if (/\.(png|jpe?g|gif|svg)(\?.*)?$/i.test(assetInfo.name)) {
            return `images/[name]-[hash].${ext}`;
          }
          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
            return `fonts/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    // 启用 gzip 压缩
    reportCompressedSize: true,
    // 代码分割阈值
    chunkSizeWarningLimit: 1000,
    // 静态资源内联阈值
    assetsInlineLimit: 4096
  },

  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
    cors: true,
    // 代理配置：将 API 请求转发到 Wrangler Pages 服务
    proxy: {
      '/upload': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      },
      '/file': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      }
    }
  },

  // 预览服务器配置
  preview: {
    port: 4173,
    open: true
  },

  // 路径解析
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~': resolve(__dirname)
    }
  },

  // CSS 配置
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  }
});
