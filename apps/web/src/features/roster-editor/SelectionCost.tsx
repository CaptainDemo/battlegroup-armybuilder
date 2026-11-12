import type { Evaluation, TrackedValue } from '@battlegroup/core';
import { t } from '../../i18n';

function formatCost(values: readonly TrackedValue[]): string {
  const known = values.filter(value => value.state === 'known');
  if (!known.length) {
    return t(values.length && values.every(value => value.state === 'not_applicable')
      ? 'editor.notApplicable' : 'editor.unknown');
  }
  const amount = known.reduce((sum, value) => sum + value.value, 0);
  return known.length === values.length ? String(amount) : t('editor.knownSubtotal') + ' ' + amount;
}

export function SelectionCost({ lines }: { lines: Evaluation['chargeLines'] }) {
  return <span className="selection-cost">
    {formatCost(lines.map(line => line.points))} {t('editor.points')} / {formatCost(lines.map(line => line.br))} BR
  </span>;
}
