import { describe, expect, it } from 'vitest';
import { formatNoteDate, noteExcerpt, noteWordCount } from './notes';

describe('noteExcerpt', () => {
  it('collapses whitespace and trims', () => {
    expect(noteExcerpt('  hello\n\n  world  ')).toBe('hello world');
  });
  it('returns short content unchanged', () => {
    expect(noteExcerpt('abc')).toBe('abc');
  });
  it('truncates long content with an ellipsis', () => {
    const out = noteExcerpt('a'.repeat(200), 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });
  it('handles empty content', () => {
    expect(noteExcerpt('')).toBe('');
  });
});

describe('formatNoteDate', () => {
  const now = new Date('2026-09-12T12:00:00Z').getTime();
  it('says just now for fresh timestamps', () => {
    expect(formatNoteDate('2026-09-12T11:59:30Z', now)).toBe('just now');
  });
  it('uses minutes / hours / days', () => {
    expect(formatNoteDate('2026-09-12T11:30:00Z', now)).toBe('30m ago');
    expect(formatNoteDate('2026-09-12T09:00:00Z', now)).toBe('3h ago');
    expect(formatNoteDate('2026-09-09T12:00:00Z', now)).toBe('3d ago');
  });
  it('falls back to the locale date for old timestamps', () => {
    expect(formatNoteDate('2026-01-01T00:00:00Z', now)).toBe(
      new Date('2026-01-01T00:00:00Z').toLocaleDateString(),
    );
  });
  it('handles missing / invalid input', () => {
    expect(formatNoteDate(undefined, now)).toBe('');
    expect(formatNoteDate('bogus', now)).toBe('');
  });
});

describe('noteWordCount', () => {
  it('counts words across whitespace', () => {
    expect(noteWordCount('hello world')).toBe(2);
    expect(noteWordCount('')).toBe(0);
    expect(noteWordCount('  a\n b\tc ')).toBe(3);
  });
});
