import { lazy } from 'react';
import { defineUtil } from '../types';

export const baseUtil = defineUtil({
  slug: 'base',
  title: 'Base Converter',
  icon: '🔢',
  description: 'Live dec ↔ hex ↔ bin ↔ oct',
  route: '/utils/base',
  category: 'format',
  keywords: ['base', 'hex', 'binary', 'octal', 'decimal', 'convert'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.BasePanel }))),
});
