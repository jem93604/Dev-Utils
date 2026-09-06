import type { LazyExoticComponent, JSX } from 'react';

export type UtilCategory = 'format' | 'encode' | 'time' | 'text' | 'gen';

export interface UtilModule {
  slug: string;
  title: string;
  icon: string;
  description: string;
  route: string;
  category: UtilCategory;
  keywords: string[];
  component: LazyExoticComponent<() => JSX.Element>;
}

export function defineUtil(m: UtilModule): UtilModule {
  return m;
}
