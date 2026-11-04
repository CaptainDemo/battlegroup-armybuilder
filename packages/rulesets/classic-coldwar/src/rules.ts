import { evaluateRoster, executeRosterCommands, validateRosterCommandDocument, resolveChoiceTargets, type Availability, type CatalogIdentity, type EvaluatedCompositionNode, type Evaluation, type RosterCommandContext, type RosterDocument, type RosterIssue, type RulesetModule } from '@battlegroup/core';
import { classicRosterDocumentSchema } from './classicSchema';

const supportsRules=(revision:string):boolean=>['cw-draft6+sov-v4.1','cw-draft6+sov-v4.1+formations1'].includes(revision);
const sameIdentity=(a:CatalogIdentity,b:CatalogIdentity):boolean=>a.rulesetId===b.rulesetId && a.catalogId===b.catalogId && a.catalogRevision===b.catalogRevision;
const sources:Record<string,{documentId:string;pdfPage:number}>= {C01:{documentId:'BASE',pdfPage:11},C02:{documentId:'SOV',pdfPage:2},C03:{documentId:'SOV',pdfPage:5},C07:{documentId:'SOV',pdfPage:2},C09:{documentId:'SOV',pdfPage:1},C11:{documentId:'CW',pdfPage:31},C12:{documentId:'CW',pdfPage:32},C13:{documentId:'BASE',pdfPage:11},C14:{documentId:'SOV',pdfPage:9},C15:{documentId:'CW',pdfPage:32},C16:{documentId:'SOV',pdfPage:10}};
sources.C17 = { documentId: 'SOV', pdfPage: 3 };
sources.C29 = { documentId: 'SOV', pdfPage: 3 };
sources.C30 = { documentId: 'SOV', pdfPage: 6 };

