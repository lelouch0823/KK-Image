import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTable from '../AppTable.vue';

describe('AppTable design contract', () => {
  it('renders a stable empty state using shared iconography', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [],
      },
    });

    expect(wrapper.text()).toContain('暂无数据');
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('renders default tables inside a lightweight card shell', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
      },
    });

    expect(wrapper.get('[data-table-surface="card"]').exists()).toBe(true);
    expect(wrapper.get('thead').classes()).toContain('app-table__head');
    expect(wrapper.get('tbody').classes()).toContain('app-table__body');
  });

  it('keeps no-border tables frameless', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
        noBorder: true,
      },
    });

    expect(wrapper.get('[data-table-surface="plain"]').exists()).toBe(true);
  });

  it('uses subtler separators in no-border mode', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
        noBorder: true,
      },
    });

    expect(wrapper.get('thead').classes()).toContain('app-table__head--plain');
    expect(wrapper.get('tbody').classes()).toContain('app-table__body--plain');
  });

  it('keeps a stable stage shell and sparse fill region for low row counts', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
      },
      slots: {
        footer: '<div data-test="footer">Pagination</div>',
      },
    });

    expect(wrapper.get('[data-table-stage]').classes()).toContain('app-table__stage');
    expect(wrapper.get('[data-table-stage-mode="sparse"]').exists()).toBe(true);
    expect(wrapper.get('[data-table-sparse-fill]').exists()).toBe(true);
    expect(wrapper.get('[data-table-footer]').exists()).toBe(true);
  });

  it('keeps empty state inside the same stable stage shell', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [],
      },
    });

    expect(wrapper.get('[data-table-stage-mode="empty"]').exists()).toBe(true);
    expect(wrapper.get('[data-table-stage]').classes()).toContain('app-table__stage');
  });

  it('uses sparse mode when data count is below the threshold', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'Alpha' },
          { id: 2, name: 'Beta' },
        ],
        sparseThreshold: 3,
        minRows: 7,
      },
    });

    expect(wrapper.get('[data-table-stage-mode="sparse"]').exists()).toBe(true);
    expect(wrapper.attributes('data-min-rows')).toBe('7');
  });

  it('uses normal mode when data count exceeds the sparse threshold', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
          { id: 3, name: 'C' },
          { id: 4, name: 'D' },
        ],
        sparseThreshold: 3,
      },
    });

    expect(wrapper.get('[data-table-stage-mode="normal"]').exists()).toBe(true);
  });

  it('applies a stable minimum stage height derived from minRows', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
        minRows: 6,
        estimateSize: 48,
      },
    });

    expect(wrapper.get('[data-table-stage]').attributes('style')).toContain('min-height');
  });

  it('can disable sparse fill for exception pages', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
        fillSparseSpace: false,
      },
    });

    expect(wrapper.find('[data-table-sparse-fill]').exists()).toBe(false);
  });

  it('keeps the footer anchored below the stable stage', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
      },
      slots: {
        footer: '<div data-test="footer">Footer</div>',
      },
    });

    const html = wrapper.html();
    expect(html.indexOf('data-table-stage')).toBeLessThan(html.indexOf('data-table-footer'));
  });

  it('uses the same stage shell in loading mode', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [],
        loading: true,
      },
    });

    expect(wrapper.get('[data-table-stage-mode="loading"]').exists()).toBe(true);
    expect(wrapper.get('[data-table-stage]').classes()).toContain('app-table__stage');
  });

  it('supports declarative column cell behavior and per-table layout', () => {
    const wrapper = mount(AppTable, {
      props: {
        tableLayout: 'fixed',
        columns: [
          {
            key: 'code',
            label: 'Code',
            width: '180px',
            maxWidth: '180px',
            headerClass: 'tracking-wide',
            cellClass: 'font-mono',
            nowrap: true,
            truncate: true,
          },
        ],
        data: [{ id: 1, code: 'LONG-LONG-LONG-CODE-1234567890' }],
      },
    });

    expect(wrapper.get('table').attributes('style')).toContain('table-layout: fixed;');
    expect(wrapper.get('th').classes()).toContain('tracking-wide');
    expect(wrapper.get('td').classes()).toContain('font-mono');
    expect(wrapper.get('td').classes()).toContain('truncate');
    expect(wrapper.get('td').classes()).toContain('whitespace-nowrap');
    expect(wrapper.get('td').attributes('style')).toContain('width: 180px;');
    expect(wrapper.get('td').attributes('style')).toContain('max-width: 180px;');
  });

  it('supports semantic column kinds with overridable defaults', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [
          { key: 'sku', label: 'SKU', kind: 'identifier', width: '180px', maxWidth: '180px' },
          { key: 'status', label: 'Status', kind: 'status', cellClass: 'font-semibold' },
          { key: 'createdAt', label: 'Created', kind: 'datetime' },
          { key: 'count', label: 'Count', kind: 'numeric' },
        ],
        data: [{ id: 1, sku: 'SKU-ALPHA-BETA-GAMMA', status: 'active', createdAt: '2026-04-13 10:00', count: 42 }],
      },
    });

    const cells = wrapper.findAll('td');
    expect(cells[0].classes()).toContain('whitespace-nowrap');
    expect(cells[0].classes()).toContain('truncate');
    expect(cells[1].classes()).toContain('whitespace-nowrap');
    expect(cells[1].classes()).toContain('font-semibold');
    expect(cells[1].classes()).not.toContain('truncate');
    expect(cells[2].classes()).toContain('whitespace-nowrap');
    expect(cells[2].classes()).toContain('tabular-nums');
    expect(cells[3].classes()).toContain('whitespace-nowrap');
    expect(cells[3].classes()).toContain('tabular-nums');
  });

  it('mirrors legacy responsive visibility classes onto body cells', () => {
    const wrapper = mount(AppTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name', class: 'hidden md:table-cell' },
        ],
        data: [{ id: 1, name: 'Alpha' }],
      },
    });

    expect(wrapper.get('th').classes()).toContain('hidden');
    expect(wrapper.get('td').classes()).toContain('hidden');
    expect(wrapper.get('td').classes()).toContain('md:table-cell');
  });
});
