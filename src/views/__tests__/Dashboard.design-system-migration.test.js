import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Dashboard design-system migration', () => {
  it('uses the shared dashboard shell and shared stat cards', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Dashboard.vue'), 'utf8');

    expect(source).toContain('DashboardShell');
    expect(source).toContain('AppStatCard');
    expect(source).not.toContain('material-symbols-outlined');
  });

  it('keeps the dashboard main layout spanning the full shell grid width', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Dashboard.vue'), 'utf8');

    expect(source).toContain('template #main');
    expect(source).toContain('lg:col-span-12');
  });
});
