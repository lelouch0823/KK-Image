import { describe, expect, it } from 'vitest';
import { buildSpacesGridModel } from '../../../miniprogram/pages/spaces/controller';

describe('spaces controller', () => {
  it('maps spaces into deterministic card rows instead of random waterfall ratios', () => {
    const model = buildSpacesGridModel([
      { id: 's-1', name: 'Showroom', template: 'gallery', fileCount: 4, coverUrl: '/file/a.jpg' },
    ]);

    expect(model[0]).toMatchObject({
      id: 's-1',
      title: 'Showroom',
      templateLabel: '画廊',
    });
  });
});
