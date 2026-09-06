import { describe, expect, it } from 'vitest';
import {
  b64decode, b64encode, cleanWhitespace, convertBase, decodeJwt,
  genUuids, lorem, parseTimeInput, pgTimeSnippets, textStats,
} from '../lib/devtools';

describe('parseTimeInput', () => {
  it('parses epoch seconds with IST conversion', () => {
    const r = parseTimeInput('1718445600');
    expect(r.ok).toBe(true);
    expect(r.ist).toBe('2024-06-15 15:30:00 IST');
    expect(r.epochS).toBe(1718445600);
    expect(r.epochMs).toBe(1718445600000);
  });
  it('parses epoch milliseconds and ISO strings', () => {
    expect(parseTimeInput('1718445600000').epochS).toBe(1718445600);
    expect(parseTimeInput('2024-06-15').ok).toBe(true);
  });
  it('rejects garbage', () => {
    expect(parseTimeInput('').ok).toBe(false);
    expect(parseTimeInput('not a date').ok).toBe(false);
  });
  it('builds a 2-line Postgres snippet', () => {
    const s = pgTimeSnippets(1718445600);
    expect(s).toContain("to_timestamp(1718445600)");
    expect(s).toContain('Asia/Kolkata');
  });
});

describe('codec', () => {
  it('round-trips unicode Base64', () => {
    expect(b64decode(b64encode('héllo✓'))).toBe('héllo✓');
  });
});

describe('decodeJwt', () => {
  const tok = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJleHAiOjE5MDAwMDAwMDB9.sig';
  it('decodes header/payload and flags future expiry as valid', () => {
    const r = decodeJwt(tok);
    expect(r.ok).toBe(true);
    expect(r.expired).toBe(false);
    expect((r.payload as Record<string, string>).sub).toBe('123');
  });
  it('rejects malformed tokens', () => {
    expect(decodeJwt('nope').ok).toBe(false);
    expect(decodeJwt('a.b.c').ok).toBe(false);
  });
  it('flags expired tokens with expiresAt', () => {
    const expired = `eyJhbGciOiJIUzI1NiJ9.${b64encode(JSON.stringify({ sub: '1', exp: 1000 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`;
    const r = decodeJwt(expired);
    expect(r.ok).toBe(true);
    expect(r.expired).toBe(true);
    expect(r.expiresAt).toBeDefined();
  });
});

describe('genUuids', () => {
  it('generates plain 32-char UUIDs', () => {
    const [u] = genUuids(1, 'plain');
    expect(u).toHaveLength(32);
  });
  it('clamps count to 1..200', () => {
    expect(genUuids(0, 'dashes')).toHaveLength(1);
    expect(genUuids(999, 'dashes')).toHaveLength(200);
  });
});

describe('convertBase', () => {
  it('converts hex FF to all bases', () => {
    expect(convertBase('FF', 'hex')).toEqual({
      dec: '255', hex: '0xFF', bin: '0b11111111', oct: '0o377',
    });
  });
  it('converts from dec/bin/oct and handles empty', () => {
    expect(convertBase('255', 'dec').hex).toBe('0xFF');
    expect(convertBase('11111111', 'bin').dec).toBe('255');
    expect(convertBase('377', 'oct').dec).toBe('255');
    expect(convertBase('', 'dec')).toEqual({ dec: '', hex: '', bin: '', oct: '' });
  });
  it('rejects invalid digits', () => {
    expect(convertBase('ZZ', 'hex').error).toMatch(/base-16/);
    expect(convertBase('102', 'bin').error).toMatch(/base-2/);
  });
});

describe('text toolkit', () => {
  it('computes stats', () => {
    expect(textStats('hi there\nyou')).toEqual({ chars: 12, words: 3, lines: 2 });
  });
  it('handles empty input stats', () => {
    expect(textStats('')).toEqual({ chars: 0, words: 0, lines: 0 });
    expect(textStats('   ')).toEqual({ chars: 3, words: 0, lines: 1 });
  });
  it('cleans whitespace and builds lorem', () => {
    expect(cleanWhitespace('a   b\n\n\nc  ')).toBe('a b\n\nc');
    expect(cleanWhitespace('a\t\tb  \n  c')).toBe('a b\n c');
    expect(lorem(2).split('\n\n')).toHaveLength(2);
  });
  it('clamps lorem paragraphs to 1..10', () => {
    expect(lorem(0).split('\n\n')).toHaveLength(1);
    expect(lorem(99).split('\n\n')).toHaveLength(10);
  });
});
