import { describe, expect, it } from 'vitest';
import { orderUtilSlugs } from './useUtilOrder';

describe('orderUtilSlugs', () => {
  it('returns registry order when nothing stored', () => {
    expect(orderUtilSlugs(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });

  it('applies a stored custom order', () => {
    expect(orderUtilSlugs(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('drops unknown slugs from stored order', () => {
    expect(orderUtilSlugs(['a', 'b'], ['b', 'zzz', 'a'])).toEqual(['b', 'a']);
  });

  it('appends newly added utils at the end', () => {
    expect(orderUtilSlugs(['a', 'b', 'c'], ['b', 'a'])).toEqual(['b', 'a', 'c']);
  });
});
