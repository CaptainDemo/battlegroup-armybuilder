import { classicColdWarRuleset } from '@battlegroup/classic-coldwar';
import { t } from '../i18n';

export function HomePage() {
  return (
    <div className="page">
      <section className="card card--status" aria-labelledby="status-heading">
        <h2 id="status-heading">{t('status.bannerTitle')}</h2>
        <p>{t('status.bannerBody')}</p>
      </section>

      <section className="card" aria-labelledby="rosters-heading">
        <h2 id="rosters-heading">{t('home.myRostersTitle')}</h2>
        <p className="muted">{t('home.myRostersEmpty')}</p>
        <h3>{t('home.createTitle')}</h3>
        <p className="muted">{t('home.createBody')}</p>
      </section>

      <section className="card" aria-labelledby="coverage-heading">
        <h2 id="coverage-heading">{t('home.coverageTitle')}</h2>
        <p>{t('home.coverageIntro')}</p>
        <ul className="coverage-list">
          <li>
            <strong>{classicColdWarRuleset.label}</strong>
            <p className="muted">{t('home.coverageSample')}</p>
            <p className="muted">{t('home.coverageStatus')}</p>
          </li>
        </ul>
        <p className="muted">{t('home.coverageIsolation')}</p>
      </section>
    </div>
  );
}
