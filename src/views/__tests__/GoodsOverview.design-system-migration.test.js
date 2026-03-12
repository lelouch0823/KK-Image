import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('GoodsOverview design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/GoodsOverview.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
  });

  it('relies on AppTable without an extra table card wrapper', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/GoodsOverview.vue'), 'utf8');

    expect(source).not.toContain('overflow-hidden rounded-xl bg-(--bg-card) shadow-sm');
  });

  it('uses flat overview cards and summary surfaces', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/GoodsOverview.vue'), 'utf8');

    expect(source).toContain('flat');
    expect(source).toContain('<SummaryStrip v-else-if="summary" flat>');
    expect(source).toContain('filters-variant="plain"');
  });

  it('renders the goods table without AppTable card framing', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/GoodsOverview.vue'), 'utf8');

    expect(source).toContain('no-border');
  });
});
