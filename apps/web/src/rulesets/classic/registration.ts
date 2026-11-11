import {
  classicCatalogReleaseSchema, classicRosterDocumentSchema, classicTrainingLevelLabels,
  evaluateClassicRoster, getClassicEntryAvailability,
} from '@battlegroup/classic-coldwar';
import { projectSectionAllowances } from '../../features/roster-editor/sectionAllowances';
import type { RulesetRegistration } from '../types';
import { t } from '../../i18n';

export const classicRegistration: RulesetRegistration = {
  id: 'classic-coldwar',
  label: 'Classic Cold War',
  armies: [{
    identity: { rulesetId: 'classic-coldwar', catalogId: 'soviet-armoured-division-v4_1', catalogRevision: '1.1.0' },
    armyListId: 'soviet-armoured-division-v4_1',
    nation: 'Soviet', label: 'Soviet Armoured Division V4.1', defaultName: 'New Soviet roster',
  }],
  settings: {
    sizes: ['squad', 'platoon', 'company', 'battalion'].map(id => ({id, label: id})),
    defaultSize: 'platoon', defaultBudget: 500,
    scenarios: [{id: 'attack-defence', label: 'Attack-Defence'}],
    playerRoles: [{id: 'attacker', label: 'Attacker'}, {id: 'defender', label: 'Defender'}],
    optionalRules: [],
  },
  supports: entry => entry.identity.rulesetId === 'classic-coldwar' && (
    (entry.moduleContract === 'classic/1' && entry.rulesRevision === 'cw-draft6+sov-v4.1') ||
    (entry.moduleContract === 'classic/2' && entry.rulesRevision === 'cw-draft6+sov-v4.1+formations1')
  ),
  parseRelease(value) {
    const parsed = classicCatalogReleaseSchema.safeParse(value);
    return parsed.success ? {success: true, release: parsed.data} : {success: false, reason: parsed.error.issues.map(issue => issue.message).join('; ')};
  },
  validateRoster(document) {
    const parsed = classicRosterDocumentSchema.safeParse(document);
    return parsed.success ? [] : parsed.error.issues.map(issue => ({code: 'classic/document', message: issue.message}));
  },
  evaluate: evaluateClassicRoster,
  availability: getClassicEntryAvailability,
  trainingLabels: classicTrainingLevelLabels,
  optionBadges: option => [
    option.specialRules?.includes('restricted-choice') ? 'Restricted' : '',
    option.specialRules?.some(rule => rule.startsWith('unique-choice:')) ? 'Unique' : '',
  ].filter(Boolean),
  formatIssue: message => message
    .replaceAll('army-support-choice', t('editor.armySupportChoice'))
    .replaceAll('platoon-support-slots', t('editor.platoonSupportSlots')),
  sectionLabel(identity, section) {
    return identity.catalogId === 'soviet-armoured-division-v4_1' &&
      ['1.0.0', '1.1.0'].includes(identity.catalogRevision) && section.sectionId === 'motor-rifle'
      ? 'Infantry' : section.name;
  },
  sectionAllowances: (document, release) => projectSectionAllowances(document, release.catalog,
    new Set(release.purchases.filter(item => item.kind === 'top-level').map(item => item.entryId))),
  isMemberGroup: node => !!node.configurableSlot && node.role === 'platoon',
  usesPlatoonSupportLabel: (release, entryId) => !!release.catalog.entries.find(entry => entry.localId === entryId)?.resourceGrants?.some(
    grant => grant.resourceKind === 'platoon-support-slots' && grant.scope === 'parent-formation'),
  exampleCommands(release, newId) {
    const plan = ['fhq', 't72-platoon', 'bmp1-platoon', 'bmp1-platoon-medic', 'bmp1-platoon-fire-support', 'bmp1-platoon-agl', 'brdm2-recon', 'zsu23-4', 'artillery-request-priority3'];
    const ids = plan.map(() => newId());
    return plan.map((entryId, i) => {
      const entry = release.catalog.entries.find(item => item.localId === entryId)!;
      const attachment = release.purchases.find(item => item.entryId === entryId)?.kind === 'attachment';
      return {kind: 'add', selection: {
        selectionId: ids[i]!, entryReference: {...release.catalog.manifest.identity, localId: entryId},
        parentSelectionId: attachment ? ids[2]! : null,
        ...(!attachment ? {sectionId: entry.sectionIds[0]!} : {}), optionChoices: [],
      }};
    });
  },
};
