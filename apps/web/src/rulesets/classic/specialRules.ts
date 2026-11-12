import { z } from 'zod';
import type { SpecialRulesAdapter } from '../specialRules';
import { createSpecialRuleLookup } from '../specialRules';
import raw from '../../../../../packages/catalogs/classic-coldwar/reference/special-rules-v1.json';

const reference = z.object({rulesetId: z.literal('classic-coldwar'), revision: z.string(),
  bindings: z.array(z.object({catalogId: z.string(), catalogRevision: z.string(), rulesRevision: z.string()})),
  definitions: z.array(z.object({id: z.string(), name: z.string(), text: z.string().min(1), source: z.string().min(1)})),
}).parse(raw);

// Map catalog shorthand to the printed rule it identifies in the Soviet list.
const ruleIds = new Map([
  ['company-sam', 'sam'],
  ['ground-radar', 'ground-surveillance-radar'],
  ['sniper', 'sniper-scout'],
  ['toc-battalion-only', 'tactical-operations-centre'],
]);
const internal = new Set(['pt76-tank-exclusion', 'restricted-choice', 'sa7-squad', 'ground-transport-upgrade', 'helicopter-conversion']);
const playable = (id: string) => !id.includes(':') && !internal.has(id);
const purchaseRuleTags = new Set(['unique', 'restricted', 'medic', 'mortar-spotter']);
const evaluatedRuleTags = new Map([
  ['officer', 'officer'],
  ['senior-officer', 'senior-officer'],
  ['scout', 'scout'],
  ['scout2', 'scout2'],
  ['kmt', 'mine-plough'],
]);
const combatMedicEntries = new Set(['bmp1-platoon-medic', 'bmp1-company-medic', 'bmp2-platoon-medic', 'bmp2-company-medic']);
const profileRules = new Map([
  ['3-man-loader-team', 'loader-team'],
  ['brm-1', 'ground-surveillance-radar'],
  ['svd-marksman', 'marksman'],
  ['t-55-with-kmt-mine-plough', 'mine-plough'],
  ['t-62-with-kmt-mine-plough', 'mine-plough'],
]);
const profileWithRules = z.object({specialRules: z.array(z.string()).optional()});
const catalogRules = (ids: readonly string[] = []) => ids.filter(playable).map(id => ruleIds.get(id) ?? id);

export const classicSpecialRules: SpecialRulesAdapter = {
  entryRules(entry, _selection, catalog) {
    if (catalog.manifest.identity.rulesetId !== 'classic-coldwar') return [];
    const rules = [...catalogRules(entry.specialRules), ...(entry.tags ?? []).filter(id => purchaseRuleTags.has(id))];
    if (combatMedicEntries.has(entry.localId)) rules.push('medic');
    return [...new Set(rules)];
  },
  nodeRules(node, catalog) {
    if (catalog.manifest.identity.rulesetId !== 'classic-coldwar') return [];
    // Core's profile view intentionally omits concrete rule fields.
    const profile = catalog.profiles.find(item => item.localId === node.profileLocalId);
    const parsed = profileWithRules.safeParse(profile);
    const rules = parsed.success ? catalogRules(parsed.data.specialRules) : [];
    for (const tag of node.tags ?? []) {
      const rule = evaluatedRuleTags.get(tag);
      if (rule) rules.push(rule);
    }
    const equipmentRule = profile && profileRules.get(profile.localId);
    if (equipmentRule) rules.push(equipmentRule);
    if (node.role === 'platoon-command') rules.push('platoon-commander');
    return rules;
  },
  definition: createSpecialRuleLookup(reference),
  label: id => id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
};
