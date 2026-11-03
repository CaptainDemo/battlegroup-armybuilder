import { t } from '../i18n';

export function NotFoundPage() {
  return (
    <div className="page">
      <section className="card" aria-labelledby="not-found-heading">
        <h2 id="not-found-heading">{t('notFound.title')}</h2>
        <p>{t('notFound.body')}</p>
        <a className="button" href="#/">
          {t('notFound.backHome')}
        </a>
      </section>
    </div>
  );
}
