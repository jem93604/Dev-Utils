import { useState } from 'react';
import { genUuids, type UuidFormat } from '../../lib/devtools';
import { CopyBtn, OutBox as Out, UtilShell as Shell } from '../ui';

export function UuidPanel() {
  const [count, setCount] = useState(5);
  const [format, setFormat] = useState<UuidFormat>('dashes');
  const [list, setList] = useState<string[]>([]);
  return (
    <Shell id="util-uuid" color="#f92672" title="🆔 UUID Generator">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: '.72rem', color: 'var(--text2)' }}>Count</label>
        <input className="input-field" type="number" min={1} max={200} value={count}
          onChange={(e) => setCount(Number(e.target.value))} style={{ width: 90 }} />
        {(['dashes', 'plain', 'upper'] as UuidFormat[]).map((f) => (
          <button key={f} className="fmt-btn" onClick={() => setFormat(f)}
            style={format === f ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>{f}</button>
        ))}
        <button className="fmt-btn" onClick={() => setList(genUuids(count, format))}>Generate</button>
        <CopyBtn text={list.join('\n')} />
      </div>
      <Out value={list.join('\n')} minHeight={150} />
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 5 }}>
          Postgres
        </label>
        <Out value="SELECT gen_random_uuid();" />
      </div>
    </Shell>
  );
}

export default UuidPanel;
