import type { CatalogShell } from '../contracts/catalog';
import type { EntryReference } from '../contracts/primitives';
import { rosterDocumentSchema, type OptionChoice, type RosterDocument, type RosterSelection, type RosterSettings } from '../contracts/roster';
import { ROSTER_FORMAT_VERSION } from '../contracts/versioning';
import { resolveRosterMemberPath, validateRosterRelations } from '../validation/rosterRelations';

export type PurchaseAccess = {kind:'top-level';entryId:string} | {kind:'attachment';entryId:string;parentEntryIds:readonly string[]};
export interface RosterCommandContext {catalog:CatalogShell;purchases:readonly PurchaseAccess[]}
export type RosterCommand =
  | {kind:'add';selection:RosterSelection}
  | {kind:'remove';selectionId:string}
  | {kind:'copy';selectionId:string;ids:Readonly<Record<string,string>>}
  | {kind:'options';selectionId:string;choices:OptionChoice[]}
  | {kind:'replace-entry';selectionId:string;entryReference:EntryReference}
  | {kind:'settings';patch:Partial<RosterSettings>}
  | {kind:'rename';name:string}
  | {kind:'reorder';selectionIds:readonly string[]};
export interface CommandNotice {code:string;selectionId:string;message:string}
export interface CommandProblem {code:string;message:string}
export type RosterCommandResult =
  | {ok:true;document:RosterDocument;notices:CommandNotice[]}
  | {ok:false;document:RosterDocument;problems:CommandProblem[]};

class CommandFailure extends Error {constructor(readonly code:string,message:string){super(message);}}
const fail = (code:string,message:string):never => {throw new CommandFailure(code,message);};

/** No clock, random ids, ruleset imports or game-limit enforcement. */
export function createRosterDocument(input:Omit<RosterDocument,'formatVersion'|'selections'>,context:RosterCommandContext):RosterCommandResult {
  const document:RosterDocument = {...structuredClone(input),formatVersion:ROSTER_FORMAT_VERSION,selections:[]};
  const problems = checkDocument(document,context);
  return problems.length ? {ok:false,document,problems} : {ok:true,document,notices:[]};
}

export function executeRosterCommands(document:RosterDocument,commands:readonly RosterCommand[],context:RosterCommandContext,nextRevision:string):RosterCommandResult {
  const initial = checkDocument(document,context);
  if (initial.length) return {ok:false,document,problems:initial};
  if (!nextRevision || nextRevision===document.revision || !commands.length) return {ok:false,document,problems:[{code:'invalid-revision',message:'A nonempty batch needs a new caller-provided edit revision.'}]};
  const next = structuredClone(document);
  const notices:CommandNotice[] = [];
  next.revision = nextRevision;
  try {
    for (const command of commands) {
      switch (command.kind) {
        case 'add': next.selections.push(structuredClone(command.selection)); break;
        case 'remove': {
          requireSelection(next,command.selectionId);
          removeSubtree(next,command.selectionId,notices);
          pruneChoices(next,context,notices);
          break;
        }
        case 'copy': {
          requireSelection(next,command.selectionId);
          const ids = subtreeIds(next,command.selectionId);
          if (Object.keys(command.ids).length!==ids.size || [...ids].some(id=>!command.ids[id])) fail('copy-id-map','Every copied instance needs exactly one new caller-provided id.');
          const assigned = Object.values(command.ids);
          if (new Set(assigned).size!==assigned.length || assigned.some(id=>next.selections.some(s=>s.selectionId===id))) fail('copy-id-collision','Copied ids must be unique and unused.');
          const copies = next.selections.filter(s=>ids.has(s.selectionId)).map(original=>{
            const copy = structuredClone(original);
            copy.selectionId = command.ids[original.selectionId]!;
            if (copy.parentSelectionId && ids.has(copy.parentSelectionId)) copy.parentSelectionId = command.ids[copy.parentSelectionId]!;
            for (const choice of copy.optionChoices) for (const target of choice.targets) {
              if (target.kind==='attachment-member' && ids.has(target.ownerSelectionId)) target.ownerSelectionId = command.ids[target.ownerSelectionId]!;
            }
            return copy;
          });
          next.selections.push(...copies);
          break;
        }
        case 'options': requireSelection(next,command.selectionId).optionChoices = structuredClone(command.choices); break;
        case 'replace-entry': {
          const selection = requireSelection(next,command.selectionId);
          selection.entryReference = structuredClone(command.entryReference);
          for (const child of [...next.selections].filter(s=>s.parentSelectionId===selection.selectionId)) {
            const access = context.purchases.find(item=>item.entryId===child.entryReference.localId);
            if (access?.kind!=='attachment' || !access.parentEntryIds.includes(command.entryReference.localId) ||
                (child.targetMemberPath && !resolveRosterMemberPath(next,context.catalog,selection.selectionId,child.targetMemberPath))) {
              removeSubtree(next,child.selectionId,notices);
            }
          }
          pruneChoices(next,context,notices);
          break;
        }
        case 'settings': next.settings = {...next.settings,...structuredClone(command.patch)}; break;
        case 'rename': next.name = command.name; break;
        case 'reorder': {
          if (command.selectionIds.length!==next.selections.length || new Set(command.selectionIds).size!==next.selections.length || command.selectionIds.some(id=>!next.selections.some(s=>s.selectionId===id))) fail('reorder-ids','Reordering must name every existing selection exactly once.');
          next.selections = command.selectionIds.map(id=>requireSelection(next,id));
          break;
        }
      }
      const problems = checkDocument(next,context);
      if (problems.length) return {ok:false,document,problems};
    }
    return {ok:true,document:next,notices};
  } catch (error) {
    if (!(error instanceof CommandFailure)) throw error;
    return {ok:false,document,problems:[{code:error.code,message:error.message}]};
  }
}

