import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('GoodsOverview design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/GoodsOverview.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
  });
});
