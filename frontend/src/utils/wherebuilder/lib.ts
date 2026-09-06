// WHERE-clause builder: structured conditions -> parameterized SQL + params.
// Placeholders are Postgres-style ($1, $2, ...); startParam offsets numbering.

export type CondOp =
  | '=' | '!=' | '>' | '>=' | '<' | '<='
  | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';

export const COND_OPS: CondOp[] = [
  '=', '!=', '>', '>=', '<', '<=', 'LIKE', 'ILIKE', 'IN', 'IS NULL', 'IS NOT NULL',
];

export type GroupLogic = 'AND' | 'OR';

export interface Condition {
  column: string;
  op: CondOp;
  value: string;
}

export interface WhereGroup {
  logic: GroupLogic;
  conditions: Condition[];
}

function checkColumn(column: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(column)) {
    throw new Error(`Bad column name "${column}"`);
  }
}

function coerce(raw: string): unknown {
  const v = raw.trim();
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  if (v.toLowerCase() === 'true') return true;
  if (v.toLowerCase() === 'false') return false;
  return v;
}

export function buildWhere(groups: WhereGroup[], startParam = 1): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  let n = startParam;
  const parts: string[] = [];

  for (const g of groups) {
    const conds: string[] = [];
    for (const c of g.conditions) {
      checkColumn(c.column);
      if (c.op === 'IS NULL' || c.op === 'IS NOT NULL') {
        conds.push(`${c.column} ${c.op}`);
      } else if (c.op === 'IN') {
        const items = c.value.split(',').map((s) => s.trim()).filter((s) => s !== '');
        if (items.length === 0) throw new Error(`IN needs at least one value (${c.column})`);
        const holes = items.map((item) => {
          params.push(coerce(item));
          return `$${n++}`;
        });
        conds.push(`${c.column} IN (${holes.join(', ')})`);
      } else {
        params.push(coerce(c.value));
        conds.push(`${c.column} ${c.op} $${n++}`);
      }
    }
    if (conds.length === 0) continue;
    // Single-condition groups stay flat; multi-condition OR groups get parens.
    parts.push(conds.length > 1 && g.logic === 'OR' ? `(${conds.join(' OR ')})` : conds.join(` ${g.logic} `));
  }

  if (parts.length === 0) return { sql: '', params: [] };
  // Groups always join with AND; a group's logic joins its own conditions.
  return { sql: `WHERE ${parts.join(' AND ')}`, params };
}
