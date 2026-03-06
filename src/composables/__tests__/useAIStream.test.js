import { describe, it, expect } from 'vitest';
import { createStreamSanitizer, classifyAIStreamError } from '../useAIStream.js';
import fs from 'node:fs';
import path from 'node:path';

describe('createStreamSanitizer', () => {
  it('removes internal tags across chunk boundaries', () => {
    const sanitizer = createStreamSanitizer({ carryLimit: 8 });
    const p1 = sanitizer.push('你好<arg_');
    const p2 = sanitizer.push('key>limit</arg_key>世界');
    const p3 = sanitizer.flush();
    const merged = `${p1}${p2}${p3}`;
    expect(merged).toContain('你好');
    expect(merged).toContain('世界');
    expect(merged).not.toContain('arg_key');
  });

  it('keeps normal text unchanged', () => {
    const sanitizer = createStreamSanitizer({ carryLimit: 4 });
    const p1 = sanitizer.push('今天订单');
    const p2 = sanitizer.push('增长 12%');
    const p3 = sanitizer.flush();
    expect(`${p1}${p2}${p3}`).toContain('今天订单增长 12%');
  });
});

describe('classifyAIStreamError', () => {
  it('marks model image capability errors as handled image errors', () => {
    const result = classifyAIStreamError('AI API error (400): model vision not supported');
    expect(result.isHandled).toBe(true);
    expect(result.isImageError).toBe(true);
    expect(result.kind).toBe('model_capability');
  });

  it('keeps non-image errors as generic stream errors', () => {
    const result = classifyAIStreamError('AI API error (500): internal error');
    expect(result.isHandled).toBe(false);
    expect(result.isImageError).toBe(false);
    expect(result.kind).toBe('generic');
  });

  it('classifies image format/input compatibility errors separately from model capability', () => {
    const result = classifyAIStreamError(
      'AI API error (400): invalid image_url.url - data:image/webp;base64,... is not supported'
    );
    expect(result.isHandled).toBe(true);
    expect(result.isImageError).toBe(true);
    expect(result.kind).toBe('image_input_format');
  });
});

describe('request path guard', () => {
  it('routes protected AI stream calls through request adapters instead of useAuth.authFetch', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/composables/useAIStream.js'), 'utf8');
    expect(source).toContain('useRequestAdapters');
    expect(source).not.toContain('const { authFetch } = useAuth()');
    expect(source).not.toContain('authFetch(API_URLS.AI.STREAM');
  });
});
