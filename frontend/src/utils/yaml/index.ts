import { lazy } from 'react';
import { defineUtil } from '../types';

export const yamlUtil = defineUtil({
  slug: 'yaml',
  title: 'JSON ↔ YAML',
  icon: '🔄',
  description: 'Convert both directions with validation',
  route: '/utils/yaml',
  category: 'format',
  keywords: ['yaml', 'json', 'convert', 'parse', 'validate'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.YamlPanel }))),
});
