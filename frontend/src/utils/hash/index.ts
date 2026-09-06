import { lazy } from 'react';
import { defineUtil } from '../types';

export const hashUtil = defineUtil({
  slug: 'hash',
  title: 'Hash Generator',
  icon: '🔒',
  description: 'DJB2/FNV-1a + SHA-256 (WebCrypto)',
  route: '/utils/hash',
  category: 'encode',
  keywords: ['hash', 'sha', 'checksum', 'djb2', 'fnv'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.HashPanel }))),
});
