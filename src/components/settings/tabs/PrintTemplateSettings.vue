<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.printTemplate.title', 'Print Template')"
      :description="
        t(
          'settings.printTemplate.description',
          'Configure company branding and layout for printed documents and PDF exports.'
        )
      "
      icon="printer"
    >
      <form class="space-y-6" @submit.prevent="saveSettings">
        <AppCard padding="p-4" class="space-y-5">
          <!-- 公司名称 -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{
              t('settings.printTemplate.companyName', 'Company Name')
            }}</label>
            <AppInput
              v-model="form.PRINT_COMPANY_NAME"
              type="text"
              :placeholder="t('settings.printTemplate.companyNamePlaceholder', 'e.g. KK-Image')"
            />
            <p class="text-secondary text-xs">
              {{ t('settings.printTemplate.companyNameDesc', 'Displayed in the document header.') }}
            </p>
          </div>

          <!-- 公司 Logo -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{
              t('settings.printTemplate.companyLogo', 'Logo URL')
            }}</label>
            <AppInput
              v-model="form.PRINT_COMPANY_LOGO"
              type="url"
              placeholder="https://example.com/logo.png"
            />
            <p class="text-secondary text-xs">
              {{
                t(
                  'settings.printTemplate.companyLogoDesc',
                  'URL of the company logo image. Leave empty to hide.'
                )
              }}
            </p>
            <div v-if="form.PRINT_COMPANY_LOGO" class="mt-2 flex items-center gap-3">
              <img
                :src="form.PRINT_COMPANY_LOGO"
                :alt="form.PRINT_COMPANY_NAME"
                class="h-12 w-12 rounded border border-(--border-color) object-contain"
                @error="logoError = true"
              />
              <span v-if="logoError" class="text-xs text-danger">
                {{ t('settings.printTemplate.logoLoadFailed', 'Failed to load logo image') }}
              </span>
            </div>
          </div>

          <!-- 公司地址 -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{
              t('settings.printTemplate.companyAddress', 'Address')
            }}</label>
            <AppInput
              v-model="form.PRINT_COMPANY_ADDRESS"
              type="text"
              :placeholder="
                t('settings.printTemplate.companyAddressPlaceholder', 'e.g. 123 Main St, City')
              "
            />
          </div>

          <!-- 公司电话 -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{
              t('settings.printTemplate.companyPhone', 'Phone')
            }}</label>
            <AppInput
              v-model="form.PRINT_COMPANY_PHONE"
              type="text"
              :placeholder="
                t('settings.printTemplate.companyPhonePlaceholder', 'e.g. +86 123-4567-8900')
              "
            />
          </div>

          <!-- 主题色 -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{
              t('settings.printTemplate.accentColor', 'Accent Color')
            }}</label>
            <div class="flex items-center gap-3">
              <AppColorInput
                v-model="form.PRINT_TEMPLATE_ACCENT_COLOR"
                :label="t('settings.printTemplate.accentColor', 'Accent Color')"
              />
              <span class="text-secondary text-xs">
                {{
                  t(
                    'settings.printTemplate.accentColorDesc',
                    'Used for headers and borders in printed documents.'
                  )
                }}
              </span>
            </div>
          </div>
        </AppCard>

        <!-- 页脚设置 -->
        <AppCard padding="p-4" class="space-y-5">
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{
              t('settings.printTemplate.footerText', 'Footer Text')
            }}</label>
            <AppInput
              v-model="form.PRINT_FOOTER_TEXT"
              type="text"
              :placeholder="
                t(
                  'settings.printTemplate.footerTextPlaceholder',
                  'e.g. Thank you for your business!'
                )
              "
            />
            <p class="text-secondary text-xs">
              {{
                t(
                  'settings.printTemplate.footerTextDesc',
                  'Displayed at the bottom of every printed page.'
                )
              }}
            </p>
          </div>
        </AppCard>

        <!-- 预览 -->
        <AppCard padding="p-4">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-primary text-sm font-medium">
              {{ t('settings.printTemplate.preview', 'Preview') }}
            </h4>
          </div>
          <div
            class="max-w-[400px] overflow-hidden rounded border border-(--border-color) bg-white p-4 text-xs"
          >
            <div
              class="flex items-start justify-between border-b-2 pb-2"
              :style="{ borderColor: form.PRINT_TEMPLATE_ACCENT_COLOR }"
            >
              <div class="flex items-center gap-2">
                <img
                  v-if="form.PRINT_COMPANY_LOGO && !logoError"
                  :src="form.PRINT_COMPANY_LOGO"
                  class="h-8 w-8 rounded object-contain"
                  @error="logoError = true"
                />
                <div>
                  <div class="font-bold" :style="{ color: form.PRINT_TEMPLATE_ACCENT_COLOR }">
                    {{ form.PRINT_COMPANY_NAME || 'Company Name' }}
                  </div>
                  <div class="text-xs text-(--text-secondary)">
                    <span v-if="form.PRINT_COMPANY_ADDRESS">{{ form.PRINT_COMPANY_ADDRESS }}</span>
                    <span v-if="form.PRINT_COMPANY_ADDRESS && form.PRINT_COMPANY_PHONE"> · </span>
                    <span v-if="form.PRINT_COMPANY_PHONE">{{ form.PRINT_COMPANY_PHONE }}</span>
                  </div>
                </div>
              </div>
              <div class="text-right text-xs text-(--text-secondary)">#ORDER-001</div>
            </div>
            <div class="mt-2 text-xs text-(--text-main)">
              {{ t('settings.printTemplate.previewContent', 'Document content area...') }}
            </div>
            <div
              v-if="form.PRINT_FOOTER_TEXT"
              class="mt-2 border-t border-(--border-color) pt-1 text-center text-xs text-(--text-muted)"
            >
              {{ form.PRINT_FOOTER_TEXT }}
            </div>
          </div>
        </AppCard>

        <ActionBar class="border-none bg-transparent px-0 py-0 shadow-none">
          <AppButton
            type="submit"
            variant="primary"
            :loading="saving"
            :text="saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')"
          >
            <template v-if="!saving" #icon-left>
              <AppIcon name="check-badge" class="size-4" />
            </template>
          </AppButton>
        </ActionBar>
      </form>
    </SettingsSection>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppColorInput from '@/components/ui/AppColorInput.vue';
