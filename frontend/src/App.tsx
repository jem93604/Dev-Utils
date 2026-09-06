import { Suspense, useState } from 'react';
import { HashRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ModuleChips, Sidebar, Topbar } from './components/Nav';
import { CommandPalette } from './components/CommandPalette';
import { ContentModalProvider, useContentModals } from './components/ContentModals';
import { ThemeModal } from './components/ThemeModal';
import { GuideModal } from './components/GuideModal';
import { ToastHost } from './components/ui';
import { usePins, useSections } from './hooks/useData';
import { useTheme } from './hooks/useTheme';
import { useUtilFavs } from './hooks/useUtilFavs';
import { AllPage, HomePage, SearchResultsPage, SectionPage, UtilPage, UtilsHubPage } from './pages/pages';
import { ALL_UTILS } from './lib/utils-registry';

function LazyUtil({ slug }: { slug: string }) {
  const mod = ALL_UTILS.find((u) => u.slug === slug);
  if (!mod) return null;
  const C = mod.component;
  return (
    <UtilPage>
      <Suspense fallback={<div className="empty"><div className="empty-text">Loading…</div></div>}>
        <C />
      </Suspense>
    </UtilPage>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ContentModalProvider>
        <Shell />
      </ContentModalProvider>
    </HashRouter>
  );
}

function SectionRoute() {
  const { slug = '' } = useParams();
  return <SectionPage slug={slug} />;
}

function activeFromPath(path: string): string {
  if (path.startsWith('/s/')) return 'section';
  if (path === '/all') return 'all';
  return 'home';
}

function Shell() {
  const sections = useSections();
  const pins = usePins();
  const location = useLocation();
  const [term, setTerm] = useState('');
  const [sideOpen, setSideOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { favs, toggle: toggleFav } = useUtilFavs();
  const { openVersions } = useContentModals();
  const searching = term.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Topbar
        onSearch={setTerm}
        onToggleSidebar={() => setSideOpen((o) => !o)}
        onOpenGuide={() => setGuideOpen(true)}
        theme={theme}
        onOpenThemes={() => setThemeOpen(true)}
        utilFavs={favs}
        onOpenVersions={openVersions}
      />
      <ModuleChips sections={sections} active={searching ? '' : activeFromPath(location.pathname)} />
      <div className="layout">
        <Sidebar sections={sections} pins={pins.length} collapsed={!sideOpen} />
        <main className="main" id="main-content-area">
          {searching ? (
            <SearchResultsPage term={term} />
          ) : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/all" element={<AllPage />} />
            <Route path="/s/:slug" element={<SectionRoute />} />
            {ALL_UTILS.map((u) => (
              <Route key={u.slug} path={u.route} element={<LazyUtil slug={u.slug} />} />
            ))}
            <Route path="/utils" element={<UtilsHubPage favs={favs} onToggleFav={toggleFav} />} />
          </Routes>
          )}
        </main>
      </div>
      <ToastHost />
      <CommandPalette onOpenThemes={() => setThemeOpen(true)} />
      <ThemeModal
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        theme={theme}
        onCommit={setTheme}
      />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
