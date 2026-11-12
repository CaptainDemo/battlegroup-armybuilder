import type { CatalogShell, CompositionNode, Option } from '../contracts/catalog';
import type { OptionChoice, OptionChoiceTarget, RosterDocument } from '../contracts/roster';

/** Rebuilds declarative all targets from the current purchase tree, never from cached totals. */
export function resolveChoiceTargets(document:RosterDocument,catalog:CatalogShell,selectionId:string,option:Option,choice:OptionChoice):OptionChoiceTarget[] {
  if (option.target.kind!=='scope-selector') return uniqueTargets(choice.targets);
  const selector = option.target;
  const ids = new Set([selectionId]);
  if (selector.includeSubFormations) {
    let changed = true;
    while(changed){changed=false;for(const selection of document.selections) if(selection.parentSelectionId && ids.has(selection.parentSelectionId) && !ids.has(selection.selectionId)){ids.add(selection.selectionId);changed=true;}}
  }
  const targets:OptionChoiceTarget[] = [];
  for (const selection of document.selections.filter(item=>ids.has(item.selectionId))) {
    const boundary=selector.rootMemberPath??[];
    if(selection.selectionId!==selectionId && boundary.length) {
      let anchor=selection;
      while(anchor.parentSelectionId && anchor.parentSelectionId!==selectionId) anchor=document.selections.find(item=>item.selectionId===anchor.parentSelectionId)!;
      if(!boundary.every((id,i)=>anchor.targetMemberPath?.[i]===id))continue;
    }
    const entry = catalog.entries.find(item=>item.localId===selection.entryReference.localId);
    if (entry?.composition.state!=='known') continue;
    const visit = (node:CompositionNode,path:string[]):void => {
      if(path.length && (selection.selectionId!==selectionId||boundary.every((id,i)=>path[i]===id)) && node.profileLocalId && selector.matchProfileLocalIds.includes(node.profileLocalId)) {
        targets.push(selection.selectionId===selectionId?{kind:'member-path',nodePath:path}:{kind:'attachment-member',ownerSelectionId:selection.selectionId,nodePath:path});
      }
      if(selector.includeSubFormations || path.length===0) for(const child of node.children??[]) visit(child,[...path,child.nodeId]);
    };
    visit(entry.composition.root,[]);
  }
  return uniqueTargets(targets);
}

export function uniqueTargets(targets:readonly OptionChoiceTarget[]):OptionChoiceTarget[] {
  const seen = new Set<string>();
  return structuredClone(targets.filter(target=>{const key=JSON.stringify(target);if(seen.has(key)) return false;seen.add(key);return true;}));
}

/** Per-target charges and limits count units from the base composition. */
export function optionTargetUnits(document: RosterDocument, catalog: CatalogShell, selectionId: string, target: OptionChoiceTarget): number {
  if (target.kind === 'whole-selection') return 1;

  const ownerId = target.kind === 'attachment-member' ? target.ownerSelectionId : selectionId;
  const owner = document.selections.find(selection => selection.selectionId === ownerId);
  const entry = catalog.entries.find(item => item.localId === owner?.entryReference.localId);
  if (entry?.composition.state !== 'known') return 0;

  let node = entry.composition.root;
  let quantity = node.quantity;
  for (const id of target.nodePath) {
    const child = node.children?.find(member => member.nodeId === id);
    if (!child) return 0;
    node = child;
    quantity *= node.quantity;
  }
  return quantity;
}
