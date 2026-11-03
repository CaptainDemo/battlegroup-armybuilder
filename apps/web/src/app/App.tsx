import type { ReactElement } from 'react';
import { t } from '../i18n';
import { RosterWorkspace } from '../features/roster-editor/RosterWorkspace';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RoadmapPage } from '../pages/RoadmapPage';
import { findRoute, routes } from './routes';
import { useHashPath } from './hashRouter';

export function App(): ReactElement {
  const path = useHashPath();
  const activeRoute = findRoute(path);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <h1 className="app-title">{t('app.title')}</h1>
            <p className="app-tagline">{t('app.tagline')}</p>
          </div>
          <nav className="app-nav" aria-label="Primary">
            {routes.map((route) => (
              <a
                key={route.id}
                href={`#${route.path}`}
                className="app-nav__link"
                aria-current={activeRoute?.id === route.id ? 'page' : undefined}
              >
                {t(route.navLabelKey)}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main" id="main">
        <RosterWorkspace editor={activeRoute?.id === 'editor'} hidden={activeRoute?.id !== 'home' && activeRoute?.id !== 'editor'} />
        {activeRoute?.id === 'roadmap' ? <RoadmapPage /> : !activeRoute ? <NotFoundPage /> : null}
      </main>

      <footer className="app-footer">
        <p>{t('footer.license')}</p>
        <p>{t('footer.docs')}</p>
      </footer>
    </div>
  );
}
