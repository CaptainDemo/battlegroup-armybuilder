import {
  optionTargetUnits, resolveChoiceTargets,
  type CatalogShell, type EvaluatedCompositionNode, type Option, type OptionChoice, type OptionGroup,
  type RosterDocument, type RosterSelection, type UnitEntry,
} from '@battlegroup/core';
import { t } from '../../i18n';
import { rulesets } from '../../rulesets/registry';
import { flattenMembers, memberAtPath, memberTree, samePath, targetOwner, withinPath } from './memberTree';
import { updateMemberChoice } from './memberOptions';

export function OptionEditor({document, selection, entry, catalog, memberPath, composition, onChoices}: {
  document: RosterDocument;
  selection: RosterSelection;
  entry: UnitEntry;
  catalog: CatalogShell;
  memberPath: string[] | null;
  composition?: EvaluatedCompositionNode | undefined;
  onChoices: (choices: OptionChoice[]) => void;
}) {
  const runtime = rulesets.require(document.catalogRef.rulesetId);
  const baseRoot = entry.composition.state === 'known' ? entry.composition.root : undefined;
  const root = composition ?? baseRoot;
  const members = memberTree(root, catalog, runtime);
  const memberScopes = flattenMembers(members).reverse();
  const currentPath = memberPath ?? [];
  const label = (path: readonly string[]) => path.map(part => part.replaceAll('-', ' ')).join(' / ');
  function updateWhole(groupId: string, option: Option, enabled: boolean) {
    const choice: OptionChoice = {optionGroupLocalId: groupId, optionLocalId: option.localId, targets: [{kind: 'whole-selection'}]};
    if (option.target.kind === 'scope-selector') choice.targets = resolveChoiceTargets(document, catalog, selection.selectionId, option, choice);
    const next = selection.optionChoices.filter(item => item.optionGroupLocalId !== groupId || item.optionLocalId !== option.localId);
    if (enabled && choice.targets.length) next.push(choice);
    onChoices(next);
  }
  return <>{entry.optionGroupIds.map(groupId => {
    const group = catalog.optionGroups.find(item => item.localId === groupId)!;
    const options = group.options.filter(option => {
      if (option.target.kind === 'member-slots') return option.target.nodePaths.some(path => samePath(targetOwner(path, members), currentPath));
      const owner = option.target.kind === 'scope-selector' ? targetOwner(option.target.rootMemberPath ?? [], members) : [];
      return samePath(owner, currentPath);
    });
    if (!options.length) return null;
    return <fieldset key={groupId}>
      <legend>{group.name}</legend>
      {options.map(option => {
        const choice = selection.optionChoices.find(item => item.optionGroupLocalId === groupId && item.optionLocalId === option.localId);
        const points = option.costDelta.points.state === 'known' ? (option.costDelta.points.value >= 0 ? '+' : '') + option.costDelta.points.value : t('editor.unknown');
        const br = option.costDelta.br.state === 'known' ? (option.costDelta.br.value >= 0 ? '+' : '') + option.costDelta.br.value : t('editor.unknown');
        const paths = option.target.kind === 'member-slots'
          ? option.target.nodePaths.filter(path => samePath(targetOwner(path, members), currentPath)) : [];
        const mode = runtime.memberChoiceMode?.(option) ?? 'multiple';
        const assigned = mode === 'single' ? choice?.targets.flatMap(target => target.kind === 'member-path' ? [target.nodePath] : []) ?? [] : [];
        const elsewhere = assigned.filter(path => !paths.some(visible => samePath(path, visible)));
        const badges = runtime.optionBadges?.(option) ?? [];
        const max = sharedMaximum(option, group, document, catalog, selection.selectionId);
        const scopePaths = option.target.kind === 'member-slots' ? option.target.nodePaths
          : option.target.kind === 'scope-selector' && option.target.rootMemberPath ? [option.target.rootMemberPath] : [];
        const memberScope = scopePaths.length > 0
          ? memberScopes.find(member => scopePaths.every(path => withinPath(path, member.path)))
          : undefined;
        const limitScope = group.scope === 'selection' ? memberScope?.label ?? entry.name : group.scope.replaceAll('-', ' ');
        const priceBasis = option.target.kind === 'scope-selector' ? t('editor.perMatchingMember') : t('editor.perTarget');
        return <div className="option-row" key={option.localId}>
          {option.target.kind === 'member-slots' ? <>
            <strong>{option.name}</strong>
            {paths.map(path => <label className="checkbox-label" key={JSON.stringify(path)}>
              <input type="checkbox" aria-label={paths.length === 1 ? option.name : option.name + ' — ' + label(path)}
                checked={choice?.targets.some(target => target.kind === 'member-path' && samePath(target.nodePath, path)) ?? false}
                disabled={(memberAtPath(root, path)?.quantity ?? 0) <= 0 && !choice?.targets.some(target => target.kind === 'member-path' && samePath(target.nodePath, path))}
                onChange={event => onChoices(updateMemberChoice(selection.optionChoices, groupId, option, path, event.target.checked, mode))} />
              <span>{paths.length === 1 ? t('editor.applyToMember') : label(path)}</span>
            </label>)}
          </> : <label className="checkbox-label">
            <input type="checkbox" checked={!!choice} onChange={event => updateWhole(groupId, option, event.target.checked)} />
            <span>{option.name}</span>
          </label>}
          <small>{points} Points / {br} BR{option.chargeMode === 'per-target' ? ' · ' + priceBasis : ''}</small>
          {badges.length > 0 && <small>{badges.join(' / ')}</small>}
          {max !== undefined && <small>{t('editor.sharedLimit')} {max} ({limitScope})</small>}
          {elsewhere.length > 0 && <small>{t('editor.assignedElsewhere')} {elsewhere.map(label).join(', ')}. {t('editor.moveUpgradeHere')}</small>}
        </div>;
      })}
    </fieldset>;
  })}</>;
}

function sharedMaximum(option: Option, group: OptionGroup, document: RosterDocument, catalog: CatalogShell, selectionId: string): number | undefined {
  if (option.ownLimit.kind !== 'limited') return undefined;
  const { max } = option.ownLimit;
  if (group.scope !== 'selection' || max === 0) return max;
  if (option.chargeMode === 'once') {
    return option.target.kind === 'member-slots' && option.target.nodePaths.length > 1 ? max : undefined;
  }

  // Count every reachable target, including matching attachments for all-member upgrades.
  const choice: OptionChoice = {
    optionGroupLocalId: group.localId,
    optionLocalId: option.localId,
    targets: option.target.kind === 'member-slots'
      ? option.target.nodePaths.map(nodePath => ({ kind: 'member-path', nodePath }))
      : [{ kind: 'whole-selection' }],
  };
  const targets = resolveChoiceTargets(document, catalog, selectionId, option, choice);
  const capacity = targets.reduce((total, target) => total + optionTargetUnits(document, catalog, selectionId, target), 0);
  return max < capacity ? max : undefined;
}
