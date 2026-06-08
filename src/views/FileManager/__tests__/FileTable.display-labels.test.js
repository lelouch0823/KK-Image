import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FileTable from '../FileTable.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@/composables/useFileManager', () => ({
  useFileManager: () => ({
    formatDate: (value) => `date:${value}`,
    formatSize: (value) => `${value} B`,
    isImage: () => false,
  }),
}));

describe('FileTable display labels', () => {
  it('renders verbose MIME type values as readable file type labels', () => {
    const wrapper = mount(FileTable, {
      props: {
        files: [
          {
            id: 'file-1',
            name: 'stocktake.xlsx',
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 2048,
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
        selectedIds: new Set(),
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: { template: '<i />' },
          AppImage: { template: '<img />' },
          AppTable: {
            props: ['data'],
            template: `
              <div>
                <div v-for="row in data" :key="row.id">
                  <slot name="cell-name" :row="row" />
                  <slot name="cell-type" :value="row.type" :row="row" />
                </div>
              </div>
            `,
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Excel Spreadsheet');
    expect(wrapper.text()).not.toContain('VND.OPENXMLFORMATS');
    expect(wrapper.text()).not.toContain('spreadsheetml');
  });
});
