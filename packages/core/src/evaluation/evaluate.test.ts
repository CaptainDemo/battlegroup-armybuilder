import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateRoster } from './evaluate';
import { allocateResources } from './resources';
import { classicM01Catalog } from '../samples/classicM01Catalog';
import * as samples from '../samples/classicM01Rosters';
import type { OptionChoiceTarget } from '../contracts/roster';

const builders={B01:samples.b01Roster,B02:samples.b02Roster,B03:samples.b03Roster,B04:samples.b04Roster,L01:samples.l01Roster,L02:samples.l02Roster,L03:samples.l03Roster,L04:samples.l04Roster,L05:samples.l05Roster,L06:samples.l06Roster,L07:samples.l07Roster,L08:samples.l08Roster,L09:samples.l09Roster,L10:samples.l10Roster,S01:samples.s01Roster,S02:samples.s02Roster,F01:samples.f01Roster,F02:samples.f02Roster,F03:samples.f03Roster,F04:samples.f04Roster,F05:samples.f05Roster,F06:samples.f06Roster,F07:samples.f07Roster};
const ledger=JSON.parse(readFileSync('tests/fixtures/classic-coldwar/m01-calibration.json','utf8')) as {cases:Array<{id:keyof typeof builders;expectedTotals:{points:number;br:number}}>};

describe('independent engine vs M01 manual accounts',()=>{
  it.each(ledger.cases)('$id derives its charges independently',expected=>{
    const evaluation=evaluateRoster(builders[expected.id](),classicM01Catalog);
    expect(evaluation.totals.points).toMatchObject({knownSubtotal:expected.expectedTotals.points,complete:true});
    expect(evaluation.totals.br).toMatchObject({knownSubtotal:expected.expectedTotals.br,complete:true});
    expect(new Set(evaluation.chargeLines.map(line=>line.attributionKey)).size).toBe(evaluation.chargeLines.length);
  });
});

describe('evaluation completeness, live targets and stable snapshots',()=>{
  it('charges a transport once when parent-all and the attachment select the same replacement',()=>{
    const catalog=structuredClone(classicM01Catalog);
    const group=catalog.optionGroups.find(item=>item.localId==='bmp1-upgrades')!;
    const local=structuredClone(group.options[0]!);
    local.localId='local-transport';local.target={kind:'whole-selection'};local.chargeMode='once';
    catalog.optionGroups.push({localId:'local-fs-upgrade',name:'Synthetic local transport option',scope:'selection',selectionLimit:{kind:'unlimited'},options:[local]});
    catalog.entries.find(item=>item.localId==='bmp1-company-platoon-fire-support')!.optionGroupIds=['local-fs-upgrade'];
    const document=samples.f01Roster();
    document.selections.find(item=>item.selectionId==='fs')!.optionChoices=[{optionGroupLocalId:'local-fs-upgrade',optionLocalId:'local-transport',targets:[{kind:'whole-selection'}]}];
    expect(evaluateRoster(document,catalog).totals.points.knownSubtotal).toBe(395);
    document.selections.reverse();
    expect(evaluateRoster(document,catalog).totals.points.knownSubtotal).toBe(395);
  });
  it('rebuilds all targets to include newly purchased duplicate attachments once each',()=>{
    const document=samples.f01Roster();
    const original=document.selections.find(s=>s.selectionId==='fs')!;
    document.selections.push({...structuredClone(original),selectionId:'fs-new'});
    const evaluation=evaluateRoster(document,classicM01Catalog);
    const upgrade=evaluation.chargeLines.filter(line=>line.kind==='option-delta');
    expect(upgrade).toHaveLength(13);
    expect(evaluation.totals.points.knownSubtotal).toBe(425);
    const expanded=evaluation.composition.find(item=>item.selectionId==='fs-new')!;
    expect(expanded.node.children?.find(item=>item.nodeId==='transport')?.profileLocalId).toBe('bmp1p');
    expect(document.selections[0]?.optionChoices[0]?.targets).toHaveLength(12);
  });

  it('deduplicates explicit member targets and does not repeat an all-selector bill',()=>{
    const document=samples.l01Roster();
    document.selections[0]!.optionChoices[1]!.targets.push(...structuredClone(document.selections[0]!.optionChoices[1]!.targets));
    expect(evaluateRoster(document,classicM01Catalog).totals.points.knownSubtotal).toBe(215);
    const all=samples.l06Roster();all.selections[0]!.optionChoices.push(structuredClone(all.selections[0]!.optionChoices[0]!));
    const result=evaluateRoster(all,classicM01Catalog);
    expect(result.totals.points.knownSubtotal).toBe(110);
    expect(result.issues.some(issue=>issue.ruleId==='option/duplicate-selector')).toBe(true);
  });

  it('keeps known subtotals and blocks completeness when a base price is unknown',()=>{
    const catalog=structuredClone(classicM01Catalog);
    catalog.entries.find(entry=>entry.localId==='fhq')!.baseCost.br={state:'unknown',reason:'not transcribed'};
    const result=evaluateRoster(samples.b01Roster(),catalog);
    expect(result.totals.br).toMatchObject({knownSubtotal:20,complete:false});
    expect(result.totals.br.incompleteChargeLineIds).toHaveLength(1);
    expect(result.totals.points.complete).toBe(true);
    expect(result.legality).toBe('undetermined');
  });

  it('rejects structural damage before producing authoritative totals',()=>{
    const document=samples.b01Roster();document.selections[0]!.entryReference.rulesetId='airland';
    const result=evaluateRoster(document,classicM01Catalog);
    expect(result.chargeLines).toEqual([]);
    expect(result.totals.points.complete).toBe(false);
    expect(result.legality).toBe('violations-confirmed');
  });

  it('applies model, training and tag effects without mutating the inputs or sharing output state',()=>{
    const document=samples.l02Roster();const before=structuredClone(document);const catalog=structuredClone(classicM01Catalog);
    const result=evaluateRoster(document,catalog);
    expect(result.composition[0]?.node.training).toEqual({state:'known',value:'r'});
    expect(result.composition[0]?.node.children?.every(node=>node.profileLocalId==='t62m')).toBe(true);
    const repeated=evaluateRoster(document,catalog);expect(result).toEqual(repeated);
    result.composition[0]!.node.children!.length=0;
    expect(evaluateRoster(document,catalog)).toEqual(repeated);
    expect(document).toEqual(before);
    expect(result.identity.inputRevision).toBe(document.revision);
  });

  it('handles per-target multiplicity, once-only whole-formation prices and unknown limits',()=>{
    const catalog=structuredClone(classicM01Catalog);
    const tank=catalog.entries.find(entry=>entry.localId==='t72-platoon')!;
    if(tank.composition.state!=='known')throw new Error('fixture');
    tank.composition.root.children!.find(node=>node.nodeId==='ordinary-2')!.quantity=2;
    const group=catalog.optionGroups.find(item=>item.localId==='t72-platoon-upgrades')!;
    group.options.find(option=>option.localId==='kmt')!.ownLimit={kind:'unknown',reason:'synthetic limit missing'};
    const result=evaluateRoster(samples.l01Roster(),catalog);
    expect(result.totals.points.knownSubtotal).toBe(220);
    expect(result.coverage.find(item=>item.checkId==='options')?.status).toBe('blocked-unknown-data');
  });

  it('reports declared prerequisites and group-wide limits',()=>{
    const document=samples.l02Roster();document.selections[0]!.optionChoices.splice(0,1);
    const result=evaluateRoster(document,classicM01Catalog);
    expect(result.issues.some(issue=>issue.ruleId==='option/prerequisite')).toBe(true);
    const catalog=structuredClone(classicM01Catalog);
    const group=catalog.optionGroups.find(item=>item.localId==='t72-platoon-upgrades')!;group.selectionLimit={kind:'limited',max:1};
    expect(evaluateRoster(samples.l01Roster(),catalog).issues.some(issue=>issue.ruleId==='option/group-limit')).toBe(true);
  });

  it('respects army scope for prerequisites shared by distinct purchases',()=>{
    const catalog=structuredClone(classicM01Catalog);catalog.optionGroups.find(item=>item.localId==='t62-platoon-upgrades')!.scope='army';
    const document=samples.l02Roster();const first=document.selections[0]!;
    const second={...structuredClone(first),selectionId:'second',optionChoices:first.optionChoices.filter(choice=>choice.optionLocalId==='one-bastion')};
    first.optionChoices=first.optionChoices.filter(choice=>choice.optionLocalId!=='one-bastion');document.selections.push(second);
    expect(evaluateRoster(document,catalog).issues.some(issue=>issue.ruleId==='option/prerequisite')).toBe(false);
  });

  it('executes declared composition additions and reports real identity collisions',()=>{
    const catalog=structuredClone(classicM01Catalog);
    const option=catalog.optionGroups.find(group=>group.localId==='t72-platoon-upgrades')!.options[0]!;
    option.effects=[{kind:'composition-addition',root:{nodeId:'extra',role:'crew',quantity:1}}];
    const result=evaluateRoster(samples.l01Roster(),catalog);
    expect(result.composition[0]?.node.children?.some(child=>child.nodeId==='extra')).toBe(true);
    option.effects=[{kind:'composition-addition',root:{nodeId:'ordinary-1',role:'crew',quantity:1}}];
    expect(evaluateRoster(samples.l01Roster(),catalog).issues.some(issue=>issue.ruleId==='composition/collision')).toBe(true);
  });
});

