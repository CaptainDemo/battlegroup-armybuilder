import { z } from 'zod';
import { catalogShellSchema, rosterDocumentSchema } from '@battlegroup/core';
import { classicUnitProfileSchema } from './profiles';
import { classicTrainingLevelSchema } from './training';

/**
 * Classic-specific catalog and roster schema boundary.
 *
 * Core defines the ruleset-agnostic catalog shell with identity-only
 * profiles and opaque training tokens. Classic extends that shell, without
 * touching core or other rulesets:
 * - the catalog and roster boundaries are *locked to the classic-coldwar
 *   identity* (rework R3): an AirLand or NORTHAG document with identical
 *   names and attributes is rejected rather than claimed by this schema;
 * - profiles carry Classic's own tracked combat stats;
 * - every `training-change` effect and every known `baseTraining` token must
 *   name a Classic level i/r/v/e (the enum lives here, never in core);
 * - game sizes follow C13 (Squad/Platoon/Company/Battalion); budget stays
 *   independent of size.
 */
export const classicGameSizeSchema = z.enum(['squad', 'platoon', 'company', 'battalion']);
export type ClassicGameSize = z.infer<typeof classicGameSizeSchema>;

type CoreCatalogShape = z.output<typeof catalogShellSchema>;

function checkClassicCatalog(catalog: CoreCatalogShape, ctx: z.RefinementCtx): void {
  const rulesetId = catalog.manifest.identity.rulesetId;
  if (rulesetId !== 'classic-coldwar') {
    ctx.addIssue({
      code: 'custom',
      message: `catalog declares ruleset "${rulesetId}"; the Classic Cold War schema only accepts classic-coldwar data (same-name records of other rulesets are not Classic records)`,
      path: ['manifest', 'identity', 'rulesetId'],
      input: catalog.manifest.identity,
    });
    return; // nothing else is meaningful for a foreign catalog
  }
  for (const armyList of catalog.armyLists) {
    if (armyList.rulesetId !== 'classic-coldwar') {
      ctx.addIssue({
        code: 'custom',
        message: `army list "${armyList.armyListId}" declares ruleset "${armyList.rulesetId}" instead of classic-coldwar`,
        path: ['armyLists', armyList.armyListId, 'rulesetId'],
        input: armyList,
      });
    }
  }
  for (const entry of catalog.entries) {
    const baseTraining = entry.baseTraining;
    if (baseTraining !== undefined && baseTraining.state === 'known') {
      if (!classicTrainingLevelSchema.safeParse(baseTraining.value).success) {
        ctx.addIssue({
          code: 'custom',
          message: `entry "${entry.localId}" declares base training "${baseTraining.value}", which is not a Classic training level (i/r/v/e)`,
          path: ['entries', entry.localId, 'baseTraining'],
          input: baseTraining,
        });
      }
    }
  }
  for (const group of catalog.optionGroups) {
    for (const option of group.options) {
      for (const effect of option.effects) {
        if (effect.kind !== 'training-change') {
          continue;
        }
        if (!classicTrainingLevelSchema.safeParse(effect.toTrainingLevel).success) {
          ctx.addIssue({
            code: 'custom',
            message: `option "${option.localId}" changes training to "${effect.toTrainingLevel}", which is not a Classic training level (i/r/v/e)`,
            path: ['optionGroups', group.localId, 'options', option.localId, 'effects'],
            input: effect,
          });
        }
      }
    }
  }
}

export const classicCatalogShellSchema = catalogShellSchema
  .extend({ profiles: z.array(classicUnitProfileSchema) })
  .superRefine((catalog, ctx) => {
    checkClassicCatalog(catalog, ctx);
  });
export type ClassicCatalogShell = z.output<typeof classicCatalogShellSchema>;

function checkClassicRoster(roster: z.output<typeof rosterDocumentSchema>, ctx: z.RefinementCtx): void {
  if (roster.settings.playerRoleId !== undefined && !['attacker','defender'].includes(roster.settings.playerRoleId)) {
    ctx.addIssue({code:'custom',path:['settings','playerRoleId'],message:'Classic player role must be attacker or defender.'});
  }
  if (roster.catalogRef.rulesetId !== 'classic-coldwar') {
    ctx.addIssue({
      code: 'custom',
      message: `roster is bound to ruleset "${roster.catalogRef.rulesetId}"; the Classic Cold War schema only accepts classic-coldwar rosters`,
      path: ['catalogRef', 'rulesetId'],
      input: roster.catalogRef,
    });
    return; // a foreign roster is not a Classic document at all
  }
  for (const selection of roster.selections) {
    if (selection.entryReference.rulesetId !== 'classic-coldwar') {
      ctx.addIssue({
        code: 'custom',
        message: `selection "${selection.selectionId}" references ruleset "${selection.entryReference.rulesetId}" instead of classic-coldwar`,
        path: ['selections', selection.selectionId, 'entryReference', 'rulesetId'],
        input: selection.entryReference,
      });
    }
  }
  if (!classicGameSizeSchema.safeParse(roster.settings.gameSizeId).success) {
    ctx.addIssue({
      code: 'custom',
      message: `game size "${roster.settings.gameSizeId}" is not a Classic game size (squad/platoon/company/battalion)`,
      path: ['settings', 'gameSizeId'],
      input: roster.settings,
    });
  }
}

export const classicRosterDocumentSchema = rosterDocumentSchema.superRefine(checkClassicRoster);
export type ClassicRosterDocument = z.output<typeof classicRosterDocumentSchema>;
