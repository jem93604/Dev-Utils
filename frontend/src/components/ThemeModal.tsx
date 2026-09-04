// Theme picker modal with fuzzy search. Hovering a row live-previews the
// theme, ↑/↓ + Enter applies it, Esc cancels (reverting to committed theme).
// Opened from the topbar theme button and the Ctrl+K "Change Theme…" row.
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_THEME, THEMES } from '../lib/themes';
import { fuzzy } from '../lib/fuzzy';
import { Modal } from './ui';

function applyPreview(id: string) {
  if (id === DEFAULT_THEME) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = id;
  }
}

export function ThemeModal({
  open, onClose, theme, onCommit,
}: {
  open: boolean; onClose: () => void; theme: string; onCommit: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const results = useMemo(
    () => fuzzy(query, THEMES, (t) => `${t.name} ${t.id}`),
    [query],
  );

  // Reset search + highlight + preview whenever the modal opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(Math.max(0, THEMES.findIndex((t) => t.id === theme)));
      applyPreview(theme);
    }
  }, [open, theme]);

  useEffect(() => {
    if (index >= results.length) setIndex(Math.max(0, results.length - 1));
  }, [results.length, index]);

  // Esc / close without choosing reverts the preview.
  const cancel = () => {
    applyPreview(theme);
    onClose();
  };

  const choose = (id: string) => {
    onCommit(id);
    onClose();
  };

  const move = (delta: number) => {
    setIndex((i) => {
      if (results.length === 0) return 0;
      const next = (i + delta + results.length) % results.length;
      applyPreview(results[next].id);
      return next;
    });
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={cancel} title="🎨 Choose Theme">
      <div style={{ marginBottom: 8 }}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            if (e.key === 'Enter' && results[index]) choose(results[index].id);
          }}
          placeholder="Search themes… (↑↓ navigate, ↵ apply, esc cancel)"
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          style={{
            width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
            borderRadius: 7, padding: '9px 12px', color: 'var(--text)',
            fontFamily: "'Syne',sans-serif", fontSize: '.85rem', outline: 'none',
          }}
        />
      </div>
      {results.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>
          No themes match "{query}"
        </div>
      )}
      {results.map((t, i) => (
        <div
          key={t.id}
          onClick={() => choose(t.id)}
          onMouseEnter={() => { setIndex(i); applyPreview(t.id); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
            borderRadius: 7, cursor: 'pointer', marginBottom: 2,
            background: i === index ? 'var(--amber-dim)' : 'transparent',
            border: '1px solid transparent',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
          <span style={{ fontWeight: 700, fontSize: '.85rem', color: i === index ? 'var(--amber)' : 'var(--text)' }}>
            {t.name}
          </span>
          {t.id === theme && <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '.8rem' }}>✓ current</span>}
          {i === index && t.id !== theme && <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: '.72rem' }}>↵</span>}
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: '.7rem', color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
        hover to preview · ↑↓ navigate · ↵ apply · esc cancel
      </div>
    </Modal>
  );
}
