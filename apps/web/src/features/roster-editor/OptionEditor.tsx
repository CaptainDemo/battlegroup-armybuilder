import {
  resolveChoiceTargets,
  type CatalogShell,
  type Option,
  type OptionChoice,
  type RosterDocument,
  type RosterSelection,
  type UnitEntry,
} from '@battlegroup/core';
import { t } from '../../i18n';
import { rulesets } from '../../rulesets/registry';

export function OptionEditor({
  document,
  selection,
  entry,
  catalog,
  memberPath,
  onChoices,
}: {
  document: RosterDocument;
  selection: RosterSelection;
  entry: UnitEntry;
  catalog: CatalogShell;
  memberPath: string[] | null;
  onChoices: (choices: OptionChoice[]) => void;
}) {
  const runtime = rulesets.require(document.catalogRef.rulesetId);
  function update(
    groupId: string,
    option: Option,
    enabled: boolean,
    paths?: string[][],
  ): void {
    const choice: OptionChoice = {
      optionGroupLocalId: groupId,
      optionLocalId: option.localId,
      targets:
        option.target.kind === 'whole-selection'
          ? [{ kind: 'whole-selection' }]
          : option.target.kind === 'member-slots'
            ? (paths ?? [option.target.nodePaths[0]!]).map((nodePath) => ({
                kind: 'member-path',
                nodePath,
              }))
            : [],
    };
    if (option.target.kind === 'scope-selector')
      choice.targets = resolveChoiceTargets(
        document,
        catalog,
        selection.selectionId,
        option,
        choice,
      );
    const next = selection.optionChoices.filter(
      (item) =>
        item.optionGroupLocalId !== groupId ||
        item.optionLocalId !== option.localId,
    );
    if (enabled && choice.targets.length) next.push(choice);
    onChoices(next);
  }
  const inMember = (option: Option): boolean =>
    !memberPath ||
    (option.target.kind === 'scope-selector'
      ? JSON.stringify(option.target.rootMemberPath) ===
        JSON.stringify(memberPath)
      : option.target.kind === 'member-slots' &&
        option.target.nodePaths.every((path) =>
          memberPath.every((id, i) => path[i] === id),
        ));
  const label = (path: string[]) =>
    path.map((part) => part.replaceAll('-', ' ')).join(' / ');
  return (
    <>
      {entry.optionGroupIds.map((groupId) => {
        const group = catalog.optionGroups.find(
          (item) => item.localId === groupId,
        )!;
        const options = group.options.filter(inMember);
        if (!options.length) return null;
        return (
          <fieldset key={groupId}>
            <legend>{group.name}</legend>
            {options.map((option) => {
              const choice = selection.optionChoices.find(
                (item) =>
                  item.optionGroupLocalId === groupId &&
                  item.optionLocalId === option.localId,
              );
              const multiple =
                option.target.kind === 'member-slots' &&
                option.chargeMode === 'per-target' &&
                (option.ownLimit.kind !== 'limited' || option.ownLimit.max > 1);
              const points =
                option.costDelta.points.state === 'known'
                  ? (option.costDelta.points.value >= 0 ? '+' : '') +
                    option.costDelta.points.value
                  : t('editor.unknown');
              const br =
                option.costDelta.br.state === 'known'
                  ? (option.costDelta.br.value >= 0 ? '+' : '') +
                    option.costDelta.br.value
                  : t('editor.unknown');
              return (
                <div className="option-row" key={option.localId}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!choice}
                      onChange={(event) =>
                        update(groupId, option, event.target.checked)
                      }
                    />
                    <span>
                      {option.name}
                      <small>
                        {points} Points / {br} BR
                        {option.chargeMode === 'per-target'
                          ? ' · ' + t('editor.perTarget')
                          : ''}
                      </small>
                      {!!runtime.optionBadges?.(option).length && <small>{runtime.optionBadges(option).join(' / ')}</small>}
                    </span>
                  </label>
                  {option.target.kind === 'member-slots' &&
                    (multiple ? (
                      <div className="target-checks">
                        {option.target.nodePaths.map((path) => {
                          const checked =
                            choice?.targets.some(
                              (target) =>
                                target.kind === 'member-path' &&
                                JSON.stringify(target.nodePath) ===
                                  JSON.stringify(path),
                            ) ?? false;
                          return (
                            <label
                              className="checkbox-label"
                              key={path.join('/')}
                            >
                              <input
                                type="checkbox"
                                aria-label={option.name + ' — ' + label(path)}
                                checked={checked}
                                onChange={(event) => {
                                  const paths = (choice?.targets ?? [])
                                    .flatMap((target) =>
                                      target.kind === 'member-path'
                                        ? [target.nodePath]
                                        : [],
                                    )
                                    .filter(
                                      (old) =>
                                        JSON.stringify(old) !==
                                        JSON.stringify(path),
                                    );
                                  if (event.target.checked) paths.push(path);
                                  update(
                                    groupId,
                                    option,
                                    paths.length > 0,
                                    paths,
                                  );
                                }}
                              />
                              <span>{label(path)}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <select
                        aria-label={option.name + ' ' + t('editor.target')}
                        disabled={!choice}
                        value={
                          choice?.targets[0]?.kind === 'member-path'
                            ? choice.targets[0].nodePath.join('/')
                            : option.target.nodePaths[0]!.join('/')
                        }
                        onChange={(event) =>
                          update(groupId, option, true, [
                            event.target.value.split('/'),
                          ])
                        }
                      >
                        {option.target.nodePaths.map((path) => (
                          <option key={path.join('/')} value={path.join('/')}>
                            {label(path)}
                          </option>
                        ))}
                      </select>
                    ))}
                </div>
              );
            })}
          </fieldset>
        );
      })}
    </>
  );
}