/** Concrete Classic checks; data records and profile classification remain catalog-owned. */
export function evaluateClassicRoster(document:RosterDocument,context:RosterCommandContext):Evaluation {
  const {catalog}=context;
  const base=evaluateRoster(document,catalog);
  const boundary=validateRosterCommandDocument(document,context);
  const classic=classicRosterDocumentSchema.safeParse(document);
  if(boundary.length || !classic.success || catalog.manifest.identity.rulesetId!=='classic-coldwar' || !supportsRules(catalog.manifest.rulesRevision)) {
    return {...base,composition:[],chargeLines:[],totals:{points:{knownSubtotal:0,complete:false,incompleteChargeLineIds:[]},br:{knownSubtotal:0,complete:false,incompleteChargeLineIds:[]}},issues:[...base.issues,...boundary.map(problem=>({ruleId:problem.code,message:problem.message,severity:'error' as const})),{ruleId:'classic/context',message:'Classic document or catalog context is not supported.',severity:'error'}],coverage:[{checkId:'structure',status:'blocked-unknown-data'}],legality:'violations-confirmed'};
  }
  const entries=new Map(catalog.entries.map(entry=>[entry.localId,entry]));
  const issues:RosterIssue[]=base.issues.map(issue=>{
    if(issue.ruleId!=='resource/unfunded')return issue;
    const selection=document.selections.find(item=>item.selectionId===issue.selectionId)!;
    const entry=entries.get(selection.entryReference.localId)!;
    const local=entry.resourceConsumptions?.some(demand=>demand.resourceKind==='platoon-support-slots');
    const ruleId=local?(selection.targetMemberPath?.length?'C03':'C02'):entry.resourceConsumptions?.some(demand=>demand.category==='additional-fire-support')?'C09':'C07';
    return {...issue,ruleId,sourceRefs:[sources[ruleId]!]};
  });
  const coverage=[...base.coverage.filter(item=>item.checkId!=='game-rules')];
  const add=(ruleId:string,message:string,selectionId?:string,actual?:number,limit?:number):void=>{
    issues.push({ruleId,message,severity:'error',...(selectionId?{selectionId}:{}),...(actual!==undefined?{actual}:{}),...(limit!==undefined?{limit}:{}),...(sources[ruleId]?{sourceRefs:[sources[ruleId]!]}:{})});
  };
  if(base.totals.points.complete && base.totals.points.knownSubtotal>document.settings.budgetPoints) add('C01','Points exceed the chosen budget.',undefined,base.totals.points.knownSubtotal,document.settings.budgetPoints);
  coverage.push({checkId:'C01',status:base.totals.points.complete?'covered':'blocked-unknown-data'});

  const localCounts=new Map<string,number>();
  const uniqueCounts=new Map<string,number>();
  let restricted=0;
  const countedUpgrades=new Set<string>();
  for(const selection of document.selections) {
    const entry=entries.get(selection.entryReference.localId)!;
    if(entry.tags?.includes('restricted'))restricted++;
    if(entry.tags?.includes('unique')) {
      const group=entry.tags.find(tag=>tag.startsWith('unique-group:'))??entry.localId;
      const count=(uniqueCounts.get(group)??0)+1;uniqueCounts.set(group,count);
      if(count>1)add('C12','This Unique purchase type may be selected only once.',selection.selectionId,count,1);
    }
    if(entry.resourceConsumptions?.some(demand=>demand.resourceKind==='platoon-support-slots')) {
      const key=JSON.stringify([selection.parentSelectionId,selection.targetMemberPath??[],entry.localId]);
      const count=(localCounts.get(key)??0)+1;localCounts.set(key,count);
      if(count>1)add(selection.targetMemberPath?.length?'C03':'C02','This attachment menu item may be selected only once in its platoon.',selection.selectionId,count,1);
    }
    if((entry.tags?.includes('defence')||entry.sectionIds.includes('defences'))) {
      if(!document.settings.scenarioId || !document.settings.playerRoleId)coverage.push({checkId:'C14',status:'missing-input',note:'Attack-Defence and defender identity are required.'});
      else if(document.settings.scenarioId!=='attack-defence'||document.settings.playerRoleId!=='defender')add('C14','Defences require the defender in Attack-Defence.',selection.selectionId);
    }
    if(entry.specialRules?.includes('toc-battalion-only') && document.settings.gameSizeId!=='battalion')add('C15','This TOC requires Battalion game size.',selection.selectionId);
    for(const rule of entry.specialRules??[]) {
      if(rule.startsWith('requires-sibling:') && !document.selections.some(other=>other.parentSelectionId===selection.parentSelectionId && JSON.stringify(other.targetMemberPath??[])===JSON.stringify(selection.targetMemberPath??[]) && other.entryReference.localId===rule.slice(17)))add('C03','The second Fire Support Section requires the first Section in this same platoon.',selection.selectionId);
      if(rule.startsWith('max-per-parent:')) {
        const count=document.selections.filter(other=>other.parentSelectionId===selection.parentSelectionId&&other.entryReference.localId===entry.localId).length;
        const max=Number(rule.slice(15));if(count>max)add('C03','Additional purchase limit exceeded for this parent.',selection.selectionId,count,max);
      }
      if(rule.startsWith('requires-parent-option:')) {
        const parent=document.selections.find(other=>other.selectionId===selection.parentSelectionId);
        if(!parent?.optionChoices.some(choice=>choice.optionLocalId===rule.slice(23)))add('C03','This extra transport requires its parent helicopter conversion.',selection.selectionId);
      }
    }
    for(const choice of selection.optionChoices) {
      const option=catalog.optionGroups.find(group=>group.localId===choice.optionGroupLocalId)?.options.find(item=>item.localId===choice.optionLocalId);
      const eventKey=JSON.stringify([selection.selectionId,choice.optionGroupLocalId,choice.optionLocalId]);
      if(option && !countedUpgrades.has(eventKey)) {
        countedUpgrades.add(eventKey);
        if(option.specialRules?.includes('restricted-choice'))restricted++;
        for(const token of option.specialRules??[])if(token.startsWith('unique-choice:')) {
          const key='unique-group:'+token.slice(14);const count=(uniqueCounts.get(key)??0)+1;uniqueCounts.set(key,count);
          if(count>1)add('C12','This Unique upgrade or purchase may be taken only once in the army.',selection.selectionId,count,1);
        }
      }
      for(const token of option?.specialRules??[])if(token.startsWith('requires-target-profile:')) {
        for(const target of resolveChoiceTargets(document,catalog,selection.selectionId,option!,choice)) {
          const owner=target.kind==='attachment-member'?target.ownerSelectionId:selection.selectionId;
          let node=base.composition.find(item=>item.selectionId===owner)?.node;
          if(target.kind!=='whole-selection')for(const id of target.nodePath)node=node?.children?.find(child=>child.nodeId===id);
          if(node?.profileLocalId!==token.slice(24))add('C30','This equipment requires the specified upgraded vehicle on its selected target.',selection.selectionId);
        }
      }
      if(option?.effects.some(effect=>effect.kind==='tag-grant' && ['restricted','unique'].includes(effect.tag)))coverage.push({checkId:'A05',status:'blocked-unknown-data',note:'This option uses a legacy tag without an explicit upgrade counting scope.'});
    }
  }
  for(const parent of document.selections) {
    const sections=document.selections.filter(child=>child.parentSelectionId===parent.selectionId && entries.get(child.entryReference.localId)?.specialRules?.includes('company-sam'));
    if(sections.length>1)for(const section of sections.slice(1))add('C17','Only one platoon in this company may purchase a SAM Section.',section.selectionId,sections.length,1);
    if(sections.length && parent.optionChoices.some(choice=>catalog.optionGroups.find(group=>group.localId===choice.optionGroupLocalId)?.options.find(option=>option.localId===choice.optionLocalId)?.specialRules?.includes('sa7-squad')))add('C17','A company SAM Section conflicts with a squad SA-7 upgrade in this company.',sections[0]!.selectionId);
    const conversion=parent.optionChoices.some(choice=>catalog.optionGroups.find(group=>group.localId===choice.optionGroupLocalId)?.options.find(option=>option.localId===choice.optionLocalId)?.specialRules?.includes('helicopter-conversion'));
    if(conversion) {
      const owned=new Set([parent.selectionId]);let changed=true;
      while(changed){changed=false;for(const child of document.selections)if(child.parentSelectionId&&owned.has(child.parentSelectionId)&&!owned.has(child.selectionId)){owned.add(child.selectionId);changed=true;}}
      for(const child of document.selections.filter(item=>owned.has(item.selectionId)))if(child.optionChoices.some(choice=>catalog.optionGroups.find(group=>group.localId===choice.optionGroupLocalId)?.options.find(option=>option.localId===choice.optionLocalId)?.specialRules?.includes('ground-transport-upgrade')))add('C29','Helicopter conversion cannot be combined with upgrades to the removed BMP transports.',child.selectionId);
    }
  }
  const restrictedMax={squad:2,platoon:3,company:4,battalion:5}[document.settings.gameSizeId as 'squad'|'platoon'|'company'|'battalion'];
  if(restricted>restrictedMax)add('C11','Restricted purchase limit exceeded.',undefined,restricted,restrictedMax);
  coverage.push({checkId:'C02/C03',status:'covered'},{checkId:'C07/C08/C09',status:'covered'},{checkId:'C11/C12',status:'covered'});
  const ranges={squad:[100,350],platoon:[351,750],company:[751,1250],battalion:[1251,Infinity]} as const;
  const [min,max]=ranges[document.settings.gameSizeId as keyof typeof ranges];
  if(document.settings.budgetPoints<min || document.settings.budgetPoints>max)issues.push({ruleId:'C13',severity:'warning',message:'Budget is outside the guideline for the explicitly chosen game size; size has not been changed.',sourceRefs:[sources.C13!]});

  let officer=0,scout=0;
  let pt76=document.selections.some(selection=>{
    const entry=entries.get(selection.entryReference.localId)!;
    return entry.specialRules?.includes('pt76-tank-exclusion') || selection.optionChoices.some(choice=>catalog.optionGroups.find(group=>group.localId===choice.optionGroupLocalId)?.options.find(option=>option.localId===choice.optionLocalId)?.specialRules?.includes('pt76-tank-exclusion'));
  });
  const models:Array<{selectionId:string;tags:string[];tankSection:boolean}>=[];
  for(const composition of base.composition) {
    const selection=document.selections.find(item=>item.selectionId===composition.selectionId)!;
    const entry=entries.get(selection.entryReference.localId)!;
    const visit=(node:EvaluatedCompositionNode,parentQuantity:number):void=>{
      const quantity=parentQuantity*node.quantity;
      const profile=catalog.profiles.find(item=>item.localId===node.profileLocalId);
      const profileTags=profile && 'specialRules' in profile && Array.isArray(profile.specialRules)?profile.specialRules.filter((tag):tag is string=>typeof tag==='string'):[];
      const tags=[...(node.tags??[]),...profileTags];
      if(tags.includes('officer')||tags.includes('senior-officer'))officer+=quantity;
      scout+=(tags.includes('scout2')?2:tags.includes('scout')?1:0)*quantity;
      if(tags.includes('tank-family:pt76'))pt76=true;
      if(node.profileLocalId)models.push({selectionId:composition.selectionId,tags,tankSection:entry.sectionIds.includes('tank')});
      for(const child of node.children??[])visit(child,quantity);
    };
    visit(composition.node,1);
  }
  let tankClassificationComplete=true;
  if(pt76)for(const model of models) {
    if(model.tags.includes('tank-family:other'))add('C16','PT-76 excludes every non-T-62 tank formation and additional tank.',model.selectionId);
    else if(model.tankSection && !model.tags.includes('tank-family:t62') && !model.tags.includes('tank-family:pt76'))tankClassificationComplete=false;
  }
  coverage.push({checkId:'C16',status:tankClassificationComplete?'covered':'blocked-unknown-data',note:pt76?'Actual selected profiles were inspected; unclassified tanks cannot be guessed.':'PT-76 not selected.'});
  coverage.push({checkId:'A05/A06',status:'covered',note:'Upgrade event counting and company-local SAM Section scope follow user clarification.'});
  coverage.push({checkId:'classic/full-army-coverage',status:'not-implemented',note:'Formation data and checks have explicit coverage; combat attributes and battle-time procedures remain outside the legality conclusion.'});
  return {...base,issues,coverage,statistics:[{statId:'officers',label:'Officers',value:officer,status:'covered',sourceRefs:[{documentId:'BASE',pdfPage:48}]},{statId:'scout-weight',label:'Scout weight',value:scout,status:'covered',sourceRefs:[{documentId:'BASE',pdfPage:49}]}],legality:issues.some(issue=>issue.severity==='error')?'violations-confirmed':'undetermined'};
}

