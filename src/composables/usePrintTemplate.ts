/**
 * 打印模板配置 Composable
 * @module composables/usePrintTemplate
 */
import { ref, type Ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

/** 打印模板原始设置（字符串值，与数据库存储一致） */
interface PrintTemplateRawSettings {
  PRINT_COMPANY_NAME: string;
  PRINT_COMPANY_LOGO: string;
  PRINT_COMPANY_ADDRESS: string;
  PRINT_COMPANY_PHONE: string;
  PRINT_FOOTER_TEXT: string;
  PRINT_SHOW_QR_CODE: string;
  PRINT_TEMPLATE_ACCENT_COLOR: string;
}

/** 打印模板解析后的设置 */
interface PrintTemplateParsedSettings {
  companyName: string;
  companyLogo: string;
  companyAddress: string;
  companyPhone: string;
  footerText: string;
  showQrCode: boolean;
  accentColor: string;
}

const DEFAULT_SETTINGS: PrintTemplateRawSettings = {
  PRINT_COMPANY_NAME: 'KK-Image',
  PRINT_COMPANY_LOGO: '',
  PRINT_COMPANY_ADDRESS: '',
  PRINT_COMPANY_PHONE: '',
  PRINT_FOOTER_TEXT: '',
  PRINT_SHOW_QR_CODE: 'false',
  PRINT_TEMPLATE_ACCENT_COLOR: '#111827',
};

const printTemplateSettings: Ref<PrintTemplateRawSettings> = ref({ ...DEFAULT_SETTINGS });
const isLoaded: Ref<boolean> = ref(false);
const isLoading: Ref<boolean> = ref(false);

export function usePrintTemplate() {
  const { authFetch } = useAuth();

  const loadSettings = async (force = false): Promise<PrintTemplateRawSettings> => {
    if (isLoaded.value && !force) return printTemplateSettings.value;

    if (isLoading.value) {
      return printTemplateSettings.value;
    }

    try {
      isLoading.value = true;
      const res = await authFetch('/api/manage/settings');
      const json = await res.json();

      if (json.success && json.data && json.data.printTemplate) {
        const pt = json.data.printTemplate;
        printTemplateSettings.value = {
          PRINT_COMPANY_NAME: pt.PRINT_COMPANY_NAME || DEFAULT_SETTINGS.PRINT_COMPANY_NAME,
          PRINT_COMPANY_LOGO: pt.PRINT_COMPANY_LOGO || DEFAULT_SETTINGS.PRINT_COMPANY_LOGO,
          PRINT_COMPANY_ADDRESS: pt.PRINT_COMPANY_ADDRESS || DEFAULT_SETTINGS.PRINT_COMPANY_ADDRESS,
          PRINT_COMPANY_PHONE: pt.PRINT_COMPANY_PHONE || DEFAULT_SETTINGS.PRINT_COMPANY_PHONE,
          PRINT_FOOTER_TEXT: pt.PRINT_FOOTER_TEXT || DEFAULT_SETTINGS.PRINT_FOOTER_TEXT,
          PRINT_SHOW_QR_CODE: pt.PRINT_SHOW_QR_CODE || DEFAULT_SETTINGS.PRINT_SHOW_QR_CODE,
          PRINT_TEMPLATE_ACCENT_COLOR: pt.PRINT_TEMPLATE_ACCENT_COLOR || DEFAULT_SETTINGS.PRINT_TEMPLATE_ACCENT_COLOR,
        };
      }
      isLoaded.value = true;
    } catch (e) {
      console.warn('[PrintTemplate] 加载模板设置失败:', e);
    } finally {
      isLoading.value = false;
    }

    return printTemplateSettings.value;
  };

  const getSettingsParsed = (): PrintTemplateParsedSettings => {
    return {
      companyName: printTemplateSettings.value.PRINT_COMPANY_NAME,
      companyLogo: printTemplateSettings.value.PRINT_COMPANY_LOGO,
      companyAddress: printTemplateSettings.value.PRINT_COMPANY_ADDRESS,
      companyPhone: printTemplateSettings.value.PRINT_COMPANY_PHONE,
      footerText: printTemplateSettings.value.PRINT_FOOTER_TEXT,
      showQrCode: printTemplateSettings.value.PRINT_SHOW_QR_CODE === 'true',
      accentColor: printTemplateSettings.value.PRINT_TEMPLATE_ACCENT_COLOR,
    };
  };

  return {
    printTemplateSettings,
    isLoaded,
    isLoading,
    loadSettings,
    getSettingsParsed,
    DEFAULT_SETTINGS,
  };
}
