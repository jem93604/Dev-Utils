// Theme registry — the ONLY place that lists themes.
// To add a theme:
//   1) append one row here { id, name, icon }
//   2) append an html[data-theme="<id>"] block in sqlhub-theme.css defining
//      every canonical token (see the doc comment at the top of that file)
//   3) reload — the picker, persistence, and Guide pick it up automatically.
// No component or logic changes needed.

export interface ThemeDef {
  id: string;
  name: string;
  icon: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'dark', name: 'Default Dark', icon: '🌙' },
  { id: 'monokai', name: 'Monokai', icon: '🎨' },
  { id: 'solarized-dark', name: 'Solarized Dark', icon: '🌊' },
  { id: 'solarized-light', name: 'Solarized Light', icon: '☀️' },
  { id: 'gray-light', name: 'Soft Gray', icon: '🌤️' },
];

export const DEFAULT_THEME = 'dark';

export function isThemeId(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}
