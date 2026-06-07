import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ImportImageMatchStep from '../ImportImageMatchStep.vue';

describe('ImportImageMatchStep', () => {
  it('uses product_code as fallback match key when spu is empty', () => {
    const wrapper = mount(ImportImageMatchStep, {
      props: {
        parsedItems: [
          {
            name: 'No SPU Product',
            spu: '',
            product_code: 'PABC12345678',
            image_url: 'a.jpg',
          },
        ],
        imageMatches: new Map([['PABC12345678', { name: 'a.jpg' }]]),
        processedImagesCount: 1,
        totalImagesCount: 1,
        fileCount: 1,
      },
    });

    expect(wrapper.text()).toContain('PABC12345678');
    expect(wrapper.html()).toContain('bg-success');
  });
});
