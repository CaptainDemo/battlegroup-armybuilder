import { validateRosterCommandDocument, type CatalogIndex, type RosterDocument, type RulesetId } from '@battlegroup/core';
import { classicRegistration } from './classic/registration';
import { northagRegistration } from './northag/registration';
import type { AppCatalogRelease, RulesetRegistration } from './types';

/** Explicit composition, also injectable in tests. No module discovery or foreign fallback. */
export function createRulesetRegistry(registrations: readonly RulesetRegistration[]) {
  const modules = new Map<RulesetId, RulesetRegistration>();
  for (const registration of registrations) {
    if (modules.has(registration.id)) throw new Error(`Duplicate ruleset: ${registration.id}`);
    modules.set(registration.id, registration);
  }
  return {
    all: [...modules.values()] as readonly RulesetRegistration[],
    get: (id: RulesetId) => modules.get(id),
    require(id: RulesetId): RulesetRegistration {
      const registration = modules.get(id);
      if (!registration) throw new Error(`Unsupported ruleset: ${id}`);
      return registration;
    },
    validateRoster(document: RosterDocument, release: AppCatalogRelease) {
      const structural = validateRosterCommandDocument(document, release);
      const registration = modules.get(document.catalogRef.rulesetId);
      return [...structural, ...(registration
        ? registration.validateRoster(document)
        : [{ code: 'unsupported-ruleset', message: 'The roster ruleset is not installed.' }])];
    },
    creationChoices(index: CatalogIndex) {
      return [...modules.values()].flatMap(runtime => runtime.armies.flatMap(army => {
        const release = index.releases.find(item => sameCatalogIdentity(item.identity, army.identity));
        return release && runtime.supports(release) ? [{ runtime, army }] : [];
      }));
    },
  };
}
export function sameCatalogIdentity(a: {rulesetId: string; catalogId: string; catalogRevision: string}, b: {rulesetId: string; catalogId: string; catalogRevision: string}): boolean {
  return a.rulesetId === b.rulesetId && a.catalogId === b.catalogId && a.catalogRevision === b.catalogRevision;
}
export const rulesets = createRulesetRegistry([classicRegistration, northagRegistration]);
