import { useEffect, useState } from 'react';
import { memberElementId, memberTree, samePath, flattenMembers, type MemberNode } from './memberTree';
import { rulesets } from '../../rulesets/registry';
import { sectionTree, descendantSectionIds, type SectionNode } from './sectionTree';
import type {
  RosterDocument,
  RosterSelection,
  Evaluation,
  EvaluatedCompositionNode,
} from '@battlegroup/core';
import type { AppCatalogRelease, RulesetRegistration } from '../../rulesets/types';
import { t } from '../../i18n';
import { sectionLabel } from './sectionLabel';
import { SectionCount } from '../../components/SectionCount';
import type { SectionAllowance } from './sectionAllowances';
import { collectUnitProfiles } from './unitData';
import { SelectionCost } from './SelectionCost';
import { rulesByPath, type SpecialRulesView, type SpecialRuleView } from '../../rulesets/specialRules';

function profileSummary(node: EvaluatedCompositionNode, release: AppCatalogRelease, visible: MemberNode[], includeRoot = true) {
  return collectUnitProfiles(node, { excludeSubtrees: visible.map(member => member.node), includeRoot })
    .map(({ profileLocalId, quantity }) => {
      const profile = release.catalog.profiles.find(item => item.localId === profileLocalId);
      return quantity + ' × ' + (profile?.name ?? profileLocalId);
    });
}

/** A UI destination, separate from the player's stored purchase tree. */
export type AddTarget =
  | { kind: 'section'; sectionId: string }
  | { kind: 'attachment'; parentSelectionId: string; memberPath?: string[] };

interface TreeProps {
  evaluation?: Evaluation | undefined;
  specialRules?: SpecialRulesView;
  runtime?: RulesetRegistration;
  document: RosterDocument;
  release: AppCatalogRelease;
  selectedId: string | null;
  selectedMemberPath: string[] | null;
  addTarget: AddTarget | null;
  allowances: ReadonlyMap<string, SectionAllowance>;
  onSelect: (id: string, memberPath?: string[]) => void;
  onRemove: (id: string) => void;
  onAdd: (target: AddTarget) => void;
}

export function RosterTree(props: TreeProps) {
  const {document, release} = props;
  const sections = release.catalog.armyLists.find(list => list.armyListId === document.armyListId)!.structure.sections;
  return <>
    {!document.selections.length && <p className="muted">{t('editor.emptyRoster')}</p>}
    {sectionTree(sections).map(node => <SectionBranch key={node.section.sectionId} {...props} node={node} />)}
  </>;
}

function SectionBranch(props: TreeProps & {node: SectionNode}) {
  const {document, release, node, addTarget, onAdd} = props;
  const {section, children} = node;
  const canAdd = section.directlyPurchasable && release.catalog.entries.some(entry =>
    entry.armyListIds.includes(document.armyListId) && entry.sectionIds.includes(section.sectionId) &&
    release.purchases.some(access => access.kind === 'top-level' && access.entryId === entry.localId));
  if (!canAdd && !children.length) return null;
  const label = props.runtime?.sectionLabel(document.catalogRef, section) ?? sectionLabel(document.catalogRef, section);
  const descendants = new Set(descendantSectionIds(node));
  const allowance = props.allowances.get(section.sectionId);
  const displayedAllowance = children.length ? {
    limits: allowance?.limits ?? [],
    selected: document.selections.filter(item => item.parentSelectionId === null && descendants.has(item.sectionId!)).length,
  } : allowance;
  return <section className="roster-section" aria-label={label} data-adding={addTarget?.kind === 'section' && addTarget.sectionId === section.sectionId}>
    <div className="roster-section-heading">
      <h4>{label}</h4>
      {displayedAllowance && <SectionCount allowance={displayedAllowance} />}
    </div>
    {document.selections.filter(selection => selection.parentSelectionId === null && selection.sectionId === section.sectionId)
      .map((selection, index) => <PurchaseBranch key={selection.selectionId} {...props} selection={selection} ordinal={index+1} />)}
    {canAdd && <button type="button" className="add-slot" aria-label={t('editor.addTo')+' '+label}
      onClick={() => onAdd({kind: 'section', sectionId: section.sectionId})}>+ {t('editor.addFormation')}</button>}
    {children.length > 0 && <div className="roster-subsections">{children.map(child => <SectionBranch key={child.section.sectionId} {...props} node={child} />)}</div>}
  </section>;
}

