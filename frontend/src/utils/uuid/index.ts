import { lazy } from 'react';
import { defineUtil } from '../types';

export const uuidUtil = defineUtil({
  slug: 'uuid',
  title: 'UUID Generator',
  icon: '🆔',
  description: 'Bulk v4 UUIDs in multiple formats',
  route: '/utils/uuid',
  category: 'gen',
  keywords: ['uuid', 'guid', 'generate', 'v4', 'random', 'bulk'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.UuidPanel }))),
});
