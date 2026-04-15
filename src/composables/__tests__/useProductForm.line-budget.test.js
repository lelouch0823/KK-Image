import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useProductForm line budget', () => {
  it('keeps useProductForm under 650 lines', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/composables/useProductForm.js'),
      'utf8'
    );

    expect(source.split('\n').length).toBeLessThan(650);
  });
});
