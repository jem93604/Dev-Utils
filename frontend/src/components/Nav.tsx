// Navigation components reusing .topbar / .module-selector / .sidebar theme classes.
import { NavLink, useNavigate } from 'react-router-dom';
import type { Section } from '../lib/api';
import { THEMES } from '../lib/themes';
import { utilBySlug } from '../lib/utils-registry';
import { MAX_FAVS } from '../hooks/useUtilFavs';

import { useContentModals } from './ContentModals';

export function Topbar({
  onSearch, onToggleSidebar, onOpenGuide, theme, onOpenThemes, utilFavs, onOpenVersions,
}: {
  onSearch: (q: string) => void; onToggleSidebar: () => void;
  onOpenGuide: () => void; theme: string; onOpenThemes: () => void;
  utilFavs: string[]; onOpenVersions: () => void;
}) {
  const nav = useNavigate();
  const themeIcon = THEMES.find((t) => t.id === theme)?.icon ?? '🌙';
  const favUtils = utilFavs.map(utilBySlug).filter((u): u is NonNullable<typeof u> => !!u).slice(0, MAX_FAVS);
  return (
    <div className="topbar">
      <button className="sidebar-toggle" onClick={onToggleSidebar} title="Toggle Sidebar">☰</button>
      <div className="topbar-brand">
        <div className="topbar-brand-icon">⚡</div>
        SQL HUB <span style={{ fontSize: '.65rem', color: 'var(--text3)', fontWeight: 400 }}>V3</span>
      </div>
      <div className="topbar-search">
        <span style={{ color: 'var(--text3)', fontSize: '.85rem' }}>⌕</span>
        <input type="text" placeholder="Search queries, sections..." onChange={(e) => onSearch(e.target.value)} />
      </div>
      <div className="topbar-right">
        <button className="theme-toggle" onClick={onOpenThemes} title="Change theme">
          <span className="theme-toggle-icon">{themeIcon}</span>
        </button>
        <button className="tbtn" onClick={() => nav('/')}>🏠 Home</button>
        <button className="tbtn" onClick={onOpenGuide}>📖 Guide</button>
        <button className="tbtn" onClick={onOpenVersions} title="Snapshots & restore">🕘 Versions</button>
        <button className="tbtn" onClick={() => nav('/utils')} title="All utilities">🧰 Utilities</button>
        {favUtils.map((u) => (
          <button key={u.slug} className="tbtn" onClick={() => nav(u.route)} title={u.title}>{u.icon}</button>
        ))}
      </div>
    </div>
  );
}

export function ModuleChips({
  sections, active,
}: { sections: Section[]; active: string }) {
  return (
    <div className="module-selector">
      <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap', flexShrink: 0 }}>View:</span>
      <NavLink to="/" className={`module-chip module-chip-all${active === 'home' ? ' active' : ''}`}>🏠 Home</NavLink>
      <NavLink to="/all" className={`module-chip${active === 'all' ? ' active' : ''}`}>📋 All Sections</NavLink>
      {sections.map((s) => (
        <NavLink
          key={s.id}
          to={`/s/${s.slug}`}
          className={`module-chip${active === s.slug ? ' active' : ''}`}
          style={active === s.slug ? { borderColor: s.color, color: s.color, background: `${s.color}15` } : undefined}
        >
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: s.color, marginRight: 5 }} />
          {s.name}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar({
  sections, pins, collapsed,
}: { sections: Section[]; pins: number; collapsed: boolean }) {
  const { openCreateSection } = useContentModals();
  if (collapsed) return <aside className="sidebar collapsed" />;
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-section-label">Sections</div>
      </div>
      <div className="nav-list">
        <NavLink to="/" className={({ isActive }) => `nav-item home-item${isActive ? ' active' : ''}`}>
          <span style={{ fontSize: '.9rem' }}>🏠</span><span>Home</span>
          <span className="nav-count">{pins}📌</span>
        </NavLink>
        {sections.map((s) => (
          <NavLink key={s.id} to={`/s/${s.slug}`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <div className="nav-dot" style={{ background: s.color }} />
            <span>{s.name}</span>
            <span className="nav-count">{s.query_count}</span>
          </NavLink>
        ))}
        <div className="nav-item" style={{ cursor: 'pointer' }} onClick={openCreateSection} title="Create a new section">
          <span style={{ fontSize: '.9rem' }}>＋</span><span>New Section</span>
        </div>
      </div>
      <div className="sidebar-divider" />
    </aside>
  );
}
