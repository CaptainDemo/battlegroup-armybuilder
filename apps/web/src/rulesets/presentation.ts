import type { RulesetId } from '@battlegroup/core';
import type { RulesetPresentation } from './presentationTypes';
import { classicPresentation } from './classic/presentation';
import { northagPresentation } from './northag/presentation';

const presentations: Partial<Record<RulesetId, RulesetPresentation>> = {
  'classic-coldwar': classicPresentation,
  northag: northagPresentation,
};
export const getPresentation = (id: RulesetId): RulesetPresentation | undefined => presentations[id];
