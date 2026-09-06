import { describe, expect, it } from 'vitest';
import { generateRows, parseColumnDefs, type ColumnDef } from './lib';

describe('mockrows', () => {
  it('parses column definitions', () => {
    expect(parseColumnDefs('id:int, email, created:date')).toEqual([
      { name: 'id', type: 'int' },
      { name: 'email', type: 'email' },
      { name: 'created', type: 'date' },
    ]);
  });

  it('defaults bare names sensibly', () => {
    expect(parseColumnDefs('name')).toEqual([{ name: 'name', type: 'name' }]);
    expect(parseColumnDefs('user_id')).toEqual([{ name: 'user_id', type: 'int' }]);
    expect(parseColumnDefs('is_active')).toEqual([{ name: 'is_active', type: 'bool' }]);
  });

  it('rejects bad definitions', () => {
    expect(() => parseColumnDefs('')).toThrow();
    expect(() => parseColumnDefs('id:nope')).toThrow();
    expect(() => parseColumnDefs('123abc:int')).toThrow();
  });

  it('generates deterministic rows with a seed', () => {
    const cols: ColumnDef[] = [{ name: 'id', type: 'int' }, { name: 'email', type: 'email' }];
    expect(generateRows(cols, 3, 7)).toEqual(generateRows(cols, 3, 7));
    expect(generateRows(cols, 3, 7)).not.toEqual(generateRows(cols, 3, 8));
  });

  it('generates the requested row count', () => {
    const cols: ColumnDef[] = [{ name: 'id', type: 'int' }];
    expect(generateRows(cols, 5, 1).rows).toHaveLength(5);
    expect(generateRows(cols, 0, 1).rows).toHaveLength(0);
  });

  it('renders INSERT statements', () => {
    const cols: ColumnDef[] = [{ name: 'id', type: 'int' }, { name: 'active', type: 'bool' }];
    const { sql } = generateRows(cols, 2, 1, 'users', 'insert');
    expect(sql).toMatch(/^INSERT INTO users \(id, active\) VALUES\n/m);
    expect(sql).toMatch(/\);$/);
    expect(sql.split('\n')).toHaveLength(3);
  });

  it('renders CSV with a header', () => {
    const cols: ColumnDef[] = [{ name: 'id', type: 'int' }];
    const { sql } = generateRows(cols, 2, 1, 't', 'csv');
    const lines = sql.split('\n');
    expect(lines[0]).toBe('id');
    expect(lines).toHaveLength(3);
  });

  it('emits balanced quotes', () => {
    const cols: ColumnDef[] = [{ name: 'note', type: 'lorem' }];
    const { sql } = generateRows(cols, 20, 1, 't', 'insert');
    const quotes = (sql.match(/'/g) ?? []).length;
    expect(quotes % 2).toBe(0);
  });
});
