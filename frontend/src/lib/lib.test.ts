import { describe, expect, it } from 'vitest';
import { diffLines, formatData } from '../lib/format';
import { detectTags, extractVariables, renderSql, substitute } from '../lib/sql';
import { fuzzy } from '../lib/fuzzy';
import { UTIL_COMPONENTS, UTIL_META_PATCH, utilBySlug } from '../lib/utils-registry';
import { timeUtil } from '../utils/time';

describe('sql helpers', () => {
  it('extracts {{variables}} in order, deduplicated', () => {
    expect(extractVariables("a '{{x}}' b '{{y}}' c '{{x}}'")).toEqual(['x', 'y']);
    expect(extractVariables('no vars')).toEqual([]);
  });

  it('substitutes all occurrences', () => {
    expect(substitute('{{a}}-{{a}}-{{b}}', { a: '1', b: '2' })).toBe('1-1-2');
    expect(substitute('{{a}}', {})).toBe('{{a}}');
  });

  it('detects SELECT/UPDATE/DELETE/BEGIN tags', () => {
    expect(detectTags('select 1')).toEqual(['SELECT']);
    expect(detectTags('BEGIN; DELETE FROM t;')).toEqual(['DELETE', 'BEGIN']);
    expect(detectTags('-- comment')).toEqual([]);
  });

  it('escapes HTML in renderSql to prevent injection', () => {
    const out = renderSql('<script>alert(1)</script> SELECT', {});
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('<span class="kw">SELECT</span>');
  });

  it('highlights injected values and unfilled placeholders', () => {
    const out = renderSql('SELECT {{col}}', { col: 'name' });
    expect(out).toContain('<span class="var-highlight">name</span>');
    const unfilled = renderSql('SELECT {{col}}', {});
    expect(unfilled).toContain('{{col}}');
  });
});

describe('formatData', () => {
  const raw = 'b\n a ,b ,,c ';
  it('builds SQL lists', () => {
    expect(formatData(raw, 'sql').output).toBe(`'b','a','b','c'`);
  });
  it('dedups with a note', () => {
    const r = formatData(raw, 'dedup');
    expect(r.output).toBe('b\na\nc');
    expect(r.note).toMatch(/1 duplicates removed/);
  });
  it('counts and cases', () => {
    expect(formatData(raw, 'count').output).toBe('Total: 4 items');
    expect(formatData(raw, 'csv').output).toBe('b,a,b,c');
    expect(formatData(raw, 'lines').output).toBe('b\na\nb\nc');
    expect(formatData('  a   b  ', 'trim').output).toBe('a b');
    expect(formatData('aBc', 'upper').output).toBe('ABC');
    expect(formatData('aBc', 'lower').output).toBe('abc');
  });
});

describe('diffLines', () => {
  it('marks same/added/removed lines', () => {
    const out = diffLines('a\nb', 'a\nc');
    expect(out).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'c' },
    ]);
  });
});

describe('fuzzy', () => {
  const items = [{ t: 'Time Converter' }, { t: 'JSON Formatter' }, { t: 'JWT Decoder' }];
  const key = (x: { t: string }) => x.t;
  it('returns everything on empty query', () => {
    expect(fuzzy('', items, key)).toHaveLength(3);
  });
  it('matches subsequences, best first', () => {
    expect(fuzzy('tm', items, key).map((x) => x.t)).toEqual(['Time Converter']);
    expect(fuzzy('json', items, key).map((x) => x.t)).toEqual(['JSON Formatter']);
  });
  it('returns empty on no match', () => {
    expect(fuzzy('zzz', items, key)).toEqual([]);
  });
});

describe('pluggable utils pilot (time)', () => {
  it('registry metadata stays in sync with the time module', () => {
    expect(utilBySlug('time')?.route).toBe('/utils/time');
    expect(timeUtil.slug).toBe('time');
    expect(timeUtil.route).toBe('/utils/time');
  });
  it('exposes a lazy component and category metadata', () => {
    expect(UTIL_COMPONENTS.time).toBe(timeUtil.component);
    expect(UTIL_META_PATCH.time.category).toBe('time');
    expect(UTIL_META_PATCH.time.keywords.length).toBeGreaterThan(0);
  });
});
