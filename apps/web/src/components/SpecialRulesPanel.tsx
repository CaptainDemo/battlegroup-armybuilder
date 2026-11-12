import type { SpecialRulesView, SpecialRuleView } from '../rulesets/specialRules';
import { t } from '../i18n';

export function SpecialRuleText({ rule }: { rule: SpecialRuleView }) {
  return <>
    <p className="special-rule-text">{rule.text ?? t('specialRules.missing')}</p>
    {rule.source && <p className="muted special-rule-source">{rule.source}</p>}
  </>;
}

export function SpecialRuleCards({ rules }: { rules: readonly SpecialRuleView[] }) {
  return rules.map(rule => <div className="unit-data-card" key={rule.key}>
    <h5>{rule.name}</h5>
    <SpecialRuleText rule={rule} />
  </div>);
}

export function SpecialRulesPanel({view}: {view: SpecialRulesView}) {
  return <section className="print-block special-rules-appendix" aria-label={t('specialRules.title')}>
    <h4>{t('specialRules.title')}</h4>
    {!view.supported && <p className="muted">{t('specialRules.unsupported')}</p>}
    {view.supported && !view.rules.length && <p className="muted">{t('specialRules.empty')}</p>}
    <SpecialRuleCards rules={view.rules} />
  </section>;
}
