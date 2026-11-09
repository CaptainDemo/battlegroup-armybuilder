import { corePackageId } from '@battlegroup/core';
export { classicCatalogReleaseSchema, type ClassicCatalogRelease } from './releaseSchema';
export { evaluateClassicRoster, getClassicEntryAvailability, createClassicRuleset } from './rules';
import { classicCatalogShellSchema, classicGameSizeSchema, classicRosterDocumentSchema } from './classicSchema';
import type { ClassicCatalogShell, ClassicRosterDocument } from './classicSchema';
import { classicTrainingLevelLabels, classicTrainingLevelSchema, isClassicTrainingLevel } from './training';
import type { ClassicTrainingLevel } from './training';
import { classicUnitProfileSchema } from './profiles';
import type { ClassicProfileStats, ClassicUnitProfile } from './profiles';
import { unverifiedStats } from './profiles';

/**
 * Static identity for the Classic Cold War ruleset module.
 *
 * The ruleset models "Unofficial Battlegroup: Cold War" (Draft 6) with the
 * Soviet Armoured Division V4.1 list as the first sample. M07 exports its
 * evaluator separately; the descriptor remains in-development because
 * catalog and full-rule coverage are partial.
 *
 * M03 adds the Classic schema boundary on top of the M02 descriptor:
 * training levels (i/r/v/e), tracked combat stats (unknown until verified)
 * and the Classic catalog/roster refinements. These exports stay importable
 * from plain Node without a DOM.
 *
 * Game data is fully isolated per ruleset. Classic Cold War never shares
 * unit, weapon, option or catalogue records with AirLand or NORTHAG even
 * when names or stats match; shared assets are code and types only.
 */
export type RulesetModuleStatus = 'planned' | 'in-development' | 'usable';

export interface RulesetModuleDescriptor {
  readonly id: 'classic-coldwar';
  readonly label: string;
  readonly status: RulesetModuleStatus;
  /** The core package this module builds on; the web app composes both. */
  readonly corePackageId: typeof corePackageId;
}

export const classicColdWarRuleset: RulesetModuleDescriptor = {
  id: 'classic-coldwar',
  label: 'Classic Cold War',
  status: 'in-development',
  corePackageId,
};

export {
  classicTrainingLevelSchema,
  classicTrainingLevelLabels,
  isClassicTrainingLevel,
};
export type { ClassicTrainingLevel };
export { classicUnitProfileSchema, unverifiedStats };
export type { ClassicUnitProfile, ClassicProfileStats };
export { classicCatalogShellSchema, classicRosterDocumentSchema, classicGameSizeSchema };
export type { ClassicCatalogShell, ClassicRosterDocument };
export { classicCombatReferenceSchema, findClassicCombatCard } from './combatReference';
export type { ClassicCombatReference, ClassicCombatCard } from './combatReference';
export { classicWeaponReferenceSchema, findClassicWeaponBinding } from './weaponReference';
export type { ClassicWeaponReference, ClassicWeapon, ClassicWeaponBinding } from './weaponReference';