function PurchaseBranch(
  props: TreeProps & { selection: RosterSelection; ordinal: number },
) {
  const {
    selection,
    ordinal,
    document,
    release,
    selectedId,
    addTarget,
    onSelect,
    onRemove,
    onAdd,
  } = props;
  const entry = release.catalog.entries.find(
    (item) => item.localId === selection.entryReference.localId,
  )!;
  const label = entry.name + ' · ' + ordinal;
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    let active = document.selections.find(item => item.selectionId === selectedId);
    while (active?.parentSelectionId) {
      if (active.parentSelectionId === selection.selectionId) {
        setExpanded(true);
        return;
      }
      active = document.selections.find(item => item.selectionId === active?.parentSelectionId);
    }
  }, [selectedId, document.selections, selection.selectionId]);
  const children = document.selections.filter(
    (item) =>
      item.parentSelectionId === selection.selectionId &&
      !item.targetMemberPath,
  );
  const hasAttachments = release.purchases.some(
    (access) =>
      access.kind === 'attachment' &&
      access.parentEntryIds.includes(entry.localId) &&
      !access.parentMemberPaths?.[entry.localId],
  );
  const runtime = props.runtime ?? rulesets.require(document.catalogRef.rulesetId);
  const hasPlatoonSupport = runtime.usesPlatoonSupportLabel(release, entry.localId);
  const composition = props.evaluation
    ? props.evaluation.composition.find(item => item.selectionId === selection.selectionId)?.node
    : entry.composition.state === 'known' ? entry.composition.root : undefined;
  const members = memberTree(composition, release.catalog, runtime);
  const rules = rulesByPath(props.specialRules, selection.selectionId);
  const displayedPaths = flattenMembers(members).map(member => member.path);
  const unplaced = document.selections.filter(child => child.parentSelectionId === selection.selectionId && child.targetMemberPath &&
    !displayedPaths.some(path => samePath(path, child.targetMemberPath!)));
  const canExpand = members.length > 0 || children.length > 0 || unplaced.length > 0 || hasAttachments;
  const charges = props.evaluation?.chargeLines.filter(line => line.selectionId === selection.selectionId) ?? [];
  const summary = composition ? profileSummary(composition, release, expanded ? members : []) : [];
  const attachmentCount = document.selections.filter(child => child.parentSelectionId === selection.selectionId).length;
  if (attachmentCount && !expanded) summary.push(attachmentCount + ' ' + t(attachmentCount === 1 ? 'editor.attachedUnit' : 'editor.attachedUnits'));
  return (
    <div className="purchase-branch">
      <div className="purchase-row">
        {canExpand && <button type="button" className="purchase-toggle"
          aria-expanded={expanded}
          aria-controls={'composition-' + selection.selectionId}
          aria-label={t(expanded ? 'editor.collapseComposition' : 'editor.expandComposition') + ' ' + label}
          onClick={() => setExpanded(open => !open)}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>}
        <button
          type="button"
          id={'selection-' + selection.selectionId}
          className="purchase-card"
          aria-pressed={
            selectedId === selection.selectionId && !props.selectedMemberPath
          }
          onClick={() => onSelect(selection.selectionId)}
        >
          <strong>{label}</strong>
          <SelectionCost lines={charges} />
          {summary.length > 0 && <small className="purchase-composition">{summary.join(' · ')}</small>}
          <RosterRuleTags rules={rules.get('[]')} />
        </button>
        <button
          type="button"
          className="purchase-remove"
          aria-label={t('editor.remove') + ' ' + label}
          onClick={() => onRemove(selection.selectionId)}
        >
          {t('editor.delete')}
        </button>
      </div>
      {canExpand && (
        <div id={'composition-' + selection.selectionId} hidden={!expanded}>
          {members.map(member => <MemberBranch key={JSON.stringify(member.path)} {...props} selection={selection} member={member} parentLabel={label} rules={rules} />)}
          {unplaced.map((child, index) => <PurchaseBranch key={child.selectionId} {...props} selection={child} ordinal={index + 1} />)}
          {(children.length > 0 || hasAttachments) && (
            <div className="purchase-children">
              {children.map((child, index) => (
                <PurchaseBranch
                  key={child.selectionId}
                  {...props}
                  selection={child}
                  ordinal={index + 1}
                />
              ))}
              {hasAttachments && (
                <button
                  type="button"
                  className="add-slot"
                  aria-label={
                    t(
                      hasPlatoonSupport
                        ? 'editor.addAttachmentTo'
                        : 'editor.addAttachedUnitTo',
                    ) +
                    ' ' +
                    label
                  }
                  aria-pressed={
                    addTarget?.kind === 'attachment' &&
                    addTarget.parentSelectionId === selection.selectionId &&
                    !addTarget.memberPath
                  }
                  onClick={() =>
                    onAdd({
                      kind: 'attachment',
                      parentSelectionId: selection.selectionId,
                    })
                  }
                >
                  ＋{' '}
                  {t(
                    hasPlatoonSupport
                      ? 'editor.addAttachment'
                      : 'editor.addAttachedUnit',
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RosterRuleTags({ rules }: { rules: readonly SpecialRuleView[] | undefined }) {
  return rules?.length ? <span className="roster-rule-tags">
    {rules.map(rule => <span key={rule.key} className="rule-tag">{rule.name}</span>)}
  </span> : null;
}

function MemberBranch(props: TreeProps & {
  selection: RosterSelection;
  member: MemberNode;
  parentLabel: string;
  rules: ReadonlyMap<string, readonly SpecialRuleView[]>;
}) {
  const {selection, member, parentLabel, document, release, onSelect, onAdd, selectedId, selectedMemberPath, addTarget} = props;
  const {path, label, node} = member;
  const attachments = document.selections.filter(child => child.parentSelectionId === selection.selectionId && child.targetMemberPath && samePath(child.targetMemberPath, path));
  const hasMenu = release.purchases.some(access => access.kind === 'attachment' && access.parentMemberPaths?.[selection.entryReference.localId]?.some(target => samePath(target, path)));
  const summary = profileSummary(node, release, member.children, false);
  return <div className="purchase-children member-branch" data-member-path={JSON.stringify(path)}>
    <button type="button" id={memberElementId(selection.selectionId, path)}
      className="purchase-card" aria-label={label + ' — ' + parentLabel}
      aria-pressed={selectedId === selection.selectionId && samePath(selectedMemberPath ?? [], path)}
      onClick={() => onSelect(selection.selectionId, path)}>
      <strong>{node.quantity > 1 ? node.quantity + ' × ' : ''}{label}</strong>
      {summary.length > 0 && <small className="purchase-composition">{summary.join(' · ')}</small>}
      <RosterRuleTags rules={props.rules.get(JSON.stringify(path))} />
    </button>
    {member.children.map(child => <MemberBranch key={JSON.stringify(child.path)} {...props} member={child} parentLabel={parentLabel + ' / ' + label} />)}
    {attachments.map((child, index) => <PurchaseBranch key={child.selectionId} {...props} selection={child} ordinal={index + 1} />)}
    {hasMenu && <button type="button" className="add-slot"
      aria-label={t('editor.addAttachmentTo') + ' ' + label + ' — ' + parentLabel}
      aria-pressed={addTarget?.kind === 'attachment' && addTarget.parentSelectionId === selection.selectionId && samePath(addTarget.memberPath ?? [], path)}
      onClick={() => onAdd({kind: 'attachment', parentSelectionId: selection.selectionId, memberPath: path})}>
      + {t('editor.addAttachment')}
    </button>}
  </div>;
}
