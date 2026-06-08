import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

describe('BackupRestoreDialog', () => {
  it('renders friendly restore environment, mode, and summary instead of raw JSON', async () => {
    const module = await import('../BackupRestoreDialog.vue');
    const BackupRestoreDialog = module.default;

    const wrapper = mount(BackupRestoreDialog, {
      props: {
        modelValue: true,
        backup: { name: 'backup-2026-04-18.zip' },
        result: {
          environment: 'production',
          mode: 'dry_run',
          allowed: true,
          executed: false,
          checkedTables: 8,
          restoredRows: 0,
          message: 'Dry run completed',
        },
      },
      global: {
        stubs: {
          Modal: {
            props: ['modelValue', 'title'],
            template: `
              <section v-if="modelValue">
                <h2>{{ title }}</h2>
                <slot />
                <footer><slot name="footer" /></footer>
              </section>
            `,
          },
          ConfirmDialog: { template: '<div />' },
          AppButton: { template: '<button><slot /></button>' },
          AppIcon: { template: '<i />' },
        },
      },
    });

    const text = wrapper.text();

    expect(text).toContain('生产环境');
    expect(text).toContain('试运行恢复');
    expect(text).toContain('检查数据表');
    expect(text).toContain('8');
    expect(text).not.toContain('dry_run');
    expect(text).not.toContain('"environment"');
    expect(text).not.toContain('"checkedTables"');
  });
});
