import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

describe('WebhookSettings behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetch.mockImplementation(async (url) => {
      if (url === '/api/manage/webhooks') {
        return {
          json: async () => ({
            success: true,
            data: [
              {
                id: 'wh-1',
                url: 'https://example.com/hook',
                enabled: true,
                events: ['purchase_receipt_recorded', 'file_uploaded'],
              },
            ],
          }),
        };
      }

      if (String(url).startsWith('/api/manage/webhooks/logs?')) {
        return {
          json: async () => ({
            success: true,
            data: {
              items: [
                {
                  id: 'log-1',
                  event: 'purchase_receipt_recorded',
                  success: false,
                  status_code: 500,
                  duration_ms: 25,
                  created_at: '2026-04-13T08:00:00.000Z',
                  attempt_number: 1,
                  response: 'delivery failed',
                },
              ],
              total: 1,
            },
          }),
        };
      }

      return { json: async () => ({ success: true }) };
    });
  });

  it('renders webhook subscriptions and delivery logs with friendly event labels', async () => {
    const module = await import('../WebhookSettings.vue');
    const WebhookSettings = module.default;

    const wrapper = mount(WebhookSettings, {
      global: {
        stubs: {
          SettingsSection: {
            props: ['title', 'description'],
            template: `
              <section>
                <h2>{{ title }}</h2>
                <p>{{ description }}</p>
                <slot name="header-extra" />
                <slot />
              </section>
            `,
          },
          AppButton: {
            props: ['loading', 'variant', 'size', 'disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          AppIcon: { template: '<i />' },
        },
      },
    });

    await flushPromises();

    const text = wrapper.text();

    expect(text).toContain('采购收货已登记');
    expect(text).toContain('文件已上传');
    expect(text).not.toContain('purchase_receipt_recorded');
    expect(text).not.toContain('file_uploaded');
  });
});
