// Ctrl+K command palette. Row sources are registry-driven (utilities now;
// queries/sections/actions can be appended later behind the same shape).
// Global shortcut: Ctrl/Cmd+K to open, Esc to close, ↑/↓ + Enter to run.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuzzy } from '../lib/fuzzy';
import { UTILS, type UtilDef } from '../lib/utils-registry';

interface Row {
  key: string;
  icon: string;
  title: string;
  hint: string;
  run: () => void;
}

export function CommandPalette({ onOpenThemes }: { onOpenThemes: () => void }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows: Row[] = useMemo(() => [
    {
      key: 'action:theme',
      icon: '🎨',
      title: 'Change Theme…',
      hint: 'Pick a color theme with live preview',
      run: () => onOpenThemes(),
    },
    ...UTILS.map((u: UtilDef) => ({
      key: `util:${u.slug}`,
      icon: u.icon,
      title: u.title,
      hint: u.description,
      run: () => nav(u.route),
    })),
  ], [nav, onOpenThemes]);

  const results = useMemo(
    () => fuzzy(query, rows, (r) => `${r.title} ${r.hint}`),
    [query, rows],
  );

  useEffect(() => {
    if (index >= results.length) setIndex(Math.max(0, results.length - 1));
  }, [results.length, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open ]);

  if (!open) return null;

  const choose = (r: Row) => {
    setOpen(false);
    setQuery('');
    r.run();
  };

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal" style={{ maxWidth: 560 }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
          if (e.key === 'Enter' && results[index]) choose(results[index]);
        }}
      >
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            placeholder="Type a utility name… (Esc to close)"
            style={{
              width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
              borderRadius: 7, padding: '9px 12px', color: 'var(--text)',
              fontFamily: "'Syne',sans-serif", fontSize: '.85rem', outline: 'none',
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>
              No utilities match "{query}"
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={r.key}
              onClick={() => choose(r)}
              onMouseEnter={() => setIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                borderRadius: 7, cursor: 'pointer',
                background: i === index ? 'var(--amber-dim)' : 'transparent',
                border: '1px solid transparent',
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem', color: i === index ? 'var(--amber)' : 'var(--text)' }}>{r.title}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>{r.hint}</div>
              </div>
              {i === index && <span style={{ color: 'var(--text3)', fontSize: '.72rem' }}>↵</span>}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, fontSize: '.68rem', color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
