import { useMemo, useState } from 'react';
import { convertBase } from '../../lib/devtools';
import { Field } from '../../components/ui';
import { CopyBtn, ErrMsg as Err, UtilShell as Shell } from '../ui';

type Base = 'dec' | 'hex' | 'bin' | 'oct';

export function BasePanel() {
  const [from, setFrom] = useState<Base>('dec');
  const [value, setValue] = useState('');
  const r = useMemo(() => convertBase(value, from), [value, from]);
  const fields: [Base, string][] = [['dec', r.dec], ['hex', r.hex], ['bin', r.bin], ['oct', r.oct]];
  return (
    <Shell id="util-base" color="#57a8c4" title="🔢 Number Base Converter">
      <div className="fmt-btns" style={{ marginBottom: 10 }}>
        {(['dec', 'hex', 'bin', 'oct'] as Base[]).map((b) => (
          <button key={b} className="fmt-btn" onClick={() => setFrom(b)}
            style={from === b ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>
            from {b}
          </button>
        ))}
      </div>
      <Field label={`Input (base ${from})`}>
        <input className="input-field" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={from === 'hex' ? '0xFF' : from === 'bin' ? '0b1010' : from === 'oct' ? '0o17' : '255'}
          style={{ fontFamily: "'JetBrains Mono',monospace" }} />
      </Field>
      <Err msg={r.error} />
      <div className="fmt-grid" style={{ marginTop: 8 }}>
        {fields.map(([b, v]) => (
          <div className="fmt-col" key={b} style={{ marginBottom: 8 }}>
            <label>{b}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input-field" readOnly value={v} style={{ fontFamily: "'JetBrains Mono',monospace" }} />
              <CopyBtn text={v} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export default BasePanel;
