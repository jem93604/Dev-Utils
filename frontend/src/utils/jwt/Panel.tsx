import { useMemo, useState } from 'react';
import { decodeJwt } from '../../lib/devtools';
import { Field } from '../../components/ui';
import { ErrMsg as Err, OutBox as Out, UtilShell as Shell } from '../ui';

export function JwtPanel() {
  const [input, setInput] = useState('');
  const r = useMemo(() => (input.trim() ? decodeJwt(input) : null), [input]);
  return (
    <Shell id="util-jwt" color="#ae81ff" title="🔑 JWT Decoder">
      <Field label="Token (decode only — signature is NOT verified)">
        <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="eyJhbGciOi..." rows={3} />
      </Field>
      <Err msg={r?.error} />
      {r?.ok && (
        <div className="fmt-grid" style={{ marginTop: 8 }}>
          <div className="fmt-col">
            <label>Header</label>
            <Out value={JSON.stringify(r.header, null, 2)} minHeight={120} />
          </div>
          <div className="fmt-col">
            <label>
              Payload {r.expiresAt && (
                <span style={{ color: r.expired ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
                  {r.expired ? `expired ${r.expiresAt}` : `valid until ${r.expiresAt}`}
                </span>
              )}
            </label>
            <Out value={JSON.stringify(r.payload, null, 2)} minHeight={120} />
          </div>
        </div>
      )}
    </Shell>
  );
}

export default JwtPanel;
