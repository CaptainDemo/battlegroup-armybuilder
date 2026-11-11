import type { ComponentType } from 'react';
import type { CatalogShell, EvaluatedCompositionNode, Evaluation } from '@battlegroup/core';
import type { AppCatalogRelease } from './types';

/** Only shared summary fields. Combat columns and schemas stay inside their adapter. */
export interface PrintReferenceView {
  supported: boolean;
  vehicles: readonly {key: string; profileLocalId: string; quantity: number; label: string; weaponNames: readonly string[]; upgraded: boolean}[];
  weapons: readonly {quantity: number; label: string; unitEquipment: boolean}[];
  missingWeaponProfiles: readonly string[];
  unclassifiedProfiles: readonly string[];
  combatSource: string;
  weaponSource: string;
  /** Serialisable adapter-owned view data, derived locally, never persisted/imported. */
  appendix: {format: string; data: unknown} | null;
}
export interface RulesetPresentation {
  specialRules?: import('./specialRules').SpecialRulesAdapter;
  projectReference(catalog: CatalogShell, evaluation: Evaluation): PrintReferenceView;
  UnitData: ComponentType<{node: EvaluatedCompositionNode; release: AppCatalogRelease}>;
  PrintAppendix: ComponentType<{reference: PrintReferenceView}>;
}
export function unavailableReference(): PrintReferenceView {
  return {supported: false, vehicles: [], weapons: [], missingWeaponProfiles: [], unclassifiedProfiles: [], combatSource: '', weaponSource: '', appendix: null};
}
