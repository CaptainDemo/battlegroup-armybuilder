import type { RulesetPresentation } from '../presentationTypes';
import { ClassicUnitDataPanel } from './UnitDataPanel';
import { ClassicPrintUnitDataAppendix } from './PrintUnitDataAppendix';
import { classicReferenceData, projectClassicReference } from './printReference';

import { classicSpecialRules } from './specialRules';

export const classicPresentation: RulesetPresentation = {
  specialRules: classicSpecialRules,
  projectReference: projectClassicReference,
  UnitData: ClassicUnitDataPanel,
  PrintAppendix: ({reference}) => <ClassicPrintUnitDataAppendix reference={classicReferenceData(reference)} />,
};
