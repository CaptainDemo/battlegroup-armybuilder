import { useEffect, useState } from 'react';

/**
 * Minimal hash router for the static shell. Hash routing keeps the app
 * independent of server-side rewrite rules on any static host.
 */

/** Normalise a location hash into an in-app path: leading "/", no trailing slash. */
export function normaliseHashPath(hash: string): string {
  const raw = hash.replace(/^#/, '').trim();
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash === '' ? '/' : withoutTrailingSlash;
}

/** Current in-app path derived from window.location.hash, updated on hashchange. */
export function useHashPath(): string {
  const [path, setPath] = useState(() => normaliseHashPath(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => setPath(normaliseHashPath(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return path;
}
