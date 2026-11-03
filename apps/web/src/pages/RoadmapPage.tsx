import { t } from '../i18n';

interface Milestone {
  readonly labelKey: string;
  readonly statusKey: string;
}

const milestones: readonly Milestone[] = [
  { labelKey: 'roadmap.m01Label', statusKey: 'roadmap.m01Status' },
  { labelKey: 'roadmap.m02Label', statusKey: 'roadmap.m02Status' },
  { labelKey: 'roadmap.m03Label', statusKey: 'roadmap.m03Status' },
  { labelKey: 'roadmap.m08Label', statusKey: 'roadmap.m08Status' },
];

export function RoadmapPage() {
  return (
    <div className="page">
      <section className="card" aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading">{t('roadmap.title')}</h2>
        <p>{t('roadmap.intro')}</p>
        <ol className="milestone-list">
          {milestones.map((milestone) => (
            <li key={milestone.labelKey}>
              <h3>{t(milestone.labelKey)}</h3>
              <p className="muted">{t(milestone.statusKey)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
