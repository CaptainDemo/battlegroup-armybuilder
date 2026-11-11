import type { RulesetPresentation } from '../presentationTypes';
import { ClassicUnitDataPanel } from './UnitDataPanel';
import { ClassicPrintUnitDataAppendix } from './PrintUnitDataAppendix';
import { classicReferenceData, projectClassicReference } from './printReference';

export const classicPresentation: RulesetPresentation = {
  projectReference: projectClassicReference,
  UnitData: ClassicUnitDataPanel,
  PrintAppendix: ({reference}) => <ClassicPrintUnitDataAppendix reference={classicReferenceData(reference)} />,
};
