import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Stats design-system migration', () => {
  it('uses the shared dashboard shell and avoids page-local display typography', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Stats.vue'), 'utf8');

    expect(source).toContain('DashboardShell');
    expect(source).not.toContain('font-display');
  });

  it('keeps the stats main layout spanning the full shell grid width', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Stats.vue'), 'utf8');

    expect(source).toContain('template #main');
    expect(source).toContain('lg:col-span-12');
  });
});
