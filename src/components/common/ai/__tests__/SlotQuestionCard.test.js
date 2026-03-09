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
});
