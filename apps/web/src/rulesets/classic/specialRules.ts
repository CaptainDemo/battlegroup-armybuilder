import { z } from 'zod';
import type { SpecialRulesAdapter } from '../specialRules';
import { createSpecialRuleLookup } from '../specialRules';
import raw from '../../../../../packages/catalogs/classic-coldwar/reference/special-rules-v1.json';

const reference = z.object({rulesetId: z.literal('classic-coldwar'), revision: z.string(),
  bindings: z.array(z.object({catalogId: z.string(), catalogRevision: z.string(), rulesRevision: z.string()})),
  definitions: z.array(z.object({id: z.string(), name: z.string(), text: z.string().min(1), source: z.string().min(1)})),
}).parse(raw);

// These are engine constraints, not the book's Special Rules column.
const internal = new Set(['toc-battalion-only', 'company-sam', 'pt76-tank-exclusion', 'restricted-choice', 'sa7-squad', 'ground-transport-upgrade', 'helicopter-conversion', 'platoon-commander']);
const playable = (id: string) => !id.includes(':') && !internal.has(id);
const tags = (values: readonly string[] = []) => values.filter(id => ['officer', 'senior-officer', 'scout', 'scout2'].includes(id));
export const classicSpecialRules: SpecialRulesAdapter = {
  entryRules: (entry, _selection, catalog) => catalog.manifest.identity.rulesetId === 'classic-coldwar' ? (entry.specialRules ?? []).filter(playable) : [],
  nodeRules(node, catalog) {
    if (catalog.manifest.identity.rulesetId !== 'classic-coldwar') return [];
    // Core's profile view intentionally omits concrete rule fields.
    const profile = catalog.profiles.find(item => item.localId === node.profileLocalId);
    const parsed = z.object({specialRules: z.array(z.string()).optional()}).safeParse(profile);
    return [...(parsed.success ? parsed.data.specialRules ?? [] : []).filter(playable), ...tags(node.tags)];
  },
  definition: createSpecialRuleLookup(reference),
  label: id => id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
};
