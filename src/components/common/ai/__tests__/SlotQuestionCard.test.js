import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SlotQuestionCard from '../SlotQuestionCard.vue';

describe('SlotQuestionCard', () => {
  it('emits select when a candidate button is clicked', async () => {
    const wrapper = mount(SlotQuestionCard, {
      props: {
        action: {
          missingSlots: ['salespersonId'],
          fields: [
            {
              key: 'salespersonId',
              label: '销售员',
              candidates: [
                { value: 'sp-1', label: '张三', description: '深圳店' },
                { value: 'sp-2', label: '李四', description: '广州店' },
              ],
            },
          ],
        },
      },
    });

    await wrapper.find('[data-testid="candidate-option-0"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      [{ fieldKey: 'salespersonId', candidate: { value: 'sp-1', label: '张三', description: '深圳店' }, index: 0 }],
    ]);
  });

  it('shows selected candidate summary locally after click', async () => {
    const wrapper = mount(SlotQuestionCard, {
      props: {
        action: {
          missingSlots: ['salespersonId'],
          fields: [
            {
              key: 'salespersonId',
              label: '销售员',
              candidates: [
                { value: 'sp-1', label: '张三', description: '深圳店' },
                { value: 'sp-2', label: '李四', description: '广州店' },
              ],
            },
          ],
        },
      },
    });

    await wrapper.find('[data-testid="candidate-option-1"]').trigger('click');

    expect(wrapper.text()).toContain('已选择');
    expect(wrapper.text()).toContain('李四');
    expect(wrapper.text()).toContain('广州店');
  });

  it('marks the selected candidate button as active and disables further clicks', async () => {
    const wrapper = mount(SlotQuestionCard, {
      props: {
        action: {
          missingSlots: ['salespersonId'],
          fields: [
            {
              key: 'salespersonId',
              label: '销售员',
              candidates: [
                { value: 'sp-1', label: '张三', description: '深圳店' },
                { value: 'sp-2', label: '李四', description: '广州店' },
              ],
            },
          ],
        },
      },
    });

    const first = wrapper.find('[data-testid="candidate-option-0"]');
    const second = wrapper.find('[data-testid="candidate-option-1"]');

    await first.trigger('click');

    expect(first.attributes('data-selected')).toBe('true');
    expect(first.attributes('disabled')).toBeDefined();
    expect(second.attributes('disabled')).toBeDefined();

    await second.trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
  });
});
