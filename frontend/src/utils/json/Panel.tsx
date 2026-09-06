import { useState } from 'react';
import { CopyBtn, ErrMsg as Err, OutBox as Out, UtilShell as Shell } from '../ui';

function buildAccessors(obj: unknown, path: string[]): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: string[] = [];
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const trail = [...path, k];
    const nav = `data${trail.map((p) => ` -> '${p}'`).join('')}`;
    const navText = `data${trail.map((p) => ` ->> '${p}'`).join('')}`;
    out.push(nav, navText);
    const v = (obj as Record<string, unknown>)[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...buildAccessors(v, trail));
    }
  }
  return out;
}

export function JsonPanel() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [accessors, setAccessors] = useState<string[]>([]);

  const run = (mode: 'pretty' | 'min') => {
    try {
      const obj = JSON.parse(input);
      setOutput(mode === 'pretty' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
      setAccessors(buildAccessors(obj, []).slice(0, 30));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <Shell id="util-json" color="#66d9ef" title="🧾 JSON Formatter">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>JSON input</label>
          <textarea className="fmt-textarea" style={{ minHeight: 180 }} value={input}
            onChange={(e) => setInput(e.target.value)} placeholder='{"a": 1}' />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={() => run('pretty')}>Pretty</button>
            <button className="fmt-btn" onClick={() => run('min')}>Minify</button>
            <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); setAccessors([]); setError(''); }}>✕ Clear</button>
          </div>
          <Err msg={error} />
        </div>
        <div className="fmt-col">
          <label>Output</label>
          <Out value={output} minHeight={180} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
      {accessors.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 5 }}>
            Postgres accessors
          </label>
          <Out value={accessors.join('\n')} />
          <div className="fmt-btns"><CopyBtn text={accessors.join('\n')} /></div>
        </div>
      )}
    </Shell>
  );
}

export default JsonPanel;
