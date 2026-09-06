import { lazy } from 'react';
import { defineUtil } from '../types';

export const libraryUtil = defineUtil({
  slug: 'library',
  title: 'Script Library',
  icon: '📂',
  description: 'Server script paths with purpose + steps',
  route: '/library',
  category: 'gen',
  keywords: ['scripts', 'library', 'server', 'paths', 'runbook'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.ScriptPanel }))),
});
