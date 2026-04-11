import { describe, expect, it } from 'vitest';
import { normalizeSalesSpace } from '../sales-space';

describe('normalizeSalesSpace', () => {
  it('hydrates subspace cover from template images when no explicit cover exists', () => {
    const space = normalizeSalesSpace({
      id: 'space-parent-1',
      template: 'collection',
      subspaces: [
        {
          id: 'sub-1',
          name: '子空间 1',
          template: 'product',
          template_data: JSON.stringify({
            images: ['variant-main.jpg'],
          }),
          file_count: 0,
        },
      ],
    });

    expect(space.subspaces).toEqual([
      expect.objectContaining({
        id: 'sub-1',
        coverUrl: '/file/variant-main.jpg',
        coverImage: '/file/variant-main.jpg',
      }),
    ]);
  });
});
