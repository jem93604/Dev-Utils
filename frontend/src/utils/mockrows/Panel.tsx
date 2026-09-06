import { useState } from 'react';
import { generateRows, parseColumnDefs } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

export function MockRowsPanel() {
  const [defs, setDefs] = useState('id:int, name, email, active:bool, created:date');
  const [table, setTable] = useState('users');
  const [count, setCount] = useState(5);
  const [seed, setSeed] = useState(42);
  const [format, setFormat] = useState<'insert' | 'csv'>('insert');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | undefined>();

  const run = () => {
    setError(undefined);
    try {
      const cols = parseColumnDefs(defs);
      const n = Math.max(0, Math.min(1000, Math.floor(count)));
      setOutput(generateRows(cols, n, Math.floor(seed), table.trim() || 'my_table', format).sql);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    }
  };

  return (
    <UtilShell id="util-mockrows" color="#f59e0b" title="🎲 Mock Row Generator">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Columns (name:type, …) — types: int uuid name email date bool lorem text</label>
          <textarea className="fmt-textarea" rows={3} value={defs} onChange={(e) => setDefs(e.target.value)} placeholder="id:int, email" spellCheck={false} />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 2 }}>
              <label>Table</label>
              <input className="input-field" value={table} onChange={(e) => setTable(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Rows</label>
              <input className="input-field" type="number" min={0} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Seed</label>
              <input className="input-field" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
          <div className="fmt-btns">
            <select className="fmt-btn" value={format} onChange={(e) => setFormat(e.target.value as 'insert' | 'csv')}>
              <option value="insert">INSERT statements</option>
              <option value="csv">CSV</option>
            </select>
            <button className="fmt-btn" onClick={run}>Generate</button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>Output (same seed → same rows)</label>
          <OutBox value={output} minHeight={220} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
    </UtilShell>
  );
}

export default MockRowsPanel;
