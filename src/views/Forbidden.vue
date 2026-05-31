<template>
  <div class="flex min-h-[60vh] items-center justify-center px-4 py-8">
    <PermissionDeniedState
      :title="t('common.forbidden.title')"
      :description="t('common.forbidden.description')"
      :reason="reasonText"
      :show-retry="false"
      :show-home="true"
      home-to="/admin/dashboard"
      :home-text="t('common.forbidden.backToDashboard')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue'

const { t } = useI18n()
const route = useRoute()

const reasonText = computed(() => {
  const permission = route.query?.permission
  if (typeof permission === 'string' && permission.trim()) {
    return t('common.forbidden.reason', { permission })
  }
  return ''
})
</script>
