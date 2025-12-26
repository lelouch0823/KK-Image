<template>
  <div class="h-full w-full bg-white rounded-xl border border-[var(--border-color)] overflow-hidden">
    <!-- 临时使用 iframe 嵌入旧的统计页面，后续可重构成 Vue 组件 -->
    <iframe src="/admin-stats.html" class="w-full h-full border-none" title="统计"></iframe>
  </div>
</template>
