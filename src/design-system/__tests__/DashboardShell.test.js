import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DashboardShell from '../patterns/DashboardShell.vue';

describe('DashboardShell', () => {
  it('renders header, summary, and main regions through slots', () => {
    const wrapper = mount(DashboardShell, {
      props: {
        title: 'Dashboard',
        description: 'Overview',
      },
      slots: {
        actions: '<button>Refresh</button>',
        summary: '<div data-testid="summary">Summary</div>',
        main: '<div data-testid="main">Main</div>',
      },
    });

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Overview');
    expect(wrapper.get('[data-testid="summary"]').text()).toBe('Summary');
    expect(wrapper.get('[data-testid="main"]').text()).toBe('Main');
  });

  it('wraps the main slot in a full-width grid item', () => {
    const wrapper = mount(DashboardShell, {
      slots: {
        main: '<div data-testid="main">Main</div>',
      },
    });

    expect(wrapper.find('.lg\\:grid-cols-12').exists()).toBe(true);
    expect(wrapper.find('.lg\\:col-span-12').exists()).toBe(true);
  });
});
