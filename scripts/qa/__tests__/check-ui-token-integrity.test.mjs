import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runUiTokenIntegrityCheck } from '../check-ui-token-integrity.mjs';

const makeFile = (rootDir, relativePath, source) => {
  const absolutePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
};

describe('runUiTokenIntegrityCheck', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(os.tmpdir(), 'ui-token-integrity-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('passes when scanned files do not contain banned legacy tokens', () => {
    makeFile(rootDir, 'src/views/Stats.vue', '<template><div class="text-(--text-main)">Stats</div></template>');
    makeFile(
      rootDir,
      'src/components/common/ai/AIChart.vue',
      '<script setup>const indicator = "blue";</script>'
    );

    expect(runUiTokenIntegrityCheck(rootDir)).toBe(0);
    expect(console.log).toHaveBeenCalledWith('UI token integrity check passed.');
  });

  it('reports both global and targeted rule violations with file locations', () => {
    makeFile(
      rootDir,
      'src/views/Stats.vue',
      '<template><div style="color:#ec5b13">legacy</div></template>'
    );
    makeFile(
      rootDir,
      'src/components/common/ai/AIChart.vue',
      "<script setup>const font = 'Outfit'; const color = '#3B82F6';</script>"
    );

    expect(runUiTokenIntegrityCheck(rootDir)).toBe(1);
    expect(console.error).toHaveBeenCalledWith('UI token integrity check failed:');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[stats-chart-fallback] src/views/Stats.vue:1')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[aichart-legacy-fallbacks] src/components/common/ai/AIChart.vue:1')
    );
  });

  it('ignores matching source inside __tests__ directories when scanning recursively', () => {
    makeFile(
      rootDir,
      'src/__tests__/legacy-token.spec.vue',
      '<template><div class="material-symbols-outlined">x</div></template>'
    );

    expect(runUiTokenIntegrityCheck(rootDir)).toBe(0);
  });
});
