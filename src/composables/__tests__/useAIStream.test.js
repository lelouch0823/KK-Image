import { describe, it, expect } from 'vitest';
import { createStreamSanitizer } from '../useAIStream.js';

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

