import { lazy } from 'react';
import { defineUtil } from '../types';

export const notesUtil = defineUtil({
  slug: 'notes',
  title: 'Notes & Snippets',
  icon: '📝',
  description: 'Sticky notes stored in the database',
  route: '/notes',
  category: 'text',
  keywords: ['notes', 'snippets', 'sticky', 'memo'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.NotesPanel }))),
});
