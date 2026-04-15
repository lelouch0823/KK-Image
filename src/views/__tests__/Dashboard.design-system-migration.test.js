import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Dashboard design-system migration', () => {
  it('uses the shared dashboard shell and shared stat cards', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Dashboard.vue'), 'utf8');
    const legacyMaterialSymbolsClass = ['material', 'symbols', 'outlined'].join('-');

    expect(source).toContain('DashboardShell');
    expect(source).toContain('AppStatCard');
    expect(source).not.toContain(legacyMaterialSymbolsClass);
    expect(source).not.toContain('<template #append>');
  });
});
