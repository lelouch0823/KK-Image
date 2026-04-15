import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ProductCatalogService line budget', () => {
  it('keeps ProductCatalogService under 520 lines', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'functions/services/ProductCatalogService.js'),
      'utf8'
    );

    expect(source.split('\n').length).toBeLessThan(520);
  });
});
