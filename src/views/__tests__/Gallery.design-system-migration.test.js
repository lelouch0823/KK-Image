import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Gallery design-system migration', () => {
  it('uses the shared public viewer shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Gallery.vue'), 'utf8');
    expect(source).toContain('PublicViewerShell');
  });
});
