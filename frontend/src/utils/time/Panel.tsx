import { useMemo, useState } from 'react';
import { parseTimeInput, pgTimeSnippets } from '../../lib/devtools';
import { CopyBtn, ErrMsg as Err, OutBox as Out, UtilShell as Shell } from '../ui';

export function TimePanel() {
  const [input, setInput] = useState('');
  const r = useMemo(() => parseTimeInput(input), [input]);
  const rows: [string, string][] = r.ok
    ? [
      ['ISO', r.iso!], ['IST', r.ist!], ['UTC', r.utc!],
      ['Local', r.local!], ['Epoch (s)', String(r.epochS!)],
      ['Epoch (ms)', String(r.epochMs!)], ['Relative', r.relative!],
    ]
    : [];
  return (
    <Shell id="util-time" color="#e6db74" title="🕒 Time Converter">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Epoch or date string</label>
          <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="1718445600  •  1718445600000  •  2024-06-15 10:30" />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now (epoch)</button>
            <button className="fmt-btn" onClick={() => { setInput(''); }}>✕ Clear</button>
          </div>
          <Err msg={input.trim() ? r.error : undefined} />
        </div>
        <div className="fmt-col">
          <label>Converted</label>
          <Out value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} minHeight={140} />
          <div className="fmt-btns"><CopyBtn text={rows.map(([, v]) => v).join('\n')} /></div>
        </div>
      </div>
      {r.ok && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 5 }}>
            Postgres snippet
          </label>
          <Out value={pgTimeSnippets(r.epochS!)} />
          <div className="fmt-btns"><CopyBtn text={pgTimeSnippets(r.epochS!)} /></div>
        </div>
      )}
    </Shell>
  );
}

export default TimePanel;
