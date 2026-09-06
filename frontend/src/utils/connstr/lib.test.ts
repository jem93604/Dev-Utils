import { describe, expect, it } from 'vitest';
import { parseConnStr } from './lib';

describe('connstr', () => {
  it('parses a full postgres URL', () => {
    const c = parseConnStr('postgresql://app:s3cret@db.internal:5433/mydb?sslmode=require&connect_timeout=10');
    expect(c).toMatchObject({
      kind: 'postgres', user: 'app', host: 'db.internal', port: 5433, database: 'mydb',
    });
    expect(c.hasPassword).toBe(true);
    expect(c.params).toEqual({ sslmode: 'require', connect_timeout: '10' });
  });

  it('never exposes the password value', () => {
    const c = parseConnStr('postgresql://app:s3cret@localhost/db');
    expect(JSON.stringify(c)).not.toContain('s3cret');
  });

  it('defaults the postgres port', () => {
    const c = parseConnStr('postgres://bob@127.0.0.1/shop');
    expect(c.port).toBe(5432);
    expect(c.hasPassword).toBe(false);
  });

  it('parses sqlite paths', () => {
    const c = parseConnStr('sqlite:///./sqlhub.db');
    expect(c).toMatchObject({ kind: 'sqlite', database: './sqlhub.db' });
    const abs = parseConnStr('sqlite:////var/data/app.db');
    expect(abs.database).toBe('/var/data/app.db');
  });

  it('rejects garbage', () => {
    expect(() => parseConnStr('')).toThrow();
    expect(() => parseConnStr('not a url at all')).toThrow();
    expect(() => parseConnStr('mysql://x@y/z')).toThrow();
    expect(() => parseConnStr('postgresql:///')).toThrow();
  });
});
