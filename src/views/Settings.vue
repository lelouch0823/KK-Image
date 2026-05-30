<template>
  <SettingsLayout
    :title="activeTitle"
    :description="activeDescription"
  >
    <template #sidebar>
      <SettingsSidebar
        v-model:current-tab="currentTab"
        :items="navigationItems"
      />
    </template>

    <Transition
      enter-active-class="transition duration-250 ease-out-expo delay-100"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
      mode="out-in"
    >
      <component :is="activeComponent" :key="currentTab" />
    </Transition>
  </SettingsLayout>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

import SettingsLayout from '@/components/settings/SettingsLayout.vue';
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue';
import BackupSettings from '@/components/settings/tabs/BackupSettings.vue';
import AISettings from '@/components/settings/tabs/AISettings.vue';
import WatermarkSettings from '@/components/settings/tabs/WatermarkSettings.vue';

const { t } = useI18n();

const currentTab = ref('ai');

const tabs = {
  ai: AISettings,
  watermark: WatermarkSettings,
  backups: BackupSettings,
};

// Computes dynamic title and description based on current tab
const activeTitle = computed(() => {
  if (currentTab.value === 'ai') return t('settings.ai.title', 'AI Configuration');
  if (currentTab.value === 'watermark') return t('settings.watermark.title', 'Watermark Settings');
  if (currentTab.value === 'backups') return t('settings.backup.title', 'System Backups');
  return t('settings.title', 'System Settings');
});

const activeDescription = computed(() => {
  if (currentTab.value === 'ai') return t('settings.ai.description', 'Manage API keys and model preferences for the AI assistant.');
  if (currentTab.value === 'watermark') return t('settings.watermark.description', 'Configure global text watermark applied to uploaded images.');
  if (currentTab.value === 'backups') return t('settings.backup.description', 'Create and download full system backups including database and stored files.');
  return t('settings.subtitle', 'Manage your application preferences, AI configurations, and system backups.');
});

const navigationItems = computed(() => [
  { 
    id: 'ai', 
    label: t('settings.ai.title', 'AI Configuration'), 
    icon: 'sparkles',
  },
  { 
    id: 'watermark', 
    label: t('settings.watermark.title', 'Watermark'), 
    icon: 'photo',
    badge: 'New'
  },
  { 
    id: 'backups', 
    label: t('settings.backup.title', 'System Backups'), 
    icon: 'cloud-arrow-up' 
  },
]);

const activeComponent = computed(() => tabs[currentTab.value] || AISettings);
</script>