function requireSelection(document:RosterDocument,id:string):RosterSelection {
  return document.selections.find(s=>s.selectionId===id) ?? fail('selection-missing',`Selection ${id} does not exist.`);
}

function subtreeIds(document:RosterDocument,root:string):Set<string> {
  const ids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const selection of document.selections) if (selection.parentSelectionId && ids.has(selection.parentSelectionId) && !ids.has(selection.selectionId)) {ids.add(selection.selectionId);changed=true;}
  }
  return ids;
}

function removeSubtree(document:RosterDocument,root:string,notices:CommandNotice[]):void {
  const ids = subtreeIds(document,root);
  for (const id of ids) notices.push({code:'selection-removed',selectionId:id,message:'Purchase and its descendant attachments removed.'});
  document.selections = document.selections.filter(s=>!ids.has(s.selectionId));
}

function checkDocument(document:RosterDocument,context:RosterCommandContext):CommandProblem[] {
  const shape = rosterDocumentSchema.safeParse(document);
  if (!shape.success) return shape.error.issues.map(issue=>({code:'document-shape',message:`${issue.path.join('.')}: ${issue.message}`}));
  const relations = validateRosterRelations(document,context.catalog);
  if (relations.length) return relations.map(issue=>({code:issue.checkId,message:issue.message}));
  const problems:CommandProblem[] = [];
  for (const selection of document.selections) {
    const access = context.purchases.find(item=>item.entryId===selection.entryReference.localId);
    if (selection.parentSelectionId===null) {
      if (access?.kind!=='top-level') problems.push({code:'purchase-context',message:`${selection.entryReference.localId} is not a top-level purchase.`});
    } else {
      const parent = document.selections.find(s=>s.selectionId===selection.parentSelectionId)!;
      if (access?.kind!=='attachment' || !access.parentEntryIds.includes(parent.entryReference.localId)) problems.push({code:'purchase-context',message:`${selection.entryReference.localId} is not offered by its parent.`});
    }
  }
  return problems;
}

/** Only destructive edits repair stale choices; an explicitly invalid options command is rejected. */
function pruneChoices(document:RosterDocument,context:RosterCommandContext,notices:CommandNotice[]):void {
  for (const selection of document.selections) {
    const retained:OptionChoice[] = [];
    for (const choice of selection.optionChoices) {
      const targets = choice.targets.filter(target=>{
        const probe = {...document,selections:document.selections.map(s=>({...s,optionChoices:s.selectionId===selection.selectionId?[{...choice,targets:[target]}]:[]}))};
        return validateRosterRelations(probe,context.catalog).length===0;
      });
      if (targets.length!==choice.targets.length) notices.push({code:targets.length?'targets-removed':'choice-removed',selectionId:selection.selectionId,message:`Invalidated targets removed from ${choice.optionLocalId}.`});
      if (targets.length) retained.push({...choice,targets});
    }
    selection.optionChoices = retained;
  }
}
