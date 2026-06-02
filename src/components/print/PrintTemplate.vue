<template>
  <div class="print-template">
    <!-- 打印页眉 -->
    <header class="print-header">
      <div class="print-header-left">
        <img
          v-if="settings.companyLogo"
          :src="settings.companyLogo"
          :alt="settings.companyName"
          class="print-logo"
        />
        <div>
          <h1 class="print-company-name">{{ settings.companyName }}</h1>
          <div v-if="settings.companyAddress || settings.companyPhone" class="print-company-info">
            <span v-if="settings.companyAddress">{{ settings.companyAddress }}</span>
            <span v-if="settings.companyAddress && settings.companyPhone"> · </span>
            <span v-if="settings.companyPhone">{{ settings.companyPhone }}</span>
          </div>
        </div>
      </div>
      <div class="print-header-right">
        <slot name="header-right" />
      </div>
    </header>

    <!-- 文档标题 -->
    <div v-if="title" class="print-title-section">
      <h2 class="print-doc-title">{{ title }}</h2>
      <div class="print-doc-meta">
        <slot name="title-meta" />
      </div>
    </div>

    <!-- 主体内容 -->
    <div class="print-body">
      <slot />
    </div>

    <!-- 页脚 -->
    <footer class="print-footer">
      <div class="print-footer-content">
        <span v-if="settings.footerText">{{ settings.footerText }}</span>
        <span class="print-footer-generated">
          {{ footerGeneratedText }}
        </span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePrintTemplate } from '@/composables/usePrintTemplate';

const props = defineProps({
  /** 文档标题 */
  title: {
    type: String,
    default: '',
  },
  /** 覆盖模板设置（用于传入特定数据而非使用全局设置） */
  overrideSettings: {
    type: Object,
    default: null,
  },
});

const { t } = useI18n();
const { getSettingsParsed } = usePrintTemplate();

const settings = computed(() => {
  const base = getSettingsParsed();
  return props.overrideSettings ? { ...base, ...props.overrideSettings } : base;
});

const footerGeneratedText = computed(() =>
  t('print.generatedBy', '由 {name} 系统生成 · {date}', {
    name: settings.value.companyName || 'KK-Image',
    date: new Date().toLocaleString(),
  })
);
</script>

<style scoped>
/* 打印模板默认隐藏，仅在打印时显示 */
.print-template {
  display: none;
}

@media print {
  .print-template {
    display: block !important;
    width: 100%;
    color: black;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .print-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2px solid v-bind('settings.accentColor');
    padding-bottom: 12px;
    margin-bottom: 20px;
  }

  .print-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .print-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .print-company-name {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: v-bind('settings.accentColor');
    margin: 0;
  }

  .print-company-info {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
  }

  .print-header-right {
    text-align: right;
    font-size: 13px;
  }

  .print-title-section {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
  }

  .print-doc-title {
    font-size: 16px;
    font-weight: 700;
    color: v-bind('settings.accentColor');
    margin: 0;
  }

  .print-doc-meta {
    font-size: 12px;
    color: #6b7280;
  }

  .print-body {
    margin-bottom: 24px;
  }

  .print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    border-top: 1px solid #e5e7eb;
    padding-top: 6px;
    text-align: center;
    font-size: 10px;
    color: #9ca3af;
    background: white;
  }

  .print-footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .print-footer-generated {
    text-align: right;
  }
}
</style>
