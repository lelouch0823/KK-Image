<template>
  <aside class="w-[var(--sidebar-width)] bg-white border-r border-[var(--border-color)] flex flex-col shrink-0">
    <!-- Logo -->
    <div class="h-[var(--header-height)] flex items-center px-5 border-b border-[var(--border-color)]">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-white font-bold text-sm mr-3">
        TC
      </div>
      <span class="text-lg font-bold text-primary tracking-tight">ImgTC</span>
    </div>

    <!-- 菜单 -->
    <nav class="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
      <div class="mb-6">
        <div class="px-3 mb-2 text-xs font-semibold text-secondary uppercase tracking-wider">菜单</div>
        <button v-for="item in menuItems" :key="item.key" @click="setView(item.key)"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1"
          :class="currentView === item.key ? 'bg-[var(--bg-active)] text-primary' : 'text-secondary hover:bg-[var(--bg-hover)] hover:text-primary'">
          <span v-html="item.icon" class="w-5 h-5"></span>
          {{ item.label }}
        </button>
      </div>

      <div>
        <div class="px-3 mb-2 text-xs font-semibold text-secondary uppercase tracking-wider">管理</div>
        <button @click="handleLogout"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-red-50 hover:text-danger transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          退出登录
        </button>
      </div>
    </nav>

    <!-- 用户信息 -->
    <div class="p-4 border-t border-[var(--border-color)]">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
          A</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-primary truncate">Admin</div>
          <div class="text-xs text-secondary">管理员</div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useView } from '@/composables/useView';

const { currentView, setView } = useView();

const menuItems = [
  { key: 'dashboard', label: '概览', icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>' },
  { key: 'files', label: '文件管理', icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>' },
  { key: 'stats', label: '统计', icon: '<svg fill="none" class="w-5 h-5" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>' }
];

const handleLogout = () => {
  // Basic Auth 无法通过 JS 彻底登出，通常需要关闭浏览器
  // 此处仅重定向到首页作为视觉反馈
  window.location.href = '/';
  // 可选：弹窗提示用户关闭浏览器以确保安全
};
</script>
