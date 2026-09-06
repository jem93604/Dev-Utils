import type { ReactNode } from 'react';
import { SectionHeader, toast } from '../components/ui';

export function UtilShell({ id, color, title, children }: { id: string; color: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="section-block">
      <SectionHeader color={color} title={title} />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        {children}
      </div>
    </section>
  );
}

export function CopyBtn({ text }: { text: string }) {
  return (
    <button
      className="fmt-btn"
      onClick={() => { if (text) { navigator.clipboard.writeText(text); toast('Copied ✓'); } }}
    >
      ⎘ Copy
    </button>
  );
}

export function OutBox({ value, minHeight }: { value: string; minHeight?: number }) {
  return (
    <textarea className="fmt-textarea" readOnly value={value}
      style={minHeight ? { minHeight } : undefined} placeholder="Output appears here..." />
  );
}

export function ErrMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ color: 'var(--red)', fontSize: '.76rem', marginTop: 6 }}>{msg}</div>;
}
