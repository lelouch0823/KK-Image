import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runUiFoundationUsageCheck } from '../check-ui-foundation-usage.mjs';

const makeFile = (rootDir, relativePath, source) => {
  const absolutePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source, 'utf8');
};

describe('runUiFoundationUsageCheck', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(os.tmpdir(), 'ui-foundation-usage-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('passes when remediated files use shared foundation components only', () => {
    makeFile(rootDir, 'src/views/Dashboard.vue', '<template><AppButton>OK</AppButton></template>');
    makeFile(rootDir, 'src/components/common/AIChatWidget.vue', '<template><AppButton>AI</AppButton></template>');
    makeFile(rootDir, 'src/components/ShareFileModal.vue', '<template><AppInput /></template>');

    expect(runUiFoundationUsageCheck(rootDir)).toBe(0);
    expect(console.log).toHaveBeenCalledWith('UI foundation usage check passed.');
  });

  it('reports raw svg, button, and form-control violations', () => {
    makeFile(rootDir, 'src/views/Dashboard.vue', '<template><svg /><button>Legacy</button></template>');
    makeFile(rootDir, 'src/components/common/AIChatWidget.vue', '<template><button>Ask</button></template>');
    makeFile(rootDir, 'src/components/ShareFileModal.vue', '<template><input /></template>');

    expect(runUiFoundationUsageCheck(rootDir)).toBe(1);
    expect(console.error).toHaveBeenCalledWith('UI foundation usage check failed:');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[no-raw-svg-in-remediated-web-files] src/views/Dashboard.vue:1 contains <svg')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[no-raw-buttons-in-remediated-web-files] src/views/Dashboard.vue:1 contains <button')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[no-raw-buttons-in-remediated-web-files] src/components/common/AIChatWidget.vue:1 contains <button')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[no-raw-form-controls-in-remediated-web-files] src/components/ShareFileModal.vue:1 contains <input')
    );
  });
});
