import { NavLink } from 'react-router-dom';
import type { Query, Section } from '../lib/api';
import { UTILS } from '../lib/utils-registry';
import { QueryCard } from '../components/QueryCard';
import { DifferPanel, FormatterPanel, NotesPanel, ScriptPanel } from '../components/Tools';
import { Empty, PurposeBox, SectionHeader, StatCard } from '../components/ui';
import { usePins, useQueries, useSections, useStats, useTogglePin } from '../hooks/useData';
import { MAX_FAVS } from '../hooks/useUtilFavs';

function usePinToggle() {
  return useTogglePin();
}

export function HomePage() {
  const pins = usePins();
  const stats = useStats();
  const onPin = usePinToggle();
  return (
    <div className="home-wrapper visible">
      <div className="home-hero">
        <div className="home-hero-icon">⚡</div>
        <div>
          <h1>SQL Hub V3</h1>
          <p>Your portable POS query toolkit. Pin frequent queries for quick access. Use module tabs to focus on a section.</p>
        </div>
      </div>
      <div className="home-stats">
        <StatCard num={stats.sections} label="Sections" />
        <StatCard num={stats.queries} label="Queries" />
        <StatCard num={stats.pinned} label="Pinned" />
        <StatCard num={stats.notes} label="Notes" />
      </div>
      <div className="pinned-section-title">📌 Pinned Queries</div>
      {pins.length === 0
        ? <Empty icon="📌" text="No pinned queries yet" hint="Click the 📌 icon on any query to pin it here" />
        : pins.map((q) => <QueryCard key={q.id} q={q} onTogglePin={onPin} />)}
    </div>
  );
}

export function SectionPage({ slug }: { slug: string }) {
  const sections = useSections();
  const sec = sections.find((s) => s.slug === slug);
  const queries = useQueries(sec?.id);
  const onPin = usePinToggle();
  if (!sec) return <Empty icon="📂" text="Section not found" />;
  return (
    <div className="sections-wrapper visible">
      <section className="section-block">
        <SectionHeader
          color={sec.color} title={sec.name}
          badge={`${queries.length} ${queries.length === 1 ? 'query' : 'queries'}`}
        />
        {sec.description && <PurposeBox title="📂 About this section">{sec.description}</PurposeBox>}
        {queries.length === 0
          ? <Empty icon="📋" text="No queries yet" />
          : queries.map((q) => <QueryCard key={q.id} q={q} section={sec} onTogglePin={onPin} />)}
      </section>
    </div>
  );
}

export function AllPage() {
  const sections = useSections();
  const onPin = usePinToggle();
  if (sections.length === 0) {
    return (
      <div className="sections-wrapper visible">
        <Empty icon="📋" text="No sections yet" hint="Create your first section to get started" />
      </div>
    );
  }
  return (
    <div className="sections-wrapper visible">
      {sections.map((sec) => (
        <SectionQueries key={sec.id} sectionId={sec.id} onPin={onPin} />
      ))}
    </div>
  );
}

function SectionQueries({ sectionId, onPin }: { sectionId: string; onPin: (q: Query) => void }) {
  const sections = useSections();
  const sec: Section | undefined = sections.find((s) => s.id === sectionId);
  const queries = useQueries(sectionId);
  if (!sec) return null;
  return (
    <section className="section-block">
      <SectionHeader color={sec.color} title={sec.name} badge={`${queries.length} queries`} />
      {sec.description && <PurposeBox title="📂 About this section">{sec.description}</PurposeBox>}
      {queries.map((q) => <QueryCard key={q.id} q={q} section={sec} onTogglePin={onPin} />)}
    </section>
  );
}

/* ---------- Standalone utility pages ---------- */

export function FormatterPage() {
  return (
    <div className="sections-wrapper visible">
      <FormatterPanel />
    </div>
  );
}

export function DifferPage() {
  return (
    <div className="sections-wrapper visible">
      <DifferPanel />
    </div>
  );
}

export function NotesPage() {
  return (
    <div className="sections-wrapper visible">
      <NotesPanel />
    </div>
  );
}

export function LibraryPage() {
  return (
    <div className="sections-wrapper visible">
      <ScriptPanel />
    </div>
  );
}

/* ---------- Standalone utility pages ---------- */

export function UtilPage({ children }: { children: React.ReactNode }) {
  return <div className="sections-wrapper visible">{children}</div>;
}

/* ---------- Utilities hub ---------- */export function UtilsHubPage({ favs, onToggleFav }: { favs: string[]; onToggleFav: (slug: string) => void }) {
  return (
    <div className="sections-wrapper visible">
      <section className="section-block">
        <SectionHeader color="var(--amber)" title="🧰 Utilities" badge={`${UTILS.length} tools`} />
        <PurposeBox title="Favorites">
          Click ☆ on any card to pin it to the topbar (first {MAX_FAVS} show). Press <code style={{ color: 'var(--amber)' }}>Ctrl+K</code> anywhere to fuzzy-search all utilities.
        </PurposeBox>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
          {UTILS.map((u) => {
            const isFav = favs.includes(u.slug);
            return (
              <div key={u.slug} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '14px 15px', position: 'relative' }}>
                <button
                  onClick={() => onToggleFav(u.slug)} title={isFav ? 'Remove from topbar' : 'Pin to topbar'}
                  style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: isFav ? 'var(--amber)' : 'var(--text3)' }}
                >
                  {isFav ? '★' : '☆'}
                </button>
                <NavLink to={u.route} style={{ textDecoration: 'none' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{u.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text)', marginBottom: 3 }}>{u.title}</div>
                  <div style={{ fontSize: '.73rem', color: 'var(--text2)', lineHeight: 1.5 }}>{u.description}</div>
                </NavLink>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
