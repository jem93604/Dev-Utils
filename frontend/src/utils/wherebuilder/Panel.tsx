import { useMemo, useState } from 'react';
import { buildWhere, COND_OPS, type CondOp, type WhereGroup } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

const blankGroup = (): WhereGroup => ({ logic: 'AND', conditions: [{ column: '', op: '=', value: '' }] });

export function WhereBuilderPanel() {
  const [groups, setGroups] = useState<WhereGroup[]>([blankGroup()]);

  const { result, error } = useMemo(() => {
    try {
      const cleaned = groups
        .map((g) => ({ ...g, conditions: g.conditions.filter((c) => c.column.trim() !== '') }))
        .filter((g) => g.conditions.length > 0);
      return { result: buildWhere(cleaned), error: undefined as string | undefined };
    } catch (e) {
      return { result: { sql: '', params: [] as unknown[] }, error: e instanceof Error ? e.message : 'Build failed' };
    }
  }, [groups]);

  const patch = (gi: number, ci: number, field: 'column' | 'op' | 'value', v: string) => {
    setGroups((prev) => prev.map((g, i) => (i === gi
      ? { ...g, conditions: g.conditions.map((c, j) => (j === ci ? { ...c, [field]: field === 'op' ? (v as CondOp) : v } : c)) }
      : g)));
  };

  return (
    <UtilShell id="util-wherebuilder" color="#f472b6" title="🧱 WHERE Builder">
      <div className="fmt-grid">
        <div className="fmt-col">
          {groups.map((g, gi) => (
            <div key={gi} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Group logic</label>
                <select className="fmt-btn" value={g.logic} onChange={(e) => setGroups((prev) => prev.map((gg, i) => (i === gi ? { ...gg, logic: e.target.value as 'AND' | 'OR' } : gg)))}>
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <button className="fmt-btn" onClick={() => setGroups((prev) => prev.filter((_, i) => i !== gi))}>✕ Group</button>
              </div>
              {g.conditions.map((c, ci) => (
                <div key={ci} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input-field" value={c.column} onChange={(e) => patch(gi, ci, 'column', e.target.value)} placeholder="column" style={{ flex: 2 }} />
                  <select className="fmt-btn" value={c.op} onChange={(e) => patch(gi, ci, 'op', e.target.value)}>
                    {COND_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  {!['IS NULL', 'IS NOT NULL'].includes(c.op) && (
                    <input className="input-field" value={c.value} onChange={(e) => patch(gi, ci, 'value', e.target.value)} placeholder="value (a, b for IN)" style={{ flex: 2 }} />
                  )}
                  <button className="fmt-btn" onClick={() => setGroups((prev) => prev.map((gg, i) => (i === gi ? { ...gg, conditions: gg.conditions.filter((_, j) => j !== ci) } : gg)))}>✕</button>
                </div>
              ))}
              <button className="fmt-btn" onClick={() => setGroups((prev) => prev.map((gg, i) => (i === gi ? { ...gg, conditions: [...gg.conditions, { column: '', op: '=' as CondOp, value: '' }] } : gg)))}>+ Condition</button>
            </div>
          ))}
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={() => setGroups((prev) => [...prev, blankGroup()])}>+ Group (AND)</button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>SQL (live, Postgres $n params)</label>
          <OutBox value={result.sql} minHeight={80} />
          <div className="fmt-btns"><CopyBtn text={result.sql} /></div>
          <label>Params (JSON)</label>
          <OutBox value={result.params.length > 0 ? JSON.stringify(result.params) : ''} minHeight={60} />
          <div className="fmt-btns"><CopyBtn text={JSON.stringify(result.params)} /></div>
        </div>
      </div>
    </UtilShell>
  );
}

export default WhereBuilderPanel;
