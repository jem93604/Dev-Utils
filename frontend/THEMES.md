# Adding a New Theme

Themes are data, not code. Three steps, no component or logic changes:

## 1. Register it — `frontend/src/lib/themes.ts`

```ts
{ id: 'dracula', name: 'Dracula', icon: '🧛' },
```

`id` must be a valid CSS attribute value (lowercase, no spaces). `icon` is any emoji shown in the picker.

## 2. Define its tokens — `frontend/src/sqlhub-theme.css`

Append a block defining **every** canonical token (anything missing silently falls back to the `:root` Default Dark values, so a partial theme still renders safely):

```css
html[data-theme="dracula"] {
  --bg:...; --bg2:...; --bg3:...; --bg4:...; --bg5:...;
  --border:...; --border2:...;
  --text:...; --text2:...; --text3:...;
  --amber:...; --amber2:...; --amber-dim:...; --amber-glow:...;
  --cyan:...; --cyan-dim:...;
  --green:...; --green-dim:...;
  --red:...; --red-dim:...;
  --blue:...; --blue-dim:...;
  --purple:...; --purple-dim:...;
  --orange:...; --orange-dim:...;
  --pink:...; --pink-dim:...;
  --kw:...; --str:...; --fn:...; --cmt:...; --var-c:...; --num:...;
  --code-bg:...; --code-fg:...;
}
```

Easiest path: copy the `gray-light` or `monokai` block and adjust values.

## 3. Reload and pick it

Open the app, click the theme icon in the topbar — the new theme is listed automatically. Selection persists in `localStorage['sqlhub_theme']` (migrated from the old binary toggle).

## Notes

- Components must only use `var(--…)` colors — never hardcode hex in TSX (see `THEMES` picker, `GuideModal`, panels). Hardcoded hex won't respond to themes.
- `--amber*` drives brand, active nav, pins, and primary buttons — pick something with enough contrast against your `--bg2`.
- Syntax roles: `--kw` keywords, `--str` strings, `--cmt` comments, `--fn` functions, `--num` numbers, `--var-c` variables.
