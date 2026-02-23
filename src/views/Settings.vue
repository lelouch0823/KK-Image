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
      enter-active-class="transition duration-300 ease-out delay-100"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
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

// 内联 SVG 图标组件 (Sidebar Icons)
const SparklesIcon = {
  template: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>`
};

const CloudArrowUpIcon = {
  template: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>`
};

const PhotoIcon = {
  template: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>`
};

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
    icon: SparklesIcon,
  },
  { 
    id: 'watermark', 
    label: t('settings.watermark.title', 'Watermark'), 
    icon: PhotoIcon,
    badge: 'New'
  },
  { 
    id: 'backups', 
    label: t('settings.backup.title', 'System Backups'), 
    icon: CloudArrowUpIcon 
  },
]);

const activeComponent = computed(() => tabs[currentTab.value] || AISettings);
</script>

