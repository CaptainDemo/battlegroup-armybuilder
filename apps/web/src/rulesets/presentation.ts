import type { RulesetId } from '@battlegroup/core';
import type { RulesetPresentation } from './presentationTypes';
import { classicPresentation } from './classic/presentation';

const presentations: Partial<Record<RulesetId, RulesetPresentation>> = {
  'classic-coldwar': classicPresentation,
};
export const getPresentation = (id: RulesetId): RulesetPresentation | undefined => presentations[id];
