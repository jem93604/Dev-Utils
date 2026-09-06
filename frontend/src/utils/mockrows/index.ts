import { lazy } from 'react';
import { defineUtil } from '../types';

export const mockrowsUtil = defineUtil({
  slug: 'mockrows',
  title: 'Mock Row Generator',
  icon: '🎲',
  description: 'Fake INSERT statements or CSV from column defs',
  route: '/utils/mockrows',
  category: 'sql',
  keywords: ['mock', 'fake', 'seed', 'insert', 'csv', 'rows', 'test data'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.MockRowsPanel }))),
});
