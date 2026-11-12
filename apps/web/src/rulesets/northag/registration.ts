import type { RosterCommandContext } from '@battlegroup/core';
import {
  evaluateNorthagRoster, getNorthagAvailability, northagGameSizes, northagReleaseSchema,
  northagRequestAllowance, northagRequestRule, northagRulesRevision, northagSections,
  northagTrainingLabels, validateNorthagRoster, type NorthagRelease,
} from '@battlegroup/northag';
import type { SectionAllowance } from '../../features/roster-editor/sectionAllowances';
import type { RulesetRegistration } from '../types';

function northagRelease(context: RosterCommandContext): NorthagRelease {
  // The registry loads the validated concrete release and retains its extra fields.
  if (context.catalog.manifest.identity.rulesetId !== 'northag' || !('entryLimits' in context)) {
    throw new Error('Expected a validated NORTHAG release.');
  }
  return context as NorthagRelease;
}

export const northagRegistration: RulesetRegistration = {
  id: 'northag',
  label: 'NORTHAG',
  armies: [{
    identity: { rulesetId: 'northag', catalogId: 'russian-armoured-battlegroup-2020', catalogRevision: '1.0.0' },
    armyListId: 'russian-armoured-battlegroup-2020',
    nation: 'Soviet',
    label: 'Russian Armoured Battlegroup (2020 + v9)',
    defaultName: 'New NORTHAG Soviet roster',
  }],
  settings: {
    sizes: Object.entries(northagGameSizes).map(([id, size]) => ({ id, label: id + ' (' + size.points + ' recommended Points)' })),
    defaultSize: 'platoon',
    defaultBudget: northagGameSizes.platoon.points,
    scenarios: [],
    playerRoles: [],
    optionalRules: [{ id: northagRequestRule, label: 'Reinforcement Requests' }],
  },
  supports: release => release.identity.rulesetId === 'northag' && release.rulesRevision === northagRulesRevision && release.moduleContract === 'northag/1',
  parseRelease(value) {
    const result = northagReleaseSchema.safeParse(value);
    return result.success ? { success: true, release: result.data } : {
      success: false, reason: result.error.issues.map(issue => issue.message).join('; '),
    };
  },
  validateRoster: validateNorthagRoster,
  evaluate: (document, release) => evaluateNorthagRoster(document, northagRelease(release)),
  availability: (document, release, id, target) => getNorthagAvailability(document, northagRelease(release), id, target),
  trainingLabels: northagTrainingLabels,
  entryBadges(entry, context) {
    const limit = northagRelease(context).entryLimits[entry.localId];
    const badges = entry.tags?.includes('restricted') ? ['Restricted'] : [];
    if (limit?.kind === 'limited' && !entry.sectionIds.includes(northagSections.vanguard)) {
      badges.push('Maximum ' + limit.max + ' in this section');
    }
    return badges;
  },
  optionBadges: option => option.specialRules?.includes('restricted-choice') ? ['Restricted'] : [],
  sectionLabel: (_identity, section) => section.name,
  sectionAllowances(document, { catalog }) {
    const list = catalog.armyLists.find(item => item.armyListId === document.armyListId);
    const requests = northagRequestAllowance(document);
    return new Map((list?.structure.sections ?? []).map(section => {
      const selected = document.selections.filter(item => item.sectionId === section.sectionId).length;
      let allowance: SectionAllowance = { selected, limits: [] };
      if (section.sectionId === northagSections.forward) allowance = { ...allowance, minimum: 1 };
      if (section.sectionId === northagSections.vanguard) {
        allowance = { ...allowance, limits: [{ used: selected, capacity: 1, shared: false }] };
      }
      if (section.sectionId === northagSections.requests && requests.enabled) {
        allowance = { selected, included: requests.free, limits: [{ used: requests.free + selected, capacity: requests.maximum, shared: false }] };
      }
      return [section.sectionId, allowance];
    }));
  },
  isMemberGroup: node => node.role === 'platoon',
  memberPresentation(node, catalog) {
    if (node.role === 'platoon' || node.role === 'transport-group') {
      const label = node.role === 'platoon' ? node.nodeId : 'transport ' + node.nodeId;
      return { label: label.replaceAll('-', ' ') };
    }
    const profile = catalog.profiles.find(item => item.localId === node.profileLocalId);
    if (!profile) return null;
    if (node.role === 'weapon-team-transport') return { label: 'Shared weapon-team transport · ' + profile.name };
    const slot = node.nodeId.startsWith('tank-') ? node.nodeId.replace('-', ' ') + ' · ' : '';
    return { label: slot + profile.name };
  },
  memberChoiceMode: option => option.localId === 'kmt' ? 'single' : 'multiple',
  usesPlatoonSupportLabel: () => false,
};
