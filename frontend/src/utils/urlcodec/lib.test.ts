import { describe, expect, it } from 'vitest';
import { buildUrl, decodeComponent, encodeComponent, encodeUrlFull, splitUrl } from './lib';

describe('urlcodec', () => {
  it('encodes and decodes components', () => {
    expect(encodeComponent('hello world & more?')).toBe('hello%20world%20%26%20more%3F');
    expect(decodeComponent('hello%20world%20%26%20more%3F')).toBe('hello world & more?');
  });

  it('round-trips unicode', () => {
    const s = 'café ☕ naïve';
    expect(decodeComponent(encodeComponent(s))).toBe(s);
  });

  it('rejects malformed escapes on decode', () => {
    expect(() => decodeComponent('%ZZ')).toThrow();
    expect(() => decodeComponent('abc%2')).toThrow();
  });

  it('encodeUrlFull keeps URL structure intact', () => {
    expect(encodeUrlFull('https://x.com/a path/?q=a b')).toBe('https://x.com/a%20path/?q=a%20b');
  });

  it('splits a URL into base + params', () => {
    const { base, params } = splitUrl('https://x.com/search?q=hello%20world&lang=en&flag');
    expect(base).toBe('https://x.com/search');
    expect(params).toEqual([
      { key: 'q', value: 'hello world' },
      { key: 'lang', value: 'en' },
      { key: 'flag', value: '' },
    ]);
  });

  it('splits a bare query string', () => {
    const { base, params } = splitUrl('a=1&b=2');
    expect(base).toBe('');
    expect(params).toHaveLength(2);
  });

  it('rejects garbage input', () => {
    expect(() => splitUrl('https://x.com/a b c')).toThrow();
  });

  it('rebuilds a URL from base + params', () => {
    expect(buildUrl('https://x.com/s', [
      { key: 'q', value: 'a b' },
      { key: 'lang', value: 'en' },
    ])).toBe('https://x.com/s?q=a%20b&lang=en');
    expect(buildUrl('https://x.com/s', [])).toBe('https://x.com/s');
  });

  it('round-trips split -> build', () => {
    const url = 'https://x.com/s?q=hello%20world&n=42';
    const { base, params } = splitUrl(url);
    expect(buildUrl(base, params)).toBe(url);
  });
});
