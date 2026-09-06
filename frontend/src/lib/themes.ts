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
  { id: 'dracula', name: 'Dracula', icon: '🧛' },
  { id: 'nord', name: 'Nord', icon: '❄️' },
  { id: 'gruvbox', name: 'Gruvbox Dark', icon: '🍂' },
  { id: 'tokyo-night', name: 'Tokyo Night', icon: '🌃' },
  { id: 'catppuccin', name: 'Catppuccin Mocha', icon: '🐈' },
  { id: 'one-dark', name: 'One Dark', icon: '🌑' },
  { id: 'solarized-dark', name: 'Solarized Dark', icon: '🌊' },
  { id: 'solarized-light', name: 'Solarized Light', icon: '☀️' },
  { id: 'gray-light', name: 'Soft Gray', icon: '🌤️' },
  { id: 'vantablack', name: 'Vantablack', icon: '⚫' },
  { id: 'github-dark', name: 'GitHub Dark', icon: '🐙' },
  { id: 'everforest', name: 'Everforest', icon: '🌲' },
  { id: 'rose-pine', name: 'Rosé Pine', icon: '🌹' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', icon: '🌆' },
  { id: 'high-contrast', name: 'High Contrast', icon: '🔆' },
  { id: 'midnight', name: 'Midnight Blue', icon: '🌌' },
  { id: 'oled', name: 'Pure OLED', icon: '📱' },
  { id: 'pastel-dark', name: 'Pastel Dark', icon: '🍬' },
];

export const DEFAULT_THEME = 'dark';

export function isThemeId(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}
