import type { EvaluatedCompositionNode } from '@battlegroup/core';
import type { AppCatalogRelease } from '../../rulesets/types';
import { getPresentation } from '../../rulesets/presentation';
import { t } from '../../i18n';

export function UnitDataPanel(props: {node: EvaluatedCompositionNode; release: AppCatalogRelease}) {
  const Panel = getPresentation(props.release.catalog.manifest.identity.rulesetId)?.UnitData;
  return Panel ? <Panel {...props} /> : <p className="muted">{t('unitData.unsupported')}</p>;
}
