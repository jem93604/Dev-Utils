// Reusable UI primitives. Class names (.tbtn, .modal, ...) come from
// sqlhub-theme.css extracted from SQL_HUB_v1.html so the design is preserved.
// These are thin React wrappers — use them everywhere instead of raw <button>/<div>.
import { useEffect, useState, type ReactNode } from 'react';

/* ---------- Button: .tbtn + variants ---------- */
type BtnVariant = 'default' | 'primary' | 'danger';
export function TButton({
  variant = 'default', onClick, children, title, type = 'button',
}: {
  variant?: BtnVariant; onClick?: () => void; children: ReactNode; title?: string; type?: 'button' | 'submit';
}) {
  const cls = variant === 'primary' ? 'tbtn tbtn-primary' : variant === 'danger' ? 'tbtn tbtn-danger' : 'tbtn';
  return <button type={type} title={title} className={cls} onClick={onClick}>{children}</button>;
}

/* ---------- Small query action button: .qbtn ---------- */
export function QButton({
  onClick, children, title, accent,
}: { onClick?: () => void; children: ReactNode; title?: string; accent?: 'copy' | 'del' }) {
  const cls = accent === 'copy' ? 'qbtn qbtn-copy' : accent === 'del' ? 'qbtn qbtn-del' : 'qbtn';
  return <button className={cls} title={title} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>{children}</button>;
}

/* ---------- Tag: .qtag ---------- */
export function QTag({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`qtag qtag-${kind.toLowerCase()}`}>{children}</span>;
}

/* ---------- Section header: .section-header ---------- */
export function SectionHeader({
  color, title, badge, right,
}: { color: string; title: string; badge?: string; right?: ReactNode }) {
  return (
    <div className="section-header">
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div className="section-title">{title}</div>
      {badge && <span className="section-badge">{badge}</span>}
      <div className="section-spacer" />
      {right}
    </div>
  );
}

/* ---------- Purpose box ---------- */
export function PurposeBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="purpose-box">
      <div className="purpose-text">
        <div className="purpose-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Stat card / empty state ---------- */
export function StatCard({ num, label }: { num: number; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Empty({ icon, text, hint, action }: { icon: string; text: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{text}</div>
      {hint && <div style={{ fontSize: '.76rem', color: 'var(--text3)' }}>{hint}</div>}
      {action && <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>{action}</div>}
    </div>
  );
}

/* ---------- Modal: .overlay + .modal ---------- */
export function Modal({
  open, onClose, title, sub, children, footer, wide,
}: {
  open: boolean; onClose: () => void; title: string; sub?: string;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wide ? 'modal modal-lg' : 'modal'}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toast (simple context-free version) ---------- */
let toastFn: ((msg: string) => void) | null = null;
export function toast(msg: string) { toastFn?.(msg); }

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastFn = (m) => setMsg(m);
    return () => { toastFn = null; };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div className={`toast${msg ? ' show' : ''}`} id="toast">
      <div className="toast-dot" style={{ background: 'var(--green)' }} />
      <span>{msg ?? ''}</span>
    </div>
  );
}

/* ---------- Form field: .fg ---------- */
export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fg">
      <label>{label}</label>
      {children}
      {hint && <div className="fg-hint">{hint}</div>}
    </div>
  );
}
