import { describe, expect, it } from 'vitest';
import { formatSql } from './lib';

describe('sqlformat', () => {
  it('uppercases keywords and breaks major clauses', () => {
    expect(formatSql('select a, b from users where id = 1')).toBe(
      'SELECT a, b\nFROM users\nWHERE id = 1',
    );
  });

  it('indents AND/OR conditions', () => {
    expect(formatSql('select * from t where a = 1 and b = 2 or c = 3')).toBe(
      'SELECT *\nFROM t\nWHERE a = 1\n  AND b = 2\n  OR c = 3',
    );
  });

  it('handles joins and ordering', () => {
    expect(formatSql('select u.name, o.total from users u left join orders o on o.user_id = u.id order by o.total desc limit 10')).toBe(
      'SELECT u.name, o.total\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nORDER BY o.total DESC\nLIMIT 10',
    );
  });

  it('leaves string literals and comments untouched', () => {
    expect(formatSql("select 'from where' as s from t -- and a comment\nwhere x = 'a,b'")).toBe(
      "SELECT 'from where' AS s\nFROM t -- and a comment\nWHERE x = 'a,b'",
    );
  });

  it('collapses whitespace and trims', () => {
    expect(formatSql('  SELECT   *\n\n  FROM   t  ')).toBe('SELECT *\nFROM t');
  });

  it('supports lowercase mode', () => {
    expect(formatSql('SELECT A FROM T', { uppercase: false })).toBe('select A\nfrom T');
  });

  it('formats insert statements', () => {
    expect(formatSql("insert into users (name, email) values ('a', 'b')")).toBe(
      "INSERT INTO users (name, email)\nVALUES ('a', 'b')",
    );
  });

  it('returns empty for empty input', () => {
    expect(formatSql('   ')).toBe('');
  });
});
