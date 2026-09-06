import { describe, expect, it } from 'vitest';
import { buildWhere } from './lib';

describe('wherebuilder', () => {
  it('builds a single condition with a param', () => {
    expect(buildWhere([{ logic: 'AND', conditions: [{ column: 'id', op: '=', value: '42' }] }])).toEqual({
      sql: 'WHERE id = $1',
      params: [42],
    });
  });

  it('joins conditions with AND and numbers params', () => {
    const r = buildWhere([{ logic: 'AND', conditions: [
      { column: 'age', op: '>=', value: '18' },
      { column: 'name', op: 'LIKE', value: '%ann%' },
    ] }]);
    expect(r.sql).toBe('WHERE age >= $1 AND name LIKE $2');
    expect(r.params).toEqual([18, '%ann%']);
  });

  it('wraps OR groups in parens', () => {
    const r = buildWhere([
      { logic: 'AND', conditions: [{ column: 'active', op: '=', value: 'true' }] },
      { logic: 'OR', conditions: [
        { column: 'role', op: '=', value: 'admin' },
        { column: 'role', op: '=', value: 'owner' },
      ] },
    ]);
    expect(r.sql).toBe('WHERE active = $1 AND (role = $2 OR role = $3)');
    expect(r.params).toEqual([true, 'admin', 'owner']);
  });

  it('handles IN lists and NULL checks without params', () => {
    const r = buildWhere([{ logic: 'AND', conditions: [
      { column: 'id', op: 'IN', value: '1, 2, 3' },
      { column: 'deleted_at', op: 'IS NULL', value: '' },
    ] }]);
    expect(r.sql).toBe('WHERE id IN ($1, $2, $3) AND deleted_at IS NULL');
    expect(r.params).toEqual([1, 2, 3]);
  });

  it('respects a starting param index', () => {
    const r = buildWhere([{ logic: 'AND', conditions: [{ column: 'id', op: '=', value: '7' }] }], 3);
    expect(r.sql).toBe('WHERE id = $3');
  });

  it('returns empty for no conditions', () => {
    expect(buildWhere([])).toEqual({ sql: '', params: [] });
    expect(buildWhere([{ logic: 'AND', conditions: [] }])).toEqual({ sql: '', params: [] });
  });

  it('rejects bad column names', () => {
    expect(() => buildWhere([{ logic: 'AND', conditions: [{ column: 'a; DROP', op: '=', value: '1' }] }])).toThrow();
    expect(() => buildWhere([{ logic: 'AND', conditions: [{ column: '', op: '=', value: '1' }] }])).toThrow();
  });
});
