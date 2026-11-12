import type { CatalogShell, Option } from '../contracts/catalog';
import type { ChargeLine, Evaluation, EvaluatedCompositionNode, MeasureStatus, RosterIssue } from '../contracts/evaluation';
import { rosterDocumentSchema, type OptionChoiceTarget, type RosterDocument, type RosterSelection } from '../contracts/roster';
import { manifestVersionIdentity } from '../contracts/versioning';
import type { TrackedValue } from '../contracts/values';
import { validateRosterRelations } from '../validation/rosterRelations';
import { allocateResources, type ResourceDemand, type ResourcePool } from './resources';
import { optionTargetUnits, resolveChoiceTargets } from './targets';

/** Generic deterministic evaluation over a schema/relation-validated catalog. Game thresholds belong to a ruleset. */
export function evaluateRoster(document:RosterDocument,catalog:CatalogShell):Evaluation {
  const evaluation:Evaluation = {
    identity:{rosterId:document.rosterId,inputRevision:document.revision,catalog:catalog.manifest.identity,versions:manifestVersionIdentity(catalog.manifest)},
    composition:[],chargeLines:[],totals:{points:{knownSubtotal:0,complete:false,incompleteChargeLineIds:[]},br:{knownSubtotal:0,complete:false,incompleteChargeLineIds:[]}},
    resources:[],statistics:[],issues:[],coverage:[],legality:'undetermined',
  };
  const shape=rosterDocumentSchema.safeParse(document);
  const invalid=shape.success?validateRosterRelations(document,catalog).map(issue=>({ruleId:issue.checkId,message:issue.message})):shape.error.issues.map(issue=>({ruleId:'structure/schema',message:issue.message}));
  if(invalid.length) return {...evaluation,issues:invalid.map(issue=>({...issue,severity:'error' as const})),coverage:[{checkId:'structure',status:'blocked-unknown-data'}],legality:'violations-confirmed'};

  const issues:RosterIssue[]=[];
  const chargeLines:ChargeLine[]=[];
  const nodes=new Map<string,EvaluatedCompositionNode>();
  const pools:ResourcePool[]=[];
  const demands:ResourceDemand[]=[];
  let compositionComplete=true;
  let optionCoverage=true;
  const addIssue=(ruleId:string,message:string,selectionId:string):void=>{issues.push({ruleId,message,selectionId,severity:'error'});};
  const entries=new Map(catalog.entries.map(entry=>[entry.localId,entry]));
  for(const selection of document.selections) {
    const entry=entries.get(selection.entryReference.localId)!;
    if(entry.composition.state==='known') {
      const node:EvaluatedCompositionNode=structuredClone(entry.composition.root);
      if(entry.baseTraining) node.training=structuredClone(entry.baseTraining);
      node.tags=[...(entry.tags??[])];
      nodes.set(selection.selectionId,node);
    } else if(entry.composition.state==='pending') compositionComplete=false;
    chargeLines.push({chargeLineId:JSON.stringify(['base',selection.selectionId]),attributionKey:JSON.stringify(['base',selection.selectionId]),kind:selection.parentSelectionId===null?'base-cost':'attachment-cost',selectionId:selection.selectionId,chargedUnits:1,points:entry.baseCost.points,br:entry.baseCost.br,sourceRefs:entry.sourceRefs});
    for(const grant of entry.resourceGrants??[]) pools.push({producerId:selection.selectionId,grant});
    for(const demand of entry.resourceConsumptions??[]) demands.push({...demand,consumerId:selection.selectionId,ownerId:selection.parentSelectionId,memberPath:selection.targetMemberPath??[]});
  }
  const applications:Array<{selection:RosterSelection;option:Option;targets:OptionChoiceTarget[]}> = [];
  const usage=new Map<string,{amount:number;max:number;selectionId:string;ruleId:string}>();
  const addUsage=(key:string,amount:number,max:number,selectionId:string,ruleId:string):void=>{
    const old=usage.get(key);usage.set(key,{amount:(old?.amount??0)+amount,max,selectionId,ruleId});
  };
  const seenScopes=new Set<string>();
  const replacementPrices=new Map<string,{points:TrackedValue;br:TrackedValue}>();
  for(const selection of document.selections) {
    for(const [choiceIndex,choice] of selection.optionChoices.entries()) {
      const group=catalog.optionGroups.find(item=>item.localId===choice.optionGroupLocalId)!;
      const option=group.options.find(item=>item.localId===choice.optionLocalId)!;
      const targets=resolveChoiceTargets(document,catalog,selection.selectionId,option,choice);
      if(!targets.length){addIssue('option/no-targets','The option has no matching current members.',selection.selectionId);continue;}
      const scope=optionScope(document,selection,group.scope);
      const scopedChoices=document.selections.filter(item=>optionScope(document,item,group.scope)===scope).flatMap(item=>item.optionChoices).filter(item=>item.optionGroupLocalId===group.localId);
      if(group.selectionLimit.kind==='unknown'||option.ownLimit.kind==='unknown')optionCoverage=false;
      const units=targets.reduce((sum,target)=>sum+optionTargetUnits(document,catalog,selection.selectionId,target),0);
      if(group.selectionLimit.kind==='limited') addUsage(JSON.stringify(['group',group.localId,scope]),option.chargeMode==='per-target'?units:1,group.selectionLimit.max,selection.selectionId,'option/group-limit');
      if(option.ownLimit.kind==='limited') addUsage(JSON.stringify(['option',group.localId,option.localId,scope]),option.chargeMode==='per-target'?units:1,option.ownLimit.max,selection.selectionId,'option/own-limit');
      for(const required of option.requires??[]) if(!scopedChoices.some(item=>item.optionLocalId===required)) addIssue('option/prerequisite',`Option ${option.localId} requires ${required}.`,selection.selectionId);
      for(const mutex of option.mutuallyExclusiveWith??[]) if(scopedChoices.some(item=>item.optionLocalId===mutex)) addIssue('option/mutually-exclusive',`Option ${option.localId} conflicts with ${mutex}.`,selection.selectionId);
      if(option.target.kind==='scope-selector') {
        const key=JSON.stringify([selection.selectionId,group.localId,option.localId]);
        if(seenScopes.has(key)){addIssue('option/duplicate-selector','The same all-members upgrade was selected more than once.',selection.selectionId);continue;}
        seenScopes.add(key);
      }
      applications.push({selection,option,targets});
      const billTargets=option.chargeMode==='once'?[null]:targets;
      for(const target of billTargets) {
        const chargedUnits=target?optionTargetUnits(document,catalog,selection.selectionId,target):1;
        const key=JSON.stringify(['option',selection.selectionId,group.localId,option.localId,choiceIndex,target]);
        const scale=(value:TrackedValue):TrackedValue=>value.state==='known'?{state:'known',value:value.value*chargedUnits}:value;
        let points=scale(option.costDelta.points),br=scale(option.costDelta.br);
        const effect=option.effects.length===1?option.effects[0]:undefined;
        if(effect?.kind==='model-replacement') {
          const keys=(target?[target]:targets).flatMap(item=>replacementKeys(document,catalog,selection.selectionId,item,effect.fromProfileLocalId,effect.toProfileLocalId));
          if(keys.length) {
            const divide=(value:TrackedValue):TrackedValue=>value.state==='known'?{state:'known',value:value.value/keys.length}:value;
            const unit={points:divide(points),br:divide(br)};
            const covered=keys.filter(item=>replacementPrices.has(item));
            if(covered.length===keys.length && keys.every(item=>JSON.stringify(replacementPrices.get(item))===JSON.stringify(unit))) continue;
            if(covered.length) {
              addIssue('option/overlapping-price','Overlapping replacement prices cannot be allocated unambiguously.',selection.selectionId);
              points={state:'unknown',reason:'overlapping replacement prices'};br={state:'unknown',reason:'overlapping replacement prices'};
            } else for(const item of keys)replacementPrices.set(item,unit);
          }
        }
        chargeLines.push({chargeLineId:key,attributionKey:key,kind:'option-delta',selectionId:selection.selectionId,optionChoiceRef:{optionGroupLocalId:group.localId,optionLocalId:option.localId},chargedUnits,points,br,sourceRefs:option.sourceRefs});
      }
      for(const target of targets) for(const demand of option.resourceConsumptions??[]) demands.push({...demand,consumerId:selection.selectionId,ownerId:selection.selectionId,memberPath:target.kind==='member-path'?target.nodePath:[],amount:demand.amount});
    }
  }
  for(const value of usage.values()) if(value.amount>value.max) issues.push({ruleId:value.ruleId,selectionId:value.selectionId,severity:'error',message:'Option selection limit exceeded.',actual:value.amount,limit:value.max});
  // All target sets come from the unmodified input, so applying a replacement
  // cannot make later enumeration forget the members it is meant to upgrade.
  const depth=(application:typeof applications[number],seen=new Set<string>()):number=>{
    if(seen.has(application.option.localId))return 0;
    const next=new Set(seen).add(application.option.localId);
    return Math.max(0,...(application.option.requires??[]).flatMap(required=>applications.filter(other=>other.selection.selectionId===application.selection.selectionId&&other.option.localId===required).map(other=>1+depth(other,next))));
  };
  applications.sort((a,b)=>depth(a)-depth(b));
  for(const {selection,option,targets} of applications) for(const target of targets) {
    const ownerId=target.kind==='attachment-member'?target.ownerSelectionId:selection.selectionId;
    const root=nodes.get(ownerId);if(!root){compositionComplete=false;continue;}
    let node=root;
    if(target.kind!=='whole-selection') for(const id of target.nodePath) node=node.children?.find(child=>child.nodeId===id)!;
    if(!node){compositionComplete=false;continue;}
    for(const effect of option.effects) {
      if(effect.kind==='composition-change') {
        if(effect.replacement) {
          const replacement=structuredClone(effect.replacement);
          const stableId=node.nodeId;
          delete node.children;delete node.profileLocalId;
          Object.assign(node,replacement,{nodeId:stableId});
        }
        const remove=(root:EvaluatedCompositionNode):void=>{
          if(root.children)root.children=root.children.filter(child=>!child.profileLocalId||!effect.removeProfileLocalIds?.includes(child.profileLocalId));
          for(const child of root.children??[])remove(child);
        };
        remove(node);
        if(effect.includeAttachments) {
          const owned=new Set([selection.selectionId]);let changed=true;
          while(changed){changed=false;for(const child of document.selections)if(child.parentSelectionId&&owned.has(child.parentSelectionId)&&!owned.has(child.selectionId)){owned.add(child.selectionId);changed=true;}}
          for(const owner of owned)if(owner!==selection.selectionId&&nodes.has(owner))remove(nodes.get(owner)!);
        }
        for(const addition of effect.additions??[]) {
          if(node.children?.some(child=>child.nodeId===addition.nodeId)){addIssue('composition/collision','Added members collide with an existing stable node.',selection.selectionId);compositionComplete=false;}
          else node.children=[...(node.children??[]),structuredClone(addition)];
        }
      }
      if(effect.kind==='training-change') node.training={state:'known',value:effect.toTrainingLevel};
      if(effect.kind==='tag-grant') node.tags=[...new Set([...(node.tags??[]),effect.tag])];
      if(effect.kind==='composition-addition') {
        if(node.children?.some(child=>child.nodeId===effect.root.nodeId)){addIssue('composition/collision','Added members collide with an existing stable node.',selection.selectionId);compositionComplete=false;}
        else node.children=[...(node.children??[]),structuredClone(effect.root)];
      }
      if(effect.kind==='model-replacement') {
        const replace=(member:EvaluatedCompositionNode):void=>{if(member.profileLocalId===effect.fromProfileLocalId)member.profileLocalId=effect.toProfileLocalId;for(const child of member.children??[])replace(child);};replace(node);
      }
    }
  }
  const allocation=allocateResources(pools,demands);
  for(const demand of allocation.unfunded) addIssue('resource/unfunded',`No eligible ${demand.resourceKind} capacity for this purchase.`,demand.consumerId);
  const total=(key:'points'|'br'):MeasureStatus=>{
    const incomplete=chargeLines.filter(line=>line[key].state!=='known');
    return {knownSubtotal:chargeLines.reduce((sum,line)=>sum+(line[key].state==='known'?line[key].value:0),0),complete:incomplete.length===0,incompleteChargeLineIds:incomplete.map(line=>line.chargeLineId)};
  };
  const totals={points:total('points'),br:total('br')};
  const result:Evaluation = {...evaluation,composition:[...nodes].map(([selectionId,node])=>({selectionId,node})),chargeLines,totals,resources:allocation.ledgers,issues,
    coverage:[{checkId:'structure',status:'covered'},{checkId:'points',status:totals.points.complete?'covered':'blocked-unknown-data'},{checkId:'br',status:totals.br.complete?'covered':'blocked-unknown-data'},{checkId:'composition',status:compositionComplete?'covered':'blocked-unknown-data'},{checkId:'options',status:optionCoverage?'covered':'blocked-unknown-data'},{checkId:'resources',status:'covered'},{checkId:'game-rules',status:'not-implemented'}],legality:issues.some(issue=>issue.severity==='error')?'violations-confirmed':'undetermined'};
  return structuredClone(result);
}

