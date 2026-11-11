import type { CatalogShell, EvaluatedCompositionNode, Evaluation, RosterDocument, RosterSelection, UnitEntry } from '@battlegroup/core';

export interface SpecialRuleDefinition { id: string; name: string; text: string; source: string }
export interface SpecialRuleReference {
  rulesetId: string;
  bindings: readonly {catalogId: string; catalogRevision: string; rulesRevision: string}[];
  definitions: readonly SpecialRuleDefinition[];
}
/** Shared lookup algorithm; callers supply separate, source-verified rule records. */
export function createSpecialRuleLookup(reference: SpecialRuleReference) {
  if (new Set(reference.definitions.map(rule => rule.id)).size !== reference.definitions.length) throw new Error('Duplicate special rule');
  return (id: string, catalog: CatalogShell): SpecialRuleDefinition | undefined => {
    const manifest = catalog.manifest;
    if (manifest.identity.rulesetId !== reference.rulesetId || !reference.bindings.some(binding =>
      binding.catalogId === manifest.identity.catalogId && binding.catalogRevision === manifest.identity.catalogRevision && binding.rulesRevision === manifest.rulesRevision)) return undefined;
    return reference.definitions.find(rule => rule.id === id);
  };
}
/** Implementations own interpretation, applicability and exact-version text lookup. */
export interface SpecialRulesAdapter {
  entryRules(entry: UnitEntry, selection: RosterSelection, catalog: CatalogShell): readonly string[];
  nodeRules(node: EvaluatedCompositionNode, catalog: CatalogShell): readonly string[];
  definition(id: string, catalog: CatalogShell): SpecialRuleDefinition | undefined;
  label(id: string): string;
}
export interface SpecialRuleView { key: string; id: string; name: string; text: string | null; source: string | null }
export interface SpecialRuleUse { selectionId: string; path: string[]; unit: string; rules: SpecialRuleView[] }
export interface SpecialRulesView { supported: boolean; uses: SpecialRuleUse[]; rules: SpecialRuleView[] }

/** Reads evaluated members (including replacements), never the unconfigured base tree. */
export function projectSpecialRules(document: RosterDocument, catalog: CatalogShell, evaluation: Evaluation, adapter?: SpecialRulesAdapter): SpecialRulesView {
  const view: SpecialRulesView = {supported: !!adapter, uses: [], rules: []};
  if (!adapter) return view;
  const identity = catalog.manifest.identity;
  const resolve = (id: string): SpecialRuleView => {
    const definition = adapter.definition(id, catalog);
    return {key: JSON.stringify([identity.rulesetId, identity.catalogId, identity.catalogRevision, catalog.manifest.rulesRevision, id]), id,
      name: definition?.name ?? adapter.label(id), text: definition?.text || null, source: definition?.source || null};
  };
  for (const selection of document.selections) {
    const entry = catalog.entries.find(item => item.localId === selection.entryReference.localId);
    if (!entry) continue;
    const root = evaluation.composition.find(item => item.selectionId === selection.selectionId)?.node;
    const add = (path: string[], unit: string, ids: readonly string[]) => {
      const rules = [...new Set(ids)].map(resolve);
      if (rules.length) view.uses.push({selectionId: selection.selectionId, path, unit, rules});
    };
    add([], entry.name, adapter.entryRules(entry, selection, catalog));
    const visit = (node: EvaluatedCompositionNode, path: string[]) => {
      if (node.quantity <= 0) return;
      add(path, (node.profileLocalId ? catalog.profiles.find(p => p.localId === node.profileLocalId)?.name : undefined) ?? entry.name + ' / ' + (path.join(' / ') || node.role), adapter.nodeRules(node, catalog));
      for (const child of node.children ?? []) visit(child, [...path, child.nodeId]);
    };
    if (root) visit(root, []);
  }
  view.rules = uniqueRules(view.uses);
  return view;
}
export function uniqueRules(uses: readonly SpecialRuleUse[]): SpecialRuleView[] {
  return [...new Map(uses.flatMap(use => use.rules.map(rule => [rule.key, rule] as const))).values()];
}
/** A selected member includes only attachments anchored inside that member. */
export function specialRulesForSelection(view: SpecialRulesView, document: RosterDocument, selectionId: string, path: readonly string[] = []): SpecialRulesView {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of document.selections) {
      if (descendants.has(child.selectionId)) continue;
      if ((child.parentSelectionId === selectionId && path.every((part, i) => child.targetMemberPath?.[i] === part)) ||
          (child.parentSelectionId && descendants.has(child.parentSelectionId))) {
        descendants.add(child.selectionId); changed = true;
      }
    }
  }
  const uses = view.uses.filter(use => descendants.has(use.selectionId) || (use.selectionId === selectionId && path.every((part, i) => use.path[i] === part)));
  return {supported: view.supported, uses, rules: uniqueRules(uses)};
}
