import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderStatusChanger from '@/components/OrderStatusChanger.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

const mountChanger = (props = {}) =>
  mount(OrderStatusChanger, {
    props: {
      status: 'pending',
      loading: false,
      onStatusChange: vi.fn(async () => {}),
      ...props,
    },
    global: {
      stubs: {
        Teleport: true,
        AppIcon: true,
      },
    },
  });

describe('OrderStatusChanger force flow UX', () => {
  it('shows friendly guidance tips for default and in-flow selection', async () => {
    const wrapper = mountChanger({ permissions: ['admin:full'] });

    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toContain('order.manage.friendlyPickTip');

    const confirmedBtn = wrapper.find('[aria-label="order.statuses.confirmed - order.manage.flowTag"]');
    await confirmedBtn.trigger('click');
    expect(wrapper.text()).toContain('order.manage.friendlyFlowTip');
  });

  it('shows no-permission helper when user cannot force override', async () => {
    const wrapper = mountChanger({ permissions: [] });

    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toContain('order.manage.friendlyNoPermissionTip');
  });

  it('submits in-flow status change without force', async () => {
    const onStatusChange = vi.fn(async () => {});
    const wrapper = mountChanger({ onStatusChange, permissions: [] });

    await wrapper.get('button').trigger('click');
    const confirmedBtn = wrapper.find('[aria-label="order.statuses.confirmed - order.manage.flowTag"]');
    expect(confirmedBtn.exists()).toBe(true);
    await confirmedBtn.trigger('click');
    await wrapper.findAll('button').find((b) => b.text().includes('common.confirm')).trigger('click');

    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        force: false,
      })
    );
  });

  it('blocks selecting out-of-flow status when user has no force permission', async () => {
    const wrapper = mountChanger({ permissions: [] });

    await wrapper.get('button').trigger('click');
    const deliveredBtn = wrapper.find('[aria-label="order.statuses.delivered - order.manage.forceTag"]');
    expect(deliveredBtn.exists()).toBe(true);
    expect(deliveredBtn.attributes('disabled')).toBeDefined();
  });

  it('requires checkbox and note for permitted force transition', async () => {
    const onStatusChange = vi.fn(async () => {});
    const wrapper = mountChanger({ permissions: ['admin:full'], onStatusChange });

    await wrapper.get('button').trigger('click');
    const deliveredBtn = wrapper.find('[aria-label="order.statuses.delivered - order.manage.forceTag"]');
    await deliveredBtn.trigger('click');
    expect(wrapper.text()).toContain('order.manage.friendlyForceConfirmTip');

    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('common.confirm'));
    expect(confirmBtn.attributes('disabled')).toBeDefined();

    const noteInput = wrapper.find('input.input');
    await noteInput.setValue('manual override note');
    expect(confirmBtn.attributes('disabled')).toBeDefined();

    const forceCheckbox = wrapper.find('input[type="checkbox"]');
    await forceCheckbox.setValue(true);
    expect(confirmBtn.attributes('disabled')).toBeUndefined();

    await confirmBtn.trigger('click');
    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'delivered',
        note: 'manual override note',
        force: true,
      })
    );
  });
});
