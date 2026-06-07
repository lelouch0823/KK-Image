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
      [
        {
          fieldKey: 'salespersonId',
          candidate: { value: 'sp-1', label: '张三', description: '深圳店' },
          index: 0,
        },
      ],
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

  it('allows reselecting a candidate before submission instead of hard-locking the field', async () => {
    const wrapper = mount(SlotQuestionCard, {
      props: {
        action: {
          missingSlots: ['salespersonId', 'productId'],
          currentFieldKey: 'salespersonId',
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
    expect(wrapper.text()).toContain('当前补槽字段');

    await wrapper.find('[data-testid="reselect-salespersonId"]').trigger('click');

    await second.trigger('click');

    expect(second.attributes('data-selected')).toBe('true');
    expect(wrapper.emitted('select')).toHaveLength(2);
  });

  it('clears local selected state when the action payload changes', async () => {
    const wrapper = mount(SlotQuestionCard, {
      props: {
        action: {
          sessionId: 'act-1',
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
    expect(wrapper.text()).toContain('已选择');

    await wrapper.setProps({
      action: {
        sessionId: 'act-2',
        missingSlots: ['productId'],
        fields: [
          {
            key: 'productId',
            label: '商品',
            candidates: [{ value: 'prod-1', label: '跑鞋', description: 'SPU-1' }],
          },
        ],
      },
    });

    expect(wrapper.text()).not.toContain('已选择');
    expect(wrapper.find('[data-testid="candidate-option-0"]').attributes('data-selected')).toBe(
      'false'
    );
  });
});