function topSelection(document:RosterDocument,selection:RosterSelection):RosterSelection {
  let root=selection;while(root.parentSelectionId!==null)root=document.selections.find(item=>item.selectionId===root.parentSelectionId)!;return root;
}

function optionScope(document:RosterDocument,selection:RosterSelection,scope:'army'|'section'|'parent-formation'|'selection'):string {
  return scope==='army'?'army':scope==='section'?topSelection(document,selection).sectionId!:scope==='parent-formation'?(selection.parentSelectionId??selection.selectionId):selection.selectionId;
}

function replacementKeys(document:RosterDocument,catalog:CatalogShell,selectionId:string,target:OptionChoiceTarget,from:string,to:string):string[] {
  const owner=target.kind==='attachment-member'?target.ownerSelectionId:selectionId;
  const selection=document.selections.find(item=>item.selectionId===owner)!;
  const entry=catalog.entries.find(item=>item.localId===selection.entryReference.localId)!;
  if(entry.composition.state!=='known')return [];
  const path=target.kind==='whole-selection'?[]:target.nodePath;
  let root=entry.composition.root;
  let inherited=1;
  for(const id of path){inherited*=root.quantity;root=root.children!.find(child=>child.nodeId===id)!;}
  const keys:string[]=[];
  const visit=(node:typeof root,current:readonly string[],count:number):void=>{
    const quantity=count*node.quantity;
    if(node.profileLocalId===from) for(let ordinal=0;ordinal<quantity;ordinal++)keys.push(JSON.stringify([owner,current,ordinal,from,to]));
    for(const child of node.children??[])visit(child,[...current,child.nodeId],quantity);
  };
  visit(root,path,inherited);
  return keys;
}
