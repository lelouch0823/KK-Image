import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Sales design-system migration', () => {
  it('uses the shared mobile sales shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Sales.vue'), 'utf8');
    expect(source).toContain('MobileSalesShell');
  });
});