export function getClassicEntryAvailability(document:RosterDocument,context:RosterCommandContext,entryId:string,target:{parentSelectionId?:string;sectionId?:string;targetMemberPath?:string[]}={}):Availability {
  const entry=context.catalog.entries.find(item=>item.localId===entryId);
  if(!entry)return {status:'blocked',reasons:[{code:'entry-missing',message:'Entry is not in this exact catalog.'}]};
  let id=`availability/${entryId}`;while(document.selections.some(item=>item.selectionId===id))id+='-next';
  const selection={selectionId:id,entryReference:{...document.catalogRef,localId:entryId},parentSelectionId:target.parentSelectionId??null,...(!target.parentSelectionId?{sectionId:target.sectionId??entry.sectionIds[0]!}:{}),...(target.targetMemberPath?{targetMemberPath:target.targetMemberPath}:{}),optionChoices:[]};
  const edited=executeRosterCommands(document,[{kind:'add',selection}],context,'availability/'+document.revision);
  if(!edited.ok)return {status:'blocked',reasons:edited.problems};
  const before=evaluateClassicRoster(document,context);
  const after=evaluateClassicRoster(edited.document,context);
  const existing=new Set(before.issues.filter(issue=>issue.severity==='error').map(issue=>JSON.stringify(issue)));
  const blockers=after.issues.filter(issue=>issue.severity==='error'&&!existing.has(JSON.stringify(issue)));
  if(blockers.length)return {status:'blocked',reasons:blockers.map(issue=>({code:issue.ruleId,message:issue.message,...(issue.sourceRefs?{sourceRefs:issue.sourceRefs}:{})}))};
  if(entry.baseCost.points.state!=='known'||entry.baseCost.br.state!=='known'||after.coverage.some(item=>['missing-input','blocked-unknown-data'].includes(item.status)))return {status:'unknown',reasons:[{code:'incomplete-data',message:'Relevant price or eligibility inputs are unknown.'}]};
  return {status:'allowed',reasons:[{code:'partial-coverage',message:'No implemented purchase check blocks this entry; overall rules coverage remains partial.'}]};
}

