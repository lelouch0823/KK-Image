import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import VariantBatchBuilderModal from '../VariantBatchBuilderModal.vue';

function createWrapper(props = {}) {
  return mount(VariantBatchBuilderModal, {
    props: {
      modelValue: true,
      existingVariants: [],
      ...props,
    },
    global: {
      stubs: {
        Teleport: true,
      },
    },
  });
}

describe('VariantBatchBuilderModal', () => {
  it('generates 3D matrix with defaults', async () => {
    const wrapper = createWrapper();
    await wrapper.get('[data-testid="input-colors"]').setValue('黄,蓝');
    await wrapper.get('[data-testid="input-materials"]').setValue('棉');
    await wrapper.get('[data-testid="input-sizes"]').setValue('S,M');
    await wrapper.get('[data-testid="default-price"]').setValue('99');
    await wrapper.get('[data-testid="default-stock"]').setValue('12');
    await wrapper.get('[data-testid="default-status"]').setValue('active');

    await wrapper.get('[data-testid="apply-btn"]').trigger('click');

    const payload = wrapper.emitted('apply')[0][0];
    expect(payload.options.map((o) => o.name)).toEqual(['颜色', '材质', '尺码']);
    expect(payload.variants).toHaveLength(4);
    expect(payload.variants[0].price).toBe(99);
    expect(payload.variants[0].stock_quantity).toBe(12);
    expect(payload.variants[0].status).toBe('active');
  });

  it('supports 2D/1D and deduplicates existing combinations', async () => {
    const wrapper = createWrapper({
      existingVariants: [
        { options_values: { 颜色: '黄', 尺码: 'S' } },
      ],
    });
    await wrapper.get('[data-testid="input-colors"]').setValue('黄,蓝');
    await wrapper.get('[data-testid="input-materials"]').setValue('');
    await wrapper.get('[data-testid="input-sizes"]').setValue('S');

    await wrapper.get('[data-testid="apply-btn"]').trigger('click');

    const payload = wrapper.emitted('apply')[0][0];
    expect(payload.options.map((o) => o.name)).toEqual(['颜色', '尺码']);
    expect(payload.variants).toHaveLength(1);
    expect(payload.variants[0].options_values).toEqual({ 颜色: '蓝', 尺码: 'S' });
  });
});
