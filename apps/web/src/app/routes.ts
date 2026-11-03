export type RouteId = 'home' | 'editor' | 'roadmap';

export interface AppRoute {
  readonly id: RouteId;
  /** In-app path; the URL form is `#${path}`. */
  readonly path: `/${string}` | '/';
  readonly navLabelKey: string;
}

export const routes: readonly AppRoute[] = [
  { id: 'home', path: '/', navLabelKey: 'nav.home' },
  { id: 'editor', path: '/editor', navLabelKey: 'nav.editor' },
  { id: 'roadmap', path: '/roadmap', navLabelKey: 'nav.roadmap' },
];

export function findRoute(path: string): AppRoute | undefined {
  return routes.find((route) => route.path === path);
}
