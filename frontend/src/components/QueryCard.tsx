// QueryCard + InputPanel + SqlView. Reuses .query-card / .input-panel / .code-block theme.
import { useMemo, useState } from 'react';
import type { Query, Section } from '../lib/api';
import { detectTags, renderSql, substitute } from '../lib/sql';
import { QButton, QTag, toast } from './ui';

function InputPanel({
  q, vals, onChange, onClear,
}: {
  q: Query; vals: Record<string, string>;
  onChange: (k: string, v: string) => void; onClear: () => void;
}) {
  if (!q.variables.length) return null;
  const filled = q.variables.filter((k) => vals[k]?.trim()).length;
  return (
    <div className="input-panel" style={{ margin: '10px 15px 0', borderRadius: 7 }}>
      <div className="input-panel-header">
        <div className="input-panel-title">🔑 Input Values</div>
      </div>
      <div className="inputs-grid">
        {q.variables.map((k) => (
          <div className="input-item" key={k}>
            <label className="input-label">{`{{${k}}}`}</label>
            <input
              className={`input-field${vals[k]?.trim() ? ' has-value' : ''}`}
              placeholder={k}
              value={vals[k] ?? ''}
              onChange={(e) => onChange(k, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="input-panel-footer">
        <button className="btn-clear-all" onClick={onClear}>✕ Clear All</button>
        <div className="fill-status"><span>{filled}</span>/{q.variables.length} filled</div>
      </div>
    </div>
  );
}

export function QueryCard({
  q, section, onTogglePin,
}: {
  q: Query; section?: Section; onTogglePin?: (q: Query) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const tags = useMemo(() => detectTags(q.sql_text), [q.sql_text]);
  const steps = useMemo(() => q.steps.split('\n').filter(Boolean), [q.steps]);
  const html = useMemo(() => renderSql(q.sql_text, vals), [q.sql_text, vals]);

  const copy = async () => {
    await navigator.clipboard.writeText(substitute(q.sql_text, vals));
    toast('Query copied to clipboard');
  };

  return (
    <div className={`query-card${open ? ' open' : ''}`}>
      <div className="qcard-header" onClick={() => setOpen((o) => !o)}>
        <span className="qcard-chevron">▶</span>
        <div className="qcard-title">{q.title}</div>
        <div className="qcard-tags">
          {tags.map((t) => <QTag key={t} kind={t.toLowerCase()}>{t}</QTag>)}
          {q.pinned && <QTag kind="pin">📌</QTag>}
          {section && (
            <span className="qtag" style={{ background: `${section.color}20`, color: section.color, border: `1px solid ${section.color}30`, fontSize: '.55rem' }}>
              {section.name}
            </span>
          )}
        </div>
        <div className="qcard-actions" onClick={(e) => e.stopPropagation()}>
          <button className={`qbtn-pin${q.pinned ? ' pinned' : ''}`} title={q.pinned ? 'Unpin' : 'Pin to Home'} onClick={() => onTogglePin?.(q)}>📌</button>
          <QButton accent="copy" onClick={copy}>⎘ Copy</QButton>
        </div>
      </div>
      <div className="qcard-body">
        {q.purpose && (
          <div className="qcard-purpose">
            <div className="qcard-purpose-text">
              <span className="qcard-purpose-label">Purpose</span>{q.purpose}
            </div>
          </div>
        )}
        {steps.length > 0 && (
          <div className="qcard-steps">
            <div className="qcard-steps-inner">
              <div className="qcard-steps-label">Steps</div>
              <div className="steps-list">
                {steps.map((l, i) => (
                  <div className="step-item" key={i}>
                    <div className="step-num">{i + 1}</div>
                    <div className="step-text">{l.replace(/^\d+\.\s*/, '')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <InputPanel
          q={q} vals={vals}
          onChange={(k, v) => setVals((p) => ({ ...p, [k]: v }))}
          onClear={() => setVals({})}
        />
        <div className="code-block" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="code-copy-bar">
          <span className="code-copy-label">SQL / Code</span>
          <button className="btn-copy-code" onClick={copy}>⎘ Copy Query</button>
        </div>
      </div>
    </div>
  );
}