export function createClassicRuleset(context:RosterCommandContext):RulesetModule {
  if(context.catalog.manifest.identity.rulesetId!=='classic-coldwar'||!supportsRules(context.catalog.manifest.rulesRevision))throw new Error('Unsupported Classic context');
  const bound=structuredClone(context);
  const assertContext=(supplied:unknown):void=>{
    if(!supplied || typeof supplied!=='object' || !('catalog' in supplied))throw new Error('An explicit catalog context is required');
    const other=supplied as RosterCommandContext;
    if(!other.catalog?.manifest?.identity || !sameIdentity(other.catalog.manifest.identity,bound.catalog.manifest.identity))throw new Error('Ruleset context identity mismatch');
  };
  return {id:'classic-coldwar',supports:identity=>({status:sameIdentity(identity,bound.catalog.manifest.identity)?'supported':'unsupported',reasons:[]}),
    evaluate:(document,supplied)=>{
      assertContext(supplied);
      return evaluateClassicRoster(document,bound);
    },
    getEntryAvailability:(entryId,target,document,supplied,_evaluation)=>{
      assertContext(supplied);
      return getClassicEntryAvailability(document,bound,entryId,{
        ...(target.selectionId?{parentSelectionId:target.selectionId}:{}),
        ...(target.sectionId?{sectionId:target.sectionId}:{}),
        ...(target.targetMemberPath?{targetMemberPath:[...target.targetMemberPath]}:{}),
      });
    },
  };
}