import AppInput from '@/components/ui/AppInput.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import { useI18n } from '@/composables/useI18n';
import { usePrintTemplate } from '@/composables/usePrintTemplate';
import { useSettingsBatchSave } from '@/composables/useSettingsBatchSave';

const { t } = useI18n();
const { loadSettings, printTemplateSettings, DEFAULT_SETTINGS } = usePrintTemplate();
const { saving, saveSettings: batchSave } = useSettingsBatchSave(() => {
  Object.assign(printTemplateSettings.value, form);
});
const logoError = ref(false);

const form = reactive({
  PRINT_COMPANY_NAME: DEFAULT_SETTINGS.PRINT_COMPANY_NAME,
  PRINT_COMPANY_LOGO: DEFAULT_SETTINGS.PRINT_COMPANY_LOGO,
  PRINT_COMPANY_ADDRESS: DEFAULT_SETTINGS.PRINT_COMPANY_ADDRESS,
  PRINT_COMPANY_PHONE: DEFAULT_SETTINGS.PRINT_COMPANY_PHONE,
  PRINT_FOOTER_TEXT: DEFAULT_SETTINGS.PRINT_FOOTER_TEXT,
  PRINT_SHOW_QR_CODE: DEFAULT_SETTINGS.PRINT_SHOW_QR_CODE,
  PRINT_TEMPLATE_ACCENT_COLOR: DEFAULT_SETTINGS.PRINT_TEMPLATE_ACCENT_COLOR,
});

// 当 Logo URL 变化时重置错误状态
watch(
  () => form.PRINT_COMPANY_LOGO,
  () => {
    logoError.value = false;
  }
);

const loadCurrentSettings = async () => {
  await loadSettings(true);
  form.PRINT_COMPANY_NAME = printTemplateSettings.value.PRINT_COMPANY_NAME;
  form.PRINT_COMPANY_LOGO = printTemplateSettings.value.PRINT_COMPANY_LOGO;
  form.PRINT_COMPANY_ADDRESS = printTemplateSettings.value.PRINT_COMPANY_ADDRESS;
  form.PRINT_COMPANY_PHONE = printTemplateSettings.value.PRINT_COMPANY_PHONE;
  form.PRINT_FOOTER_TEXT = printTemplateSettings.value.PRINT_FOOTER_TEXT;
  form.PRINT_SHOW_QR_CODE = printTemplateSettings.value.PRINT_SHOW_QR_CODE;
  form.PRINT_TEMPLATE_ACCENT_COLOR = printTemplateSettings.value.PRINT_TEMPLATE_ACCENT_COLOR;
};

const saveSettings = () =>
  batchSave([
    { key: 'PRINT_COMPANY_NAME', value: form.PRINT_COMPANY_NAME, category: 'printTemplate' },
    { key: 'PRINT_COMPANY_LOGO', value: form.PRINT_COMPANY_LOGO, category: 'printTemplate' },
    { key: 'PRINT_COMPANY_ADDRESS', value: form.PRINT_COMPANY_ADDRESS, category: 'printTemplate' },
    { key: 'PRINT_COMPANY_PHONE', value: form.PRINT_COMPANY_PHONE, category: 'printTemplate' },
    { key: 'PRINT_FOOTER_TEXT', value: form.PRINT_FOOTER_TEXT, category: 'printTemplate' },
    { key: 'PRINT_SHOW_QR_CODE', value: form.PRINT_SHOW_QR_CODE, category: 'printTemplate' },
    { key: 'PRINT_TEMPLATE_ACCENT_COLOR', value: form.PRINT_TEMPLATE_ACCENT_COLOR, category: 'printTemplate' },
  ]);

onMounted(() => {
  loadCurrentSettings();
});
</script>
