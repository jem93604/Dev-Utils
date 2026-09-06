// Guide modal — ported from the 📖 Guide dialog in SQL_HUB_v1.html,
// updated for the React + Postgres remake (auto-save, routes, live stats).
import { Modal } from './ui';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="📖 How to Use SQL Hub" wide>
      <div style={{ lineHeight: 1.7, fontSize: '.83rem', color: 'var(--text2)' }}>
        <Block title="🏠 Home Page">
          The home page shows your <strong style={{ color: 'var(--amber)' }}>pinned queries</strong> for quick access, plus live stats. Click the 📌 icon on any query to pin it.
        </Block>
        <Block title="📂 Sections">
          Use the module tabs under the top bar or the sidebar to focus on one section, or <strong style={{ color: 'var(--text)' }}>All Sections</strong> to browse everything. Use the search box to filter across sections.
        </Block>
        <Block title="🔑 Dynamic Inputs">
          Expand a query card and type into its input fields. All <code style={{ color: 'var(--amber)', background: 'var(--amber-dim)', padding: '1px 5px', borderRadius: 3 }}>{'{{variable}}'}</code> placeholders update live with highlighting. Use the Copy button to copy the query with values substituted. New <code style={{ color: 'var(--amber)' }}>{'{{variables}}'}</code> you add to SQL are detected automatically.
        </Block>
        <Block title="📌 Pinning Queries">
          Click the 📌 icon on any query card header to pin it. Pinned queries appear on the Home page for fast access.
        </Block>
        <Block title="🧰 Utilities">
          Open the <strong style={{ color: 'var(--text)' }}>🧰 Utilities</strong> hub for every tool: Data Formatter, SQL Differ, Notes, Script Library, plus developer tools (Time Converter, JSON Formatter, Base64/URL Codec, JWT Decoder, UUID Generator, Regex Tester, Base Converter, JSON↔YAML, Text Toolkit).<br />
          Click ☆ on any hub card to pin it to the topbar. Press <strong style={{ color: 'var(--amber)' }}>Ctrl+K</strong> anywhere to fuzzy-search all utilities.
        </Block>
        <Block title="🎨 Themes">
          Click the theme icon in the topbar to switch between Default Dark, Monokai, Solarized Dark/Light, and Soft Gray. Your choice is remembered.
        </Block>
        <Block title="👤 Accounts">
          Sign in to get your own private workspace — queries, notes, scripts, and snapshots are per-account. The first account on a server becomes admin (👥 menu) and can deactivate accounts. Sessions last 7 days; the ⏻ button signs you out.
          Developer utilities (formatter, differ, converters, …) stay usable without signing in.
        </Block>
        <Block title="💾 Saving">
          Everything saves to <strong style={{ color: 'var(--text)' }}>Postgres automatically</strong> — no manual Save button needed. Use the Versions feature to snapshot and restore your library.
        </Block>
      </div>
    </Modal>
  );
}
