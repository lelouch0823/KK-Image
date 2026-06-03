<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.notifications.title', '通知渠道')"
      :description="t('settings.notifications.description', '配置企业微信、钉钉等 webhook 通知渠道，系统事件将自动推送到已启用的渠道。')"
      icon="bell"
    >
      <div class="space-y-4">
        <!-- 企业微信 -->
        <AppCard padding="p-4" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex size-8 items-center justify-center rounded-lg bg-(--color-success-bg) text-success">
                <AppIcon name="chat-bubble-left-right" class="size-5" />
              </div>
              <div>
                <p class="text-sm font-medium text-(--text-main)">
                  {{ t('settings.notifications.wechatWork', '企业微信') }}
                </p>
                <p class="text-xs text-(--text-secondary)">
                  {{ t('settings.notifications.wechatWorkDesc', '通过企业微信群机器人 Webhook 推送通知') }}
                </p>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="channels.wechat_work.enabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="peer h-5 w-9 rounded-full bg-(--border-color) after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-(--color-primary) peer-checked:after:translate-x-full" />
            </label>
          </div>
          <AppInput
            v-model="channels.wechat_work.url"
            :placeholder="t('settings.notifications.webhookUrlPlaceholder', '输入 Webhook URL')"
            type="url"
          />
        </AppCard>

        <!-- 钉钉 -->
        <AppCard padding="p-4" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex size-8 items-center justify-center rounded-lg bg-(--color-info-bg) text-info">
                <AppIcon name="paper-airplane" class="size-5" />
              </div>
              <div>
                <p class="text-sm font-medium text-(--text-main)">
                  {{ t('settings.notifications.dingtalk', '钉钉') }}
                </p>
                <p class="text-xs text-(--text-secondary)">
                  {{ t('settings.notifications.dingtalkDesc', '通过钉钉群机器人 Webhook 推送通知') }}
                </p>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="channels.dingtalk.enabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="peer h-5 w-9 rounded-full bg-(--border-color) after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-(--color-primary) peer-checked:after:translate-x-full" />
            </label>
          </div>
          <AppInput
            v-model="channels.dingtalk.url"
            :placeholder="t('settings.notifications.webhookUrlPlaceholder', '输入 Webhook URL')"
            type="url"
          />
        </AppCard>

        <!-- 飞书 -->
        <AppCard padding="p-4" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex size-8 items-center justify-center rounded-lg bg-(--color-primary-bg) text-primary">
                <AppIcon name="paper-airplane" class="size-5" />
              </div>
              <div>
                <p class="text-sm font-medium text-(--text-main)">
                  {{ t('settings.notifications.feishu', '飞书') }}
                </p>
                <p class="text-xs text-(--text-secondary)">
                  {{ t('settings.notifications.feishuDesc', '通过飞书群机器人 Webhook 推送通知') }}
                </p>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="channels.feishu.enabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="peer h-5 w-9 rounded-full bg-(--border-color) after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-(--color-primary) peer-checked:after:translate-x-full" />
            </label>
          </div>
          <AppInput
            v-model="channels.feishu.url"
            :placeholder="t('settings.notifications.webhookUrlPlaceholder', '输入 Webhook URL')"
            type="url"
          />
        </AppCard>

        <!-- 通用 Webhook -->
        <AppCard padding="p-4" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex size-8 items-center justify-center rounded-lg bg-(--bg-muted) text-(--text-secondary)">
                <AppIcon name="globe-alt" class="size-5" />
              </div>
              <div>
                <p class="text-sm font-medium text-(--text-main)">
                  {{ t('settings.notifications.generic', '通用 Webhook') }}
                </p>
                <p class="text-xs text-(--text-secondary)">
                  {{ t('settings.notifications.genericDesc', '发送到自定义 HTTP 端点') }}
                </p>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="channels.generic.enabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="peer h-5 w-9 rounded-full bg-(--border-color) after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-(--color-primary) peer-checked:after:translate-x-full" />
            </label>
          </div>
          <AppInput
            v-model="channels.generic.url"
            :placeholder="t('settings.notifications.webhookUrlPlaceholder', '输入 Webhook URL')"
            type="url"
          />
        </AppCard>
      </div>

      <div class="mt-4 flex justify-end">
        <AppButton
          variant="primary"
          :loading="saving"
          @click="saveSettings"
        >
          {{ t('settings.save') }}
        </AppButton>
      </div>
    </SettingsSection>

    <!-- 邮件通知 -->
    <SettingsSection
      :title="t('settings.notifications.emailTitle', '邮件通知')"
      :description="t('settings.notifications.emailDesc', '配置邮件发送参数，订单状态变更时自动发送邮件通知客户。')"
      icon="envelope"
    >
      <div class="space-y-4">
        <AppCard padding="p-4" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <AppIcon name="envelope" class="size-5" />
              </div>
              <div>
                <p class="text-sm font-medium text-(--text-main)">
                  {{ t('settings.notifications.emailEnabled', '启用邮件通知') }}
                </p>
                <p class="text-xs text-(--text-secondary)">
                  {{ t('settings.notifications.emailEnabledDesc', '开启后，订单状态变更时自动发送邮件给客户') }}
                </p>
              </div>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                v-model="emailConfig.enabled"
                type="checkbox"
                class="peer sr-only"
              >
              <div class="peer h-5 w-9 rounded-full bg-(--border-color) after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-(--color-primary) peer-checked:after:translate-x-full" />
            </label>
          </div>
          <div class="space-y-1">
            <label class="text-secondary text-xs font-medium">
              {{ t('settings.notifications.emailFrom', '发件人地址') }}
            </label>
            <AppInput
              v-model="emailConfig.from"
              :placeholder="t('settings.notifications.emailFromPlaceholder', '如: noreply@your-domain.com')"
              type="email"
            />
          </div>
        </AppCard>
      </div>
    </SettingsSection>

    <!-- 事件说明 -->
    <SettingsSection
      :title="t('settings.notifications.eventTypes', '推送事件')"
      :description="t('settings.notifications.eventTypesDesc', '以下事件发生时，系统会自动推送到已启用的通知渠道。')"
      icon="information-circle"
    >
      <div class="space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="inline-block size-2 rounded-full bg-(--color-primary)" />
          <span>{{ t('settings.notifications.eventOrderCreated', '新订单创建') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block size-2 rounded-full bg-(--color-primary)" />
          <span>{{ t('settings.notifications.eventStatusChanged', '订单状态变更') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block size-2 rounded-full bg-(--color-primary)" />
          <span>{{ t('settings.notifications.eventComment', '订单新留言') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block size-2 rounded-full bg-(--color-primary)" />
          <span>{{ t('settings.notifications.eventDelivery', '订单签收确认') }}</span>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import SettingsSection from '@/components/settings/SettingsSection.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

const saving = ref(false);

const channels = ref({
  wechat_work: { url: '', enabled: true },
  dingtalk: { url: '', enabled: true },
  feishu: { url: '', enabled: true },
  generic: { url: '', enabled: true },
});

const emailConfig = ref({
  enabled: false,
  from: '',
});

async function loadSettings() {
  try {
    const response = await authFetch('/api/manage/settings');
    const res = await response.json();
    if (res.success && res.data) {
      const notif = res.data.notifications || {};
      for (const key of Object.keys(channels.value)) {
        const upperKey = key.toUpperCase();
        const url = notif[`NOTIFY_WEBHOOK_${upperKey}_URL`] || '';
        const enabled = notif[`NOTIFY_WEBHOOK_${upperKey}_ENABLED`] !== 'false';
        channels.value[key] = { url, enabled };
      }

      const email = res.data.email || {};
      emailConfig.value = {
        enabled: email.EMAIL_ENABLED === 'true',
        from: email.EMAIL_FROM || '',
      };
    }
  } catch (_err) {
    console.error('加载通知设置失败:', _err);
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const settings = [];
    for (const [key, ch] of Object.entries(channels.value)) {
      const upperKey = key.toUpperCase();
      settings.push({
        key: `NOTIFY_WEBHOOK_${upperKey}_URL`,
        value: ch.url,
        category: 'notifications',
      });
      settings.push({
        key: `NOTIFY_WEBHOOK_${upperKey}_ENABLED`,
        value: String(ch.enabled),
        category: 'notifications',
      });
    }

    // 邮件设置
    settings.push({
      key: 'EMAIL_ENABLED',
      value: String(emailConfig.value.enabled),
      category: 'email',
    });
    settings.push({
      key: 'EMAIL_FROM',
      value: emailConfig.value.from,
      category: 'email',
    });

    const response = await authFetch('/api/manage/settings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    const res = await response.json();
    if (res.success) {
      addToast(t('settings.success'), 'success');
    }
  } catch (_err) {
    addToast(t('settings.saveFailed'), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>
