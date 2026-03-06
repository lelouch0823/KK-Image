<template>
  <div class="flex min-h-[60vh] items-center justify-center px-4 py-8">
    <PermissionDeniedState
      title="无权访问该页面"
      description="当前账号缺少访问该页面所需权限。你可以返回仪表盘，或联系管理员调整权限。"
      :reason="reasonText"
      :show-retry="false"
      :show-home="true"
      home-to="/admin/dashboard"
      home-text="返回仪表盘"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue'

const route = useRoute()

const reasonText = computed(() => {
  const permission = route.query?.permission
  if (typeof permission === 'string' && permission.trim()) {
    return `缺少权限：${permission}`
  }
  return ''
})
</script>