describe('generic resource matching',()=>{
  it('reassigns overlapping eligible categories instead of producing a false shortage',()=>{
    const allocation=allocateResources([
      {producerId:'flexible',grant:{resourceKind:'support',scope:'army',capacity:1,eligibleCategories:['logistics','fire']}},
      {producerId:'limited',grant:{resourceKind:'support',scope:'army',capacity:1,eligibleCategories:['logistics']}},
    ],[
      {consumerId:'truck',ownerId:null,memberPath:[],resourceKind:'support',category:'logistics',amount:1},
      {consumerId:'request',ownerId:null,memberPath:[],resourceKind:'support',category:'fire',amount:1},
    ]);
    expect(allocation.unfunded).toEqual([]);
    expect(allocation.ledgers.map(pool=>pool.consumed)).toEqual([1,1]);
  });

  it('does not merge army support with parent-local support or separate included platoon pools',()=>{
    const result=evaluateRoster(samples.s01Roster(),classicM01Catalog);
    expect(result.issues.filter(issue=>issue.ruleId==='resource/unfunded')).toEqual([]);
    expect(result.resources.filter(pool=>pool.resourceKind==='platoon-support-slots')[0]?.consumed).toBe(4);
    expect(evaluateRoster(samples.s02Roster(),classicM01Catalog).issues.some(issue=>issue.ruleId==='resource/unfunded')).toBe(true);
    const f02=evaluateRoster(samples.f02Roster(),classicM01Catalog);
    expect(f02.resources.find(pool=>JSON.stringify(pool.nodePath)===JSON.stringify(['platoon-1']))?.consumed).toBe(4);
    expect(f02.resources.find(pool=>JSON.stringify(pool.nodePath)===JSON.stringify(['platoon-2']))?.consumed).toBe(0);
  });
});

// Kept as a compile-time contract: explicit owning-instance targets are public.
const target:OptionChoiceTarget={kind:'attachment-member',ownerSelectionId:'fs',nodePath:['transport']};
void target;
