import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import BackupSettings from '../BackupSettings.vue';

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

describe('BackupSettings behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            name: 'backup-2026-04-18.zip',
            size: 4096,
            uploadedAt: '2026-04-18T12:00:00.000Z',
          },
        ],
      }),
    });
  });

  function createWrapper() {
    return mount(BackupSettings, {
      global: {
        stubs: {
          SettingsSection: {
            props: ['title', 'description'],
            template: `
              <section>
                <header>
                  <h2>{{ title }}</h2>
                  <p>{{ description }}</p>
                  <slot name="action" />
                </header>
                <slot />
              </section>
            `,
          },
          AppButton: {
            props: ['disabled', 'loading', 'variant', 'size'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot name="icon-left" /><slot /></button>',
          },
          AppIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
          BackupRestoreDialog: {
            props: ['modelValue', 'backup', 'result', 'loading'],
            emits: ['update:modelValue', 'validate', 'dry-run', 'restore'],
            template: `
              <div v-if="modelValue" data-testid="restore-dialog">
                <div data-testid="restore-dialog-backup">{{ backup?.name }}</div>
                <div data-testid="restore-dialog-mode">{{ result?.mode || 'none' }}</div>
                <button data-testid="dialog-validate" @click="$emit('validate')">Dialog Validate</button>
                <button data-testid="dialog-dry-run" @click="$emit('dry-run')">Dialog Dry Run</button>
                <button data-testid="dialog-restore" @click="$emit('restore')">Dialog Restore</button>
                <button data-testid="dialog-close" @click="$emit('update:modelValue', false)">Close</button>
              </div>
            `,
          },
          AppTable: {
            props: ['columns', 'data', 'loading', 'emptyText'],
            template: `
              <div>
                <div data-testid="column-keys">{{ columns.map((column) => column.key).join(',') }}</div>
                <div v-if="loading" data-testid="loading">loading</div>
                <div v-else-if="!data.length" data-testid="empty">{{ emptyText }}</div>
                <div v-for="row in data" :key="row.name" data-testid="backup-row">
                  <slot name="cell-name" :row="row" />
                  <slot name="cell-size" :row="row" />
                  <slot name="cell-date" :row="row" />
                  <slot name="cell-actions" :row="row" />
                </div>
              </div>
            `,
          },
        },
      },
    });
  }

  it('loads backup rows on mount', async () => {
    const wrapper = createWrapper();

    await flushPromises();

    expect(mocks.authFetch).toHaveBeenCalledWith('/api/manage/backups');
    expect(wrapper.get('[data-testid="column-keys"]').text()).toContain('name');
    expect(wrapper.text()).toContain('backup-2026-04-18.zip');
    expect(wrapper.text()).toContain('Download');
  });

  it('creates a backup and refreshes the list on success', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{ name: 'fresh-backup.zip', size: 1024, uploadedAt: '2026-04-18T13:00:00.000Z' }],
        }),
      });

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, '/api/manage/backups', { method: 'POST' });
    expect(mocks.authFetch).toHaveBeenNthCalledWith(3, '/api/manage/backups');
    expect(mocks.addToast).toHaveBeenCalledWith({ type: 'success', message: 'settings.backup.createSuccess' });
  });

  it('shows an error toast when backup creation fails', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: false, error: 'create failed' }),
      });

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(mocks.addToast).toHaveBeenCalledWith({ type: 'error', message: 'create failed' });
  });

  it('downloads a backup file through the browser URL API', async () => {
    const createObjectURL = vi.fn(() => 'blob:backup-url');
    const revokeObjectURL = vi.fn();
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{ name: 'download-me.zip', size: 1024, uploadedAt: '2026-04-18T14:00:00.000Z' }],
        }),
      })
      .mockResolvedValueOnce({
        blob: async () => new Blob(['zip']),
      });

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const wrapper = createWrapper();
    await flushPromises();

    const downloadButton = wrapper.findAll('button').find((button) => button.text().includes('Download'));
    await downloadButton.trigger('click');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, '/api/manage/backups/download-me.zip');
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('opens the restore dialog and loads validation details for one backup', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{ name: 'restore-me.zip', size: 1024, uploadedAt: '2026-04-18T14:00:00.000Z' }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            name: 'restore-me.zip',
            mode: 'validate',
            allowed: true,
          },
        }),
      });

    const wrapper = createWrapper();
    await flushPromises();

    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, '/api/manage/backups/restore-me.zip/validate', { method: 'POST' });
    expect(wrapper.get('[data-testid="restore-dialog-backup"]').text()).toBe('restore-me.zip');
    expect(wrapper.get('[data-testid="restore-dialog-mode"]').text()).toBe('validate');
  });

  it('submits restore from the dialog and refreshes the list on success', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{ name: 'restore-me.zip', size: 1024, uploadedAt: '2026-04-18T14:00:00.000Z' }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            name: 'restore-me.zip',
            mode: 'validate',
            allowed: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            name: 'restore-me.zip',
            mode: 'restore',
            allowed: true,
            executed: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{ name: 'restore-me.zip', size: 1024, uploadedAt: '2026-04-18T14:00:00.000Z' }],
        }),
      });

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.findAll('button')[1].trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="dialog-restore"]').trigger('click');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(3, '/api/manage/backups/restore-me.zip/restore', { method: 'POST' });
    expect(mocks.authFetch).toHaveBeenNthCalledWith(4, '/api/manage/backups');
    expect(mocks.addToast).toHaveBeenCalledWith({ type: 'success', message: 'settings.backup.restoreSuccess' });
  });

  it('shows an error toast when restore execution is blocked', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{ name: 'restore-me.zip', size: 1024, uploadedAt: '2026-04-18T14:00:00.000Z' }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            name: 'restore-me.zip',
            mode: 'validate',
            allowed: false,
          },
        }),
      })
      .mockRejectedValueOnce(new Error('Restore execution is disabled in production'));

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.findAll('button')[1].trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="dialog-restore"]').trigger('click');
    await flushPromises();

    expect(mocks.addToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'Restore execution is disabled in production',
    });
  });
});
