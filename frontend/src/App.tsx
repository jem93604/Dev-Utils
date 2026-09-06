import { useState } from 'react';
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
import { useAuth } from './hooks/useAuth';
import { LoginPage, UsersPage } from './pages/AuthPages';
import { AllPage, DifferPage, FormatterPage, HomePage, LibraryPage, NotesPage, SearchResultsPage, SectionPage, UtilPage, UtilsHubPage } from './pages/pages';
import {
  BasePanel, CodecPanel, JwtPanel, RegexPanel, TextPanel,
  TimePanel, JsonPanel, UuidPanel, YamlPanel,
} from './components/DevTools';

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
  const auth = useAuth();
  const searching = term.trim().length > 0;
  // Pure client-side utilities stay usable without login; everything
  // backed by per-user data (queries, notes, scripts, versions) stays locked.
  const PUBLIC_PATHS = ['/login', '/formatter', '/differ', '/utils'];
  const isPublicPath = (path: string) =>
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  const locked = !auth.loading && !!auth.status?.auth_enabled && !auth.user
    && !isPublicPath(location.pathname);

  if (auth.loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="empty" style={{ margin: 'auto' }}><div className="empty-text">Loading…</div></div>
        <ToastHost />
      </div>
    );
  }

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
        authUser={auth.user}
        authEnabled={!!auth.status?.auth_enabled}
        isAdmin={!!auth.user?.is_admin}
        onLogout={auth.logout}
      />
      <ModuleChips sections={sections} active={searching ? '' : activeFromPath(location.pathname)} />
      <div className="layout">
        <Sidebar sections={sections} pins={pins.length} collapsed={!sideOpen} />
        <main className="main" id="main-content-area">
          {locked ? (
            <LoginPage auth={auth} />
          ) : searching ? (
            <SearchResultsPage term={term} />
          ) : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/all" element={<AllPage />} />
            <Route path="/s/:slug" element={<SectionRoute />} />
            <Route path="/login" element={<LoginPage auth={auth} />} />
            <Route path="/users" element={<UsersPage auth={auth} />} />
            <Route path="/formatter" element={<FormatterPage />} />
            <Route path="/differ" element={<DifferPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/utils" element={<UtilsHubPage favs={favs} onToggleFav={toggleFav} />} />
            <Route path="/utils/time" element={<UtilPage><TimePanel /></UtilPage>} />
            <Route path="/utils/json" element={<UtilPage><JsonPanel /></UtilPage>} />
            <Route path="/utils/codec" element={<UtilPage><CodecPanel /></UtilPage>} />
            <Route path="/utils/jwt" element={<UtilPage><JwtPanel /></UtilPage>} />
            <Route path="/utils/uuid" element={<UtilPage><UuidPanel /></UtilPage>} />
            <Route path="/utils/regex" element={<UtilPage><RegexPanel /></UtilPage>} />
            <Route path="/utils/base" element={<UtilPage><BasePanel /></UtilPage>} />
            <Route path="/utils/yaml" element={<UtilPage><YamlPanel /></UtilPage>} />
            <Route path="/utils/text" element={<UtilPage><TextPanel /></UtilPage>} />
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
