import { useState } from 'react';
import { describeCron, nextRuns } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

const PRESETS: Array<[string, string]> = [
  ['Every minute', '* * * * *'],
  ['Every 15 min (work hours)', '*/15 9-17 * * MON-FRI'],
  ['Daily 9:00', '0 9 * * *'],
  ['Weekly Monday', '0 9 * * MON'],
  ['Monthly 1st', '0 8 1 * *'],
];

export function CronPanel() {
  const [expr, setExpr] = useState('*/15 9-17 * * MON-FRI');
  const [error, setError] = useState<string | undefined>();
  const [summary, setSummary] = useState('');
  const [runs, setRuns] = useState<Date[]>([]);

  const run = () => {
    setError(undefined);
    try {
      setSummary(describeCron(expr));
      setRuns(nextRuns(expr, new Date(), 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed');
      setSummary('');
      setRuns([]);
    }
  };

  return (
    <UtilShell id="util-cron" color="#38bdf8" title="⏰ Cron Parser">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Cron expression (min hour day month weekday)</label>
          <textarea className="fmt-textarea" rows={2} value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="*/15 9-17 * * MON-FRI" spellCheck={false} />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={run}>Parse</button>
            <button className="fmt-btn" onClick={() => { setExpr(''); setSummary(''); setRuns([]); }}>✕ Clear</button>
          </div>
          <div className="fmt-btns">
            {PRESETS.map(([label, value]) => (
              <button key={value} className="fmt-btn" onClick={() => setExpr(value)}>{label}</button>
            ))}
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>Summary</label>
          <OutBox value={summary} minHeight={40} />
          <label>Next 5 runs (your timezone)</label>
          <OutBox value={runs.map((d) => d.toLocaleString()).join('\n')} minHeight={120} />
          <div className="fmt-btns"><CopyBtn text={runs.map((d) => d.toLocaleString()).join('\n')} /></div>
        </div>
      </div>
    </UtilShell>
  );
}

export default CronPanel;
