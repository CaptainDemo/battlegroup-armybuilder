import { describe, expect, it } from 'vitest';
import { createRosterDocument, executeRosterCommands, type RosterCommandContext } from './commands';
import { classicM01Catalog } from '../samples/classicM01Catalog';
import { b01Roster, f01Roster, l01Roster } from '../samples/classicM01Rosters';
import type { RosterSelection } from '../contracts/roster';

const context:RosterCommandContext = {
  catalog:classicM01Catalog,
  purchases:classicM01Catalog.entries.map(entry=>{
    const parent = entry.localId.startsWith('bmp1-company-platoon-')?'bmp1-company':entry.localId.startsWith('bmp2-company-platoon-')?'bmp2-company':entry.localId.startsWith('bmp1-platoon-')?'bmp1-platoon':entry.localId==='bmp2-platoon-fire-support'?'bmp2-platoon':null;
    return parent ? {kind:'attachment',entryId:entry.localId,parentEntryIds:[parent]} : {kind:'top-level',entryId:entry.localId};
  }),
};
const revision = 'edit-next';

describe('pure roster commands',()=>{
  it('creates an empty document with separate caller-provided identities and settings',()=>{
    const source = b01Roster();
    const {selections:_selections,formatVersion:_format,...input} = source;
    const result = createRosterDocument(input,context);
    expect(result.ok).toBe(true);
    expect(result.document.selections).toEqual([]);
    expect(result.document.catalogRef).toEqual(source.catalogRef);
    const edited = executeRosterCommands(result.document,[{kind:'rename',name:'New force'},{kind:'settings',patch:{budgetPoints:397}}],context,revision);
    expect(edited.ok).toBe(true);
    expect(edited.document.settings).toMatchObject({budgetPoints:397,gameSizeId:'platoon'});
    expect(result.document.name).not.toBe('New force');
  });

  it('permits over-budget and duplicate local-pick drafts without enforcing game rules',()=>{
    const document = b01Roster();
    const medic = structuredClone(document.selections.find(s=>s.selectionId==='medic')!);
    medic.selectionId = 'medic-duplicate';
    const result = executeRosterCommands(document,[{kind:'add',selection:medic},{kind:'settings',patch:{budgetPoints:1}}],context,revision);
    expect(result.ok).toBe(true);
    expect(document.selections.some(s=>s.selectionId==='medic-duplicate')).toBe(false);
    medic.optionChoices.push({optionGroupLocalId:'x',optionLocalId:'x',targets:[{kind:'whole-selection'}]});
    expect(result.document.selections.find(s=>s.selectionId==='medic-duplicate')?.optionChoices).toEqual([]);
  });

  it('cascade-removes a formation with no orphans',()=>{
    const document = b01Roster();
    const result = executeRosterCommands(document,[{kind:'remove',selectionId:'inf'}],context,revision);
    expect(result.ok).toBe(true);
    expect(result.document.selections.map(s=>s.selectionId)).not.toContain('medic');
    expect(result.document.selections.map(s=>s.selectionId)).not.toContain('fs');
    expect(document.selections.map(s=>s.selectionId)).toContain('medic');
  });

  it('removing an attachment visibly invalidates just its explicit parent-option targets',()=>{
    const result = executeRosterCommands(f01Roster(),[{kind:'remove',selectionId:'fs'}],context,revision);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.selections[0]?.optionChoices[0]?.targets).toHaveLength(11);
    expect(result.notices).toContainEqual(expect.objectContaining({code:'targets-removed',selectionId:'company'}));
    expect(result.document.selections[0]?.optionChoices[0]?.targets).toContainEqual({kind:'attachment-member',ownerSelectionId:'agl',nodePath:['transport']});
  });

  it('copies a complete subtree and rewrites attachment-owned targets without aliasing',()=>{
    const document = f01Roster();
    const result = executeRosterCommands(document,[{kind:'copy',selectionId:'company',ids:{company:'c2',fs:'fs2',agl:'agl2'}}],context,revision);
    expect(result.ok).toBe(true);
    const copy = result.document.selections.find(s=>s.selectionId==='c2')!;
    expect(copy.optionChoices[0]?.targets).toContainEqual({kind:'attachment-member',ownerSelectionId:'fs2',nodePath:['transport']});
    expect(result.document.selections.find(s=>s.selectionId==='fs2')?.parentSelectionId).toBe('c2');
    copy.optionChoices.length = 0;
    expect(result.document.selections.find(s=>s.selectionId==='company')?.optionChoices).toHaveLength(1);
    expect(document.selections).toHaveLength(3);
  });

  it('reordering purchases preserves stable member and owning-instance targets',()=>{
    const document = f01Roster();
    const result = executeRosterCommands(document,[{kind:'reorder',selectionIds:[...document.selections].reverse().map(s=>s.selectionId)}],context,revision);
    expect(result.ok).toBe(true);
    expect(result.document.selections.find(s=>s.selectionId==='company')?.optionChoices).toEqual(document.selections[0]?.optionChoices);
  });

  it('replacing a company reports incompatible attachments and options instead of silently moving them',()=>{
    const document = f01Roster();
    const reference = {...document.catalogRef,localId:'bmp2-company'};
    const result = executeRosterCommands(document,[{kind:'replace-entry',selectionId:'company',entryReference:reference}],context,revision);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.selections).toHaveLength(1);
    expect(result.document.selections[0]?.optionChoices).toEqual([]);
    expect(result.notices.map(notice=>notice.code)).toContain('choice-removed');
    expect(result.notices.filter(notice=>notice.code==='selection-removed')).toHaveLength(2);
  });

  it('applies an options edit only to the named instance',()=>{
    const document = l01Roster();
    const second = structuredClone(document.selections[0]!); second.selectionId='tank2'; document.selections.push(second);
    const result = executeRosterCommands(document,[{kind:'options',selectionId:'tank',choices:[]}],context,revision);
    expect(result.ok).toBe(true);
    expect(result.document.selections.find(s=>s.selectionId==='tank')?.optionChoices).toEqual([]);
    expect(result.document.selections.find(s=>s.selectionId==='tank2')?.optionChoices).toHaveLength(2);
  });

  it('rejects an invalid later batch command without partially applying an earlier edit',()=>{
    const document = b01Roster();
    const before = structuredClone(document);
    const result = executeRosterCommands(document,[{kind:'rename',name:'Attempted'},{kind:'add',selection:document.selections[0]!}],context,revision);
    expect(result.ok).toBe(false);
    expect(result.document).toBe(document);
    expect(document).toEqual(before);
  });

  it('rejects deliberately invalid options rather than repairing an explicit edit',()=>{
    const document = l01Roster();
    const result = executeRosterCommands(document,[{kind:'options',selectionId:'tank',choices:[{optionGroupLocalId:'t72-platoon-upgrades',optionLocalId:'kmt',targets:[{kind:'member-path',nodePath:['ghost']}]}]}],context,revision);
    expect(result.ok).toBe(false);
    expect(result.document).toBe(document);
  });

  it('does not permit wrong purchase context or foreign references',()=>{
    const document = b01Roster();
    const medic: RosterSelection = {...structuredClone(document.selections.find(s=>s.selectionId==='medic')!),selectionId:'wrong',parentSelectionId:null,sectionId:'motor-rifle'};
    expect(executeRosterCommands(document,[{kind:'add',selection:medic}],context,revision).ok).toBe(false);
    medic.parentSelectionId='tank'; delete medic.sectionId;
    expect(executeRosterCommands(document,[{kind:'add',selection:medic}],context,revision).ok).toBe(false);
    const reference = {...document.catalogRef,rulesetId:'airland' as const,localId:'t72-platoon'};
    expect(executeRosterCommands(document,[{kind:'replace-entry',selectionId:'tank',entryReference:reference}],context,revision).ok).toBe(false);
  });

  it('requires complete collision-free copy ids, real reorder ids and a new revision',()=>{
    const document = f01Roster();
    expect(executeRosterCommands(document,[{kind:'copy',selectionId:'company',ids:{company:'c2'}}],context,revision).ok).toBe(false);
    expect(executeRosterCommands(document,[{kind:'copy',selectionId:'company',ids:{company:'c2',fs:'fs',agl:'agl2'}}],context,revision).ok).toBe(false);
    expect(executeRosterCommands(document,[{kind:'reorder',selectionIds:['company','fs','fs']}],context,revision).ok).toBe(false);
    expect(executeRosterCommands(document,[{kind:'rename',name:'x'}],context,document.revision).ok).toBe(false);
    expect(executeRosterCommands(document,[{kind:'settings',patch:{budgetPoints:0}}],context,revision).ok).toBe(false);
  });
});
