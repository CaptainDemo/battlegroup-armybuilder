import type { RulesetId } from '@battlegroup/core';
import { rulesets } from '../rulesets/registry';

/** Keep engine identifiers in diagnostics, with readable resource names in UI. */
export function issueMessage(message: string, rulesetId: RulesetId): string {
  return rulesets.get(rulesetId)?.formatIssue?.(message) ?? message;
}
