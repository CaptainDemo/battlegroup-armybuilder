import type {
  ArmySection, Availability, CatalogIdentity, CatalogIndex, CompositionNode,
  Evaluation, Option, RosterCommand, RosterCommandContext, RosterDocument, RulesetId,
} from '@battlegroup/core';
import type { SectionAllowance } from '../features/roster-editor/sectionAllowances';

/** Shared application context. Concrete parsers retain their own richer catalog records. */
export interface AppCatalogRelease extends RosterCommandContext {
  moduleContract: string;
  coverage: { omitted: string[]; note: string };
}
export type IndexedRelease = CatalogIndex['releases'][number];
export type ReleaseParseResult =
  | { success: true; release: AppCatalogRelease }
  | { success: false; reason: string };
export interface SettingChoice { id: string; label: string }
export interface ArmyChoice {
  identity: CatalogIdentity;
  armyListId: string;
  nation: string;
  label: string;
  defaultName: string;
}
export interface EntryTarget {
  parentSelectionId?: string;
  sectionId?: string;
  targetMemberPath?: string[];
}
export interface RulesetRegistration {
  id: RulesetId;
  label: string;
  /** Explicit defaults, independent of catalog-index ordering. Only released lists belong here. */
  armies: readonly ArmyChoice[];
  settings: {
    sizes: readonly SettingChoice[];
    defaultSize: string;
    defaultBudget: number;
    scenarios: readonly SettingChoice[];
    playerRoles: readonly SettingChoice[];
    optionalRules: readonly SettingChoice[];
  };
  supports: (release: IndexedRelease) => boolean;
  parseRelease: (value: unknown) => ReleaseParseResult;
  /** Boundary validation only; ordinary rule violations remain editable drafts. */
  validateRoster: (document: RosterDocument) => readonly { code: string; message: string }[];
  evaluate: (document: RosterDocument, release: AppCatalogRelease) => Evaluation;
  availability: (document: RosterDocument, release: AppCatalogRelease, entryId: string, target: EntryTarget) => Availability;
  trainingLabels: Readonly<Record<string, string>>;
  optionBadges?: (option: Option) => readonly string[];
  formatIssue?: (message: string) => string;
  sectionLabel: (identity: CatalogIdentity, section: ArmySection) => string;
  sectionAllowances: (document: RosterDocument, release: RosterCommandContext, evaluation: Evaluation) => ReadonlyMap<string, SectionAllowance>;
  isMemberGroup: (node: CompositionNode) => boolean;
  usesPlatoonSupportLabel: (release: AppCatalogRelease, entryId: string) => boolean;
  exampleCommands?: (release: AppCatalogRelease, newId: () => string) => readonly RosterCommand[];
}
