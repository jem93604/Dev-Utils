import { useState } from 'react';
import { formatSql } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

export function SqlFormatPanel() {
  const [input, setInput] = useState('select u.name, o.total from users u left join orders o on o.user_id = u.id where o.total > 100 order by o.total desc limit 10');
  const [uppercase, setUppercase] = useState(true);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | undefined>();

  const run = () => {
    setError(undefined);
    try {
      setOutput(formatSql(input, { uppercase }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Format failed');
    }
  };

  return (
    <UtilShell id="util-sqlformat" color="#a78bfa" title="✨ SQL Formatter">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>SQL</label>
          <textarea className="fmt-textarea" rows={8} value={input} onChange={(e) => setInput(e.target.value)} placeholder="select * from users where id = 1" spellCheck={false} />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={run}>Format</button>
            <button className="fmt-btn" onClick={() => setUppercase((u) => !u)}>{uppercase ? 'Keywords: UPPER' : 'Keywords: lower'}</button>
            <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); }}>✕ Clear</button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>Formatted</label>
          <OutBox value={output} minHeight={200} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
    </UtilShell>
  );
}

export default SqlFormatPanel;
