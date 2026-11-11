import type { FormEvent } from 'react';
import type { RosterDocument } from '@battlegroup/core';
import type { ArmyChoice, RulesetRegistration } from '../../rulesets/types';
import { t } from '../../i18n';

export interface CreationChoice { runtime: RulesetRegistration; army: ArmyChoice }
export const creationKey = ({army}: CreationChoice): string => JSON.stringify([army.identity, army.armyListId]);

export function CreateForm({disabled, choices, selected, onSelect, onCreate}: {
  disabled: boolean; choices: readonly CreationChoice[]; selected: CreationChoice;
  onSelect: (choice: CreationChoice) => void;
  onCreate: (name: string, budget: number, size: string) => void;
}) {
  const {runtime, army} = selected;
  const nations = [...new Set(choices.filter(choice => choice.runtime.id === runtime.id).map(choice => choice.army.nation))];
  const armies = choices.filter(choice => choice.runtime.id === runtime.id && choice.army.nation === army.nation);
  const modules = [...new Map(choices.map(choice => [choice.runtime.id,choice.runtime])).values()];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onCreate(String(data.get('name')), Number(data.get('budget')), String(data.get('size')));
  };
  return <form className="settings-form" onSubmit={submit}>
    <label>{t('editor.name')}<input key={creationKey(selected)+'name'} name="name" required defaultValue={army.defaultName} /></label>
    <label>{t('editor.ruleset')}<select value={runtime.id} onChange={event => onSelect(choices.find(choice => choice.runtime.id === event.target.value)!)}>
      {modules.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}
    </select></label>
    <label>{t('editor.nation')}<select value={army.nation} onChange={event => onSelect(choices.find(choice => choice.runtime.id === runtime.id && choice.army.nation === event.target.value)!)}>
      {nations.map(nation => <option key={nation}>{nation}</option>)}
    </select></label>
    <label>{t('editor.army')}<select value={creationKey(selected)} onChange={event => onSelect(armies.find(choice => creationKey(choice) === event.target.value)!)}>
      {armies.map(choice => <option key={creationKey(choice)} value={creationKey(choice)}>{choice.army.label}</option>)}
    </select></label>
    <label>{t('editor.budget')}<input key={runtime.id+'budget'} name="budget" type="number" min="1" required defaultValue={runtime.settings.defaultBudget} /></label>
    <label>{t('editor.gameSize')}<SizeSelect key={runtime.id} runtime={runtime} name="size" defaultValue={runtime.settings.defaultSize} /></label>
    <button type="submit" disabled={disabled}>{t('editor.create')}</button>
  </form>;
}
function SizeSelect({runtime, ...props}: {runtime: RulesetRegistration; name: string; defaultValue: string}) {
  return <select {...props}>{runtime.settings.sizes.map(size => <option key={size.id} value={size.id}>{size.label}</option>)}</select>;
}
export function SettingsForm({document, runtime, onApply}: {
  document: RosterDocument; runtime: RulesetRegistration;
  onApply: (name: string, patch: Partial<RosterDocument['settings']>) => void;
}) {
  return <form className="settings-form card settings-card" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Preserve unknown/legacy optional flags rather than silently erasing them.
    const declared = new Set(runtime.settings.optionalRules.map(rule => rule.id));
    onApply(String(data.get('roster-name')), {
      budgetPoints: Number(data.get('budget')), gameSizeId: String(data.get('size')),
      scenarioId: runtime.settings.scenarios.length ? String(data.get('scenario') ?? '') || undefined : document.settings.scenarioId,
      playerRoleId: runtime.settings.playerRoles.length ? String(data.get('player-role') ?? '') || undefined : document.settings.playerRoleId,
      optionalRules: [...document.settings.optionalRules.filter(id => !declared.has(id)), ...data.getAll('optional-rule').map(String)],
    });
  }}>
    <label>{t('editor.name')}<input name="roster-name" required defaultValue={document.name} /></label>
    <label>{t('editor.budget')}<input id="budget-input" name="budget" type="number" min="1" required defaultValue={document.settings.budgetPoints} /></label>
    <label>{t('editor.gameSize')}<SizeSelect runtime={runtime} name="size" defaultValue={document.settings.gameSizeId} /></label>
    {runtime.settings.scenarios.length > 0 && <label>{t('editor.scenario')}<select name="scenario" defaultValue={document.settings.scenarioId ?? ''}>
      <option value="">{t('editor.unspecified')}</option>
      {runtime.settings.scenarios.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
    </select></label>}
    {runtime.settings.playerRoles.length > 0 && <label>{t('editor.playerRole')}<select name="player-role" defaultValue={document.settings.playerRoleId ?? ''}>
      <option value="">{t('editor.unspecified')}</option>
      {runtime.settings.playerRoles.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
    </select></label>}
    {runtime.settings.optionalRules.map(rule => <label className="checkbox-label" key={rule.id}>
      <input type="checkbox" name="optional-rule" value={rule.id} defaultChecked={document.settings.optionalRules.includes(rule.id)} />{rule.label}
    </label>)}
    <button type="submit">{t('editor.applySettings')}</button>
  </form>;
}
