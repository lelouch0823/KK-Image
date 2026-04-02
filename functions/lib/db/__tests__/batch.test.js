import { describe, expect, it, vi } from 'vitest';

import { chunkArray, executeBatchChunks } from '../batch.js';

describe('db batch helpers', () => {
  it('chunks arrays with a caller-provided chunk size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArray([], 2)).toEqual([]);
  });

  it('flattens all D1 batch results across chunk boundaries', async () => {
    const db = {
      batch: vi
        .fn()
        .mockResolvedValueOnce([{ meta: { changes: 1 } }, { meta: { changes: 1 } }])
        .mockResolvedValueOnce([{ meta: { changes: 1 } }]),
    };
    const statements = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const results = await executeBatchChunks(db, statements, 2);

    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(db.batch.mock.calls).toEqual([[[{ id: 1 }, { id: 2 }]], [[{ id: 3 }]]]);
    expect(results).toEqual([
      { meta: { changes: 1 } },
      { meta: { changes: 1 } },
      { meta: { changes: 1 } },
    ]);
  });
});
