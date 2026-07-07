import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';

/**
 * 批量保存设置的 composable，消除各 settings tab 中重复的 saveSettings 模式。
 *
 * @param onSuccess - 保存成功后的回调（可选），用于更新本地缓存等
 */
export function useSettingsBatchSave(onSuccess?: () => void) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const { authFetch } = useAuth();
  const saving = ref(false);

  async function saveSettings(settingsArray: Array<{ key: string; value: unknown; category?: string }>) {
    saving.value = true;
    try {
      const res = await authFetch('/api/manage/settings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsArray }),
      });
      const json = await res.json();
      if (json.success) {
        addToast({ message: t('settings.success', 'Settings saved successfully'), type: 'success' });
        onSuccess?.();
      } else {
        throw new Error(json.error || t('settings.saveFailed', 'Save failed'));
      }
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    } finally {
      saving.value = false;
    }
  }

  return { saving, saveSettings };
}
