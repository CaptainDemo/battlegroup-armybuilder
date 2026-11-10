import type { Evaluation } from '@battlegroup/core';
import { t } from '../i18n';

/** Shared presentation; each ruleset supplies its own Officer/Scout calculation. */
export function RosterSummary({ totals, budget, statistics, print = false }: {
  totals: { points: Pick<Evaluation['totals']['points'], 'knownSubtotal' | 'complete'>; br: Pick<Evaluation['totals']['br'], 'knownSubtotal' | 'complete'> };
  budget: number;
  statistics: Evaluation['statistics'];
  print?: boolean;
}) {
  const prefix = print ? 'print-' : '';
  const remaining = totals.points.complete ? budget - totals.points.knownSubtotal : null;
  const amount = (value: Pick<Evaluation['totals']['points'], 'knownSubtotal' | 'complete'>) =>
    (value.complete ? '' : t('editor.knownSubtotal') + ' ') + value.knownSubtotal;
  const statistic = (id: string) => {
    const item = statistics.find(stat => stat.statId === id);
    return item?.status === 'covered' ? item.value : '—';
  };
  return (
    <div className={print ? 'print-totals roster-summary' : 'totals-strip roster-summary'} data-testid={print ? 'print-totals' : 'roster-summary'}>
      <div className={'metric points-metric' + (remaining !== null && remaining < 0 ? ' points-metric--over' : '')}>
        <span className="metric-label">{t('editor.points')}</span>
        <div className="points-amount">
          <strong data-testid={prefix + 'points-total'}>{amount(totals.points)}</strong>
          <span className="points-limit">/ {budget}</span>
          <small className="points-remaining">(<span data-testid={prefix + 'remaining'}>{remaining ?? '—'}</span> {t('editor.remainingShort')})</small>
        </div>
      </div>
      <div className="metric">
        <span className="metric-label">{t('editor.br')}</span>
        <strong data-testid={prefix + 'br-total'}>{amount(totals.br)}</strong>
      </div>
      <div className="metric">
        <span className="metric-label">{t('editor.officers')}</span>
        <strong data-testid={prefix + 'officers-total'}>{statistic('officers')}</strong>
      </div>
      <div className="metric">
        <span className="metric-label">{t('editor.scouts')}</span>
        <strong data-testid={prefix + 'scouts-total'}>{statistic('scout-weight')}</strong>
      </div>
    </div>
  );
}
