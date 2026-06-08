import { describe, expect, it } from 'vitest';
import { assertSafeExternalUrl, buildSafeExternalFetchOptions } from '../url-security.js';

describe('url-security', () => {
  it.each([
    'http://127.0.0.1/hook',
    'http://2130706433/hook',
    'http://0x7f000001/hook',
    'http://10.0.0.1/hook',
    'http://100.64.0.1/hook',
    'http://172.16.0.1/hook',
    'http://192.168.1.10/hook',
    'http://169.254.169.254/latest/meta-data',
    'http://192.0.2.1/hook',
    'http://198.18.0.1/hook',
    'http://198.51.100.1/hook',
    'http://203.0.113.1/hook',
    'http://224.0.0.1/hook',
    'http://240.0.0.1/hook',
    'http://255.255.255.255/hook',
    'http://[::]/hook',
    'http://[::1]/hook',
    'http://[100::]/hook',
    'http://[2001:2::1]/hook',
    'http://[2001:db8::1]/hook',
    'http://[fe80::1]/hook',
    'http://[fc00::1]/hook',
    'http://[ff02::1]/hook',
    'http://[::ffff:127.0.0.1]/hook',
    'http://[::ffff:10.0.0.1]/hook',
    'http://[::ffff:100.64.0.1]/hook',
    'http://[::ffff:198.18.0.1]/hook',
    'http://[::ffff:c0a8:0101]/hook',
  ])('rejects private or special network target %s', (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow(/内网地址/);
  });

  it.each(['https://8.8.8.8/hook', 'https://[2606:4700:4700::1111]/hook'])(
    'allows public literal target %s',
    (url) => {
      expect(() => assertSafeExternalUrl(url)).not.toThrow();
    }
  );

  it('allows localhost only when explicitly requested for development', () => {
    expect(() => assertSafeExternalUrl('http://localhost:8787/hook')).toThrow(/内网地址/);
    expect(() =>
      assertSafeExternalUrl('http://localhost:8787/hook', { allowLocalhost: true })
    ).not.toThrow();
    expect(() => assertSafeExternalUrl('http://10.0.0.1/hook', { allowLocalhost: true })).toThrow(
      /内网地址/
    );
  });

  it('builds fetch options that do not follow redirects automatically', () => {
    const options = buildSafeExternalFetchOptions({ timeoutMs: 1234 });

    expect(options.redirect).toBe('manual');
    expect(options.signal).toBeDefined();
  });
});
