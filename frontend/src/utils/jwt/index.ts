import { lazy } from 'react';
import { defineUtil } from '../types';

export const jwtUtil = defineUtil({
  slug: 'jwt',
  title: 'JWT Decoder',
  icon: '🔑',
  description: 'Decode header/payload, expiry check (no verify)',
  route: '/utils/jwt',
  category: 'encode',
  keywords: ['jwt', 'token', 'decode', 'header', 'payload', 'expiry'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.JwtPanel }))),
});
