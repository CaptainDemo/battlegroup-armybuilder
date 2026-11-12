import type { Option, OptionChoice } from '@battlegroup/core';
import { samePath } from './memberTree';

/** Edits preserve siblings unless the ruleset explicitly declares a single target. */
export function updateMemberChoice(choices: readonly OptionChoice[], groupId: string, option: Option, path: string[], enabled: boolean, mode: 'single' | 'multiple' = 'multiple'): OptionChoice[] {
  const matches = (choice: OptionChoice) => choice.optionGroupLocalId === groupId && choice.optionLocalId === option.localId;
  const existing = choices.filter(matches).flatMap(choice => choice.targets);
  const targets = enabled && mode === 'single'
    ? [] : existing.filter(target => target.kind !== 'member-path' || !samePath(target.nodePath, path));
  if (enabled) targets.push({kind: 'member-path', nodePath: [...path]});
  const next = choices.filter(choice => !matches(choice));
  if (targets.length) next.push({optionGroupLocalId: groupId, optionLocalId: option.localId, targets});
  return next;
}
