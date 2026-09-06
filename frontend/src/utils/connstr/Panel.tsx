import { useState } from 'react';
import { parseConnStr } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

export function ConnStrPanel() {
  const [input, setInput] = useState('postgresql://app:s3cret@db.internal:5433/mydb?sslmode=require');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | undefined>();

  const run = () => {
    setError(undefined);
    try {
      const c = parseConnStr(input);
      const rows: Array<[string, string]> = [
        ['kind', c.kind],
        ['scheme', c.scheme],
      ];
      if (c.kind === 'postgres') {
        rows.push(
          ['user', c.user || '(none)'],
          ['password', c.hasPassword ? '(set — never shown)' : '(not set)'],
          ['host', c.host],
          ['port', String(c.port)],
          ['database', c.database],
        );
        for (const [k, v] of Object.entries(c.params)) rows.push([`param ${k}`, v]);
      } else {
        rows.push(['path', c.database]);
      }
      const width = Math.max(...rows.map(([k]) => k.length));
      setOutput(rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`).join('\n'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed');
      setOutput('');
    }
  };

  return (
    <UtilShell id="util-connstr" color="#34d399" title="🔌 Connection-String Parser">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Database URL (parsed locally — nothing leaves your browser)</label>
          <textarea className="fmt-textarea" rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="postgresql://user:pass@host:5432/db" spellCheck={false} />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={run}>Parse</button>
            <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); }}>✕ Clear</button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>Breakdown</label>
          <OutBox value={output} minHeight={180} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
    </UtilShell>
  );
}

export default ConnStrPanel;
