import { describe, expect, it } from 'vitest';
import { hashDjb2, hashFnv1a } from './lib';

describe('hash utils', () => {
  it('djb2 is deterministic', () => {
    expect(hashDjb2('hello')).toBe(hashDjb2('hello'));
    expect(hashDjb2('hello')).not.toBe(hashDjb2('world'));
  });

  it('fnv1a is deterministic', () => {
    expect(hashFnv1a('hello')).toBe(hashFnv1a('hello'));
    expect(hashFnv1a('hello')).not.toBe(hashFnv1a('world'));
  });

  it('empty string vectors', () => {
    expect(hashDjb2('')).toBe('00001505');
    expect(hashFnv1a('')).toBe('811c9dc5');
  });
});
