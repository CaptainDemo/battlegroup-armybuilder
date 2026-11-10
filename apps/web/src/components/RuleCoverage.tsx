import type { CheckCoverage } from '@battlegroup/core';
import { t } from '../i18n';

/** Player-facing coverage summary; raw implementation records are opt-in. */
export function RuleCoverage({
  checks,
  debug = false,
}: {
  checks: readonly CheckCoverage[];
  debug?: boolean;
}) {
  const complete = checks.length > 0 && checks.every(check => check.status === 'covered');
  return (
    <div className="rule-coverage">
      <p>{t(complete ? 'coverage.complete' : 'coverage.partial')}</p>
      {checks.some(check => check.status === 'blocked-unknown-data') && (
        <p>{t('coverage.unknownData')}</p>
      )}
      {checks.some(check => check.status === 'missing-input') && (
        <p>{t('coverage.missingInput')}</p>
      )}
      {debug && (
        <details>
          <summary>{t('debug.checks')}</summary>
          <ul>
            {checks.map((check, index) => (
              <li key={index}>
                {check.checkId}: {check.status.replaceAll('-', ' ')}
                {check.note ? ' — ' + check.note : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
