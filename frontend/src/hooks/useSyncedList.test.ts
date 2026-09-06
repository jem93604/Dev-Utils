import { describe, expect, it } from 'vitest';
import { resolveSyncedList } from './useSyncedList';

describe('resolveSyncedList', () => {
  it('server wins when it has a value', () => {
    expect(resolveSyncedList(['a'], ['b', 'c'])).toEqual({ value: ['b', 'c'], pushUp: false });
  });

  it('pushes local up when server is empty', () => {
    expect(resolveSyncedList(['a'], [])).toEqual({ value: ['a'], pushUp: true });
  });

  it('keeps local when both empty', () => {
    expect(resolveSyncedList([], [])).toEqual({ value: [], pushUp: false });
  });

  it('keeps local when server never stored the key', () => {
    expect(resolveSyncedList(['a'], undefined)).toEqual({ value: ['a'], pushUp: false });
  });
});
