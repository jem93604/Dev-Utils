import { lazy } from 'react';
import { defineUtil } from '../types';

export const imgcompressUtil = defineUtil({
  slug: 'imgcompress',
  title: 'Image Compressor',
  icon: '🗜️',
  description: 'Batch resize + compress PNG/JPG/WebP locally',
  route: '/utils/imgcompress',
  category: 'format',
  keywords: ['image', 'compress', 'resize', 'exact', 'scale', 'target', 'kb', 'jpg', 'png', 'webp', 'quality', 'size'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.ImgCompressPanel }))),
});
