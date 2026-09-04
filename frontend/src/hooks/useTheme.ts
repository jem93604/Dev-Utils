import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_THEME, isThemeId } from '../lib/themes';

const KEY = 'sqlhub_theme';

// Migrates legacy values: 'light' (old binary toggle) -> 'gray-light'.
function initialTheme(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light') return 'gray-light';
    if (saved && isThemeId(saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

export function useTheme() {
  const [theme, setThemeState] = useState<string>(initialTheme);

  useEffect(() => {
    // Default Dark lives in :root, so no attribute needed for it.
    if (theme === DEFAULT_THEME) {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
    try {
      localStorage.setItem(KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((id: string) => {
    setThemeState(isThemeId(id) ? id : DEFAULT_THEME);
  }, []);

  return { theme, setTheme };
}
