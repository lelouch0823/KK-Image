import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ManagementListShell from '../patterns/ManagementListShell.vue';

describe('ManagementListShell', () => {
  it('renders actions, filters, summary, and content regions', () => {
    const wrapper = mount(ManagementListShell, {
      props: {
        title: 'Orders',
        description: 'Manage records',
      },
      slots: {
        actions: '<button>Create</button>',
        filters: '<div data-testid="filters">Filters</div>',
        summary: '<div data-testid="summary">Summary</div>',
        content: '<div data-testid="content">Content</div>',
      },
    });

    expect(wrapper.text()).toContain('Orders');
    expect(wrapper.get('[data-testid="filters"]').text()).toBe('Filters');
    expect(wrapper.get('[data-testid="summary"]').text()).toBe('Summary');
    expect(wrapper.get('[data-testid="content"]').text()).toBe('Content');
  });

  it('uses a lighter toolbar surface for filters and a primary panel for content', () => {
    const wrapper = mount(ManagementListShell, {
      props: {
        title: 'Orders',
      },
      slots: {
        filters: '<div>Filters</div>',
        content: '<div>Content</div>',
      },
    });

    expect(wrapper.get('[data-surface-variant="toolbar"]').text()).toContain('Filters');
    expect(wrapper.get('[data-surface-variant="panel"]').text()).toContain('Content');
  });

  it('supports a plain filters surface without the toolbar shell', () => {
    const wrapper = mount(ManagementListShell, {
      props: {
        title: 'Orders',
        filtersVariant: 'plain',
      },
      slots: {
        filters: '<div>Filters</div>',
      },
    });

    expect(wrapper.get('[data-surface-variant="plain"]').text()).toContain('Filters');
  });
});
