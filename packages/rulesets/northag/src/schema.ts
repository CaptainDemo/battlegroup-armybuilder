import { z } from 'zod';
import {
  catalogShellSchema, localIdSchema, profileIdentitySchema, quantityLimitSchema,
  resolveCompositionPath, rosterDocumentSchema, rosterSettingsSchema, validateCatalogRelations,
} from '@battlegroup/core';

export const northagRulesRevision = 'northag-2020+errata-v9';
export const northagTrainingLabels = { c: 'Conscript', p: 'Professional', e: 'Elite' };
export const northagGameSizes = {
  platoon: { points: 500, restricted: 2, requests: 3 },
  company: { points: 750, restricted: 3, requests: 4 },
  battalion: { points: 1000, restricted: 4, requests: 5 },
} as const;
export const northagRequestRule = 'reinforcement-requests';
export const northagRangeBands = ['0–20', '20–30', '30–40', '40–50', '50–70'] as const;

const armourValue = z.number().int().nonnegative();
const armour = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('soft-skin') }),
  z.strictObject({ kind: z.literal('armoured'), front: armourValue, side: armourValue, rear: armourValue }),
]);
const band = z.number().int().nonnegative().nullable();
export const northagProfileSchema = profileIdentitySchema.extend({
  kind: z.enum(['vehicle', 'infantry', 'gun', 'aircraft', 'weapon']),
  rules: z.array(localIdSchema),
  movement: z.string().optional(),
  armour: armour.optional(),
  capacity: z.number().int().nonnegative().optional(),
  mounts: z.array(z.strictObject({
    weaponId: localIdSchema,
    mount: z.string().optional(),
    rate: z.string().optional(),
    ammunition: z.number().int().positive().optional(),
    doubleRoll: z.boolean().optional(),
  })),
  fireModes: z.array(z.strictObject({
    ammo: z.enum(['AP', 'HE']),
    he: z.string().optional(),
    bands: z.tuple([band, band, band, band, band]).optional(),
    minRange: z.number().nonnegative().optional(),
  })).optional(),
  range: z.number().positive().optional(),
  note: z.string().optional(),
}).strict();
export type NorthagProfile = z.infer<typeof northagProfileSchema>;

const ruleDefinition = z.strictObject({ id: localIdSchema, name: z.string().min(1), text: z.string().min(1), source: z.string().min(1) });
const purchase = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('top-level'), entryId: localIdSchema }),
  z.strictObject({
    kind: z.literal('attachment'),
    entryId: localIdSchema,
    parentEntryIds: z.array(localIdSchema).min(1),
    parentMemberPaths: z.record(localIdSchema, z.array(z.array(localIdSchema).min(1)).min(1)).optional(),
  }),
]);

export const northagReleaseSchema = z.strictObject({
  moduleContract: z.literal('northag/1'),
  catalog: catalogShellSchema.extend({
    profiles: z.array(northagProfileSchema),
    ruleDefinitions: z.array(ruleDefinition),
  }),
  purchases: z.array(purchase),
  entryLimits: z.record(localIdSchema, quantityLimitSchema),
  coverage: z.strictObject({ omitted: z.array(z.string().min(1)), note: z.string().min(1) }),
}).superRefine((release, ctx) => {
  const { catalog, purchases, entryLimits } = release;
  const report = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (catalog.manifest.identity.rulesetId !== 'northag' || catalog.manifest.rulesRevision !== northagRulesRevision) {
    report('catalog', 'This release must use the supported NORTHAG 2020 and v9 rules revision.');
  }
  const entries = new Map(catalog.entries.map(entry => [entry.localId, entry]));
  const accesses = new Map(purchases.map(item => [item.entryId, item]));
  if (accesses.size !== purchases.length || accesses.size !== entries.size) report('purchases', 'Each entry needs exactly one purchase context.');
  for (const [id, entry] of entries) {
    const access = accesses.get(id);
    if (!access) report('purchases', 'Missing purchase context: ' + id);
    if (entry.baseTraining?.state === 'known' && !Object.hasOwn(northagTrainingLabels, entry.baseTraining.value)) {
      report('catalog', 'Unknown NORTHAG training: ' + entry.baseTraining.value);
    }
    if (access?.kind === 'top-level' && !(id in entryLimits)) report('entryLimits', 'Missing entry limit: ' + id);
    if (access?.kind === 'attachment') {
      for (const parentId of access.parentEntryIds) {
        const parent = entries.get(parentId);
        if (!parent || accesses.get(parentId)?.kind !== 'top-level') {
          report('purchases', 'Unknown attachment parent: ' + parentId);
          continue;
        }
        for (const path of access.parentMemberPaths?.[parentId] ?? []) {
          if (!resolveCompositionPath(parent, path)?.configurableSlot) report('purchases', 'Invalid attachment anchor: ' + parentId + '/' + path.join('/'));
        }
      }
      if (Object.keys(access.parentMemberPaths ?? {}).some(id => !access.parentEntryIds.includes(id))) {
        report('purchases', 'Attachment anchor references an ineligible parent.');
      }
    }
  }
  for (const id of Object.keys(entryLimits)) {
    if (accesses.get(id)?.kind !== 'top-level') report('entryLimits', 'Unknown or non-top-level limit target: ' + id);
  }
  const profiles = new Map(catalog.profiles.map(profile => [profile.localId, profile]));
  const definitions = new Set(catalog.ruleDefinitions.map(rule => rule.id));
  if (definitions.size !== catalog.ruleDefinitions.length) report('catalog', 'Duplicate special rule definition.');
  for (const profile of catalog.profiles) {
    for (const mount of profile.mounts) {
      if (profiles.get(mount.weaponId)?.kind !== 'weapon') report('catalog', 'Unknown weapon mount: ' + mount.weaponId);
    }
  }
  for (const record of [...catalog.entries, ...catalog.profiles]) {
    const rules = 'rules' in record ? record.rules : record.specialRules ?? [];
    for (const id of rules) if (!definitions.has(id)) report('catalog', 'Missing special rule text: ' + id);
  }
  for (const issue of validateCatalogRelations(catalog)) report('catalog', issue.checkId + ': ' + issue.message);
});
export type NorthagRelease = z.infer<typeof northagReleaseSchema>;
export type NorthagCatalog = NorthagRelease['catalog'];

export const northagRosterSchema = rosterDocumentSchema.extend({
  catalogRef: rosterDocumentSchema.shape.catalogRef.extend({ rulesetId: z.literal('northag') }),
  settings: rosterSettingsSchema.extend({
    gameSizeId: z.enum(['platoon', 'company', 'battalion']),
    optionalRules: z.array(z.literal(northagRequestRule)).max(1),
    scenarioId: z.never().optional(),
    playerRoleId: z.never().optional(),
  }),
});
