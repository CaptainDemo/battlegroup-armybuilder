import type { SpecialRulesView } from '../rulesets/specialRules';
import { t } from '../i18n';

export function SpecialRulesPanel({view, appendix = false}: {view: SpecialRulesView; appendix?: boolean}) {
  return <section className={appendix ? 'print-block special-rules-appendix' : 'unit-data special-rules'} aria-label={t('specialRules.title')}>
    <h4>{t('specialRules.title')}</h4>
    {!view.supported && <p className="muted">{t('specialRules.unsupported')}</p>}
    {view.supported && !view.rules.length && <p className="muted">{t('specialRules.empty')}</p>}
    {!appendix && view.uses.map((use, index) => <p key={index}><strong>{use.unit}</strong>: {use.rules.map(rule => rule.name).join(', ')}</p>)}
    {view.rules.map(rule => <div className="unit-data-card" key={rule.key}>
      <h5>{rule.name}</h5>
      <p className="print-prewrap">{rule.text ?? t('specialRules.missing')}</p>
      {rule.source && <p className="muted">{rule.source}</p>}
    </div>)}
  </section>;
}
