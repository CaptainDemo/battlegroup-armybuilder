import type { PrintReferenceView } from '../../rulesets/presentationTypes';
import { getPresentation } from '../../rulesets/presentation';
import type { RulesetId } from '@battlegroup/core';
import { t } from '../../i18n';

export function PrintUnitDataAppendix({reference, rulesetId}: {reference: PrintReferenceView; rulesetId: RulesetId}) {
  const Appendix = getPresentation(rulesetId)?.PrintAppendix;
  return Appendix ? <Appendix reference={reference} /> : <p>{t('unitData.unsupported')}</p>;
}
