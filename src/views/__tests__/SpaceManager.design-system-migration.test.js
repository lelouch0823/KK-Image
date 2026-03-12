import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceManager design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/SpaceManager/index.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
    expect(source).not.toContain("text-primary text-xl font-semibold");
  });

  it('uses shared state components for loading and empty states', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/SpaceManager/index.vue'), 'utf8');

    expect(source).toContain('EmptyState');
    expect(source).toContain('<template #content>');
    expect(source).toContain('Skeleton');
  });
});
