import {
  allocateResources,
  resolveChoiceTargets,
  type CatalogShell,
  type RosterDocument,
  type ResourcePool,
  type ResourceDemand,
} from '@battlegroup/core';

export interface SectionAllowance {
  readonly selected: number;
  readonly minimum?: number;
  readonly included?: number;
  readonly limits: readonly { used: number; capacity: number; shared: boolean }[];
}

/** Display projection using the same allocator as evaluation, without repricing. */
export function projectSectionAllowances(
  document: RosterDocument,
  catalog: CatalogShell,
  topLevelEntryIds: ReadonlySet<string>,
): ReadonlyMap<string, SectionAllowance> {
  const entries = new Map(catalog.entries.map(entry => [entry.localId, entry]));
  const selections = new Map(document.selections.map(selection => [selection.selectionId, selection]));
  const pools: ResourcePool[] = [];
  const demands: ResourceDemand[] = [];
  const sectionOf = (id: string): string | undefined => {
    const seen = new Set<string>();
    let selection = selections.get(id);
    while (selection?.parentSelectionId && !seen.has(selection.selectionId)) {
      seen.add(selection.selectionId);
      selection = selections.get(selection.parentSelectionId);
    }
    return selection?.sectionId;
  };
  for (const selection of document.selections) {
    const entry = entries.get(selection.entryReference.localId);
    if (!entry) continue;
    for (const grant of entry.resourceGrants ?? []) pools.push({ producerId: selection.selectionId, grant });
    for (const demand of entry.resourceConsumptions ?? []) demands.push({ ...demand, consumerId: selection.selectionId, ownerId: selection.parentSelectionId, memberPath: selection.targetMemberPath ?? [] });
    const seenSelectors = new Set<string>();
    for (const choice of selection.optionChoices) {
      const option = catalog.optionGroups.find(group => group.localId === choice.optionGroupLocalId)?.options.find(option => option.localId === choice.optionLocalId);
      if (!option?.resourceConsumptions?.length) continue;
      if (option.target.kind === 'scope-selector') {
        const key = JSON.stringify([choice.optionGroupLocalId, choice.optionLocalId]);
        if (seenSelectors.has(key)) continue;
        seenSelectors.add(key);
      }
      for (const target of resolveChoiceTargets(document, catalog, selection.selectionId, option, choice)) {
        for (const demand of option.resourceConsumptions) demands.push({ ...demand, consumerId: selection.selectionId, ownerId: selection.selectionId, memberPath: target.kind === 'member-path' ? target.nodePath : [] });
      }
    }
  }
  const sections = catalog.armyLists.find(list => list.armyListId === document.armyListId)?.structure.sections ?? [];
  return new Map(sections.map(section => {
    const candidates = catalog.entries.filter(entry => topLevelEntryIds.has(entry.localId) && entry.armyListIds.includes(document.armyListId) && entry.sectionIds.includes(section.sectionId));
    const signatures = new Map(candidates.flatMap(entry => (entry.resourceConsumptions ?? []).map(demand => [JSON.stringify([demand.resourceKind, demand.category]), demand] as const)));
    const limits = [...signatures.values()].map(demand => {
      const relevant = demands.filter(item => item.resourceKind === demand.resourceKind && item.category === demand.category && sectionOf(item.consumerId) === section.sectionId);
      const others = demands.filter(item => !relevant.includes(item));
      const eligible = pools.filter(pool => pool.grant.scope === 'army' && pool.grant.resourceKind === demand.resourceKind && (!pool.grant.eligibleCategories || (demand.category !== undefined && pool.grant.eligibleCategories.includes(demand.category))));
      // Maximum usable here after holding other sections fixed. Reallocation
      // matters: simply subtracting each pool's current use can undercount.
      let low = 0;
      let high = eligible.reduce((sum, pool) => sum + pool.grant.capacity, 0);
      const probeId = '@section-allowance';
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const allocation = allocateResources(pools, [...others, { ...demand, consumerId: probeId, ownerId: null, memberPath: [], amount: mid }]);
        if (allocation.unfunded.some(item => item.consumerId === probeId)) high = mid - 1;
        else low = mid;
      }
      return {
        used: relevant.reduce((sum, item) => sum + item.amount, 0),
        capacity: low,
        shared: eligible.some(pool => !pool.grant.eligibleCategories || pool.grant.eligibleCategories.some(category => category !== demand.category)),
      };
    });
    return [section.sectionId, {
      selected: document.selections.filter(selection => selection.parentSelectionId === null && selection.sectionId === section.sectionId).length,
      limits,
    }];
  }));
}
