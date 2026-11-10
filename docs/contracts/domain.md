# Domain Contracts

Updated: 2026-11-10. This guide consolidates the stable domain semantics originally established in M03 and subsequently implemented by commands, evaluation and Classic rules. Historical M03 statements that no engine exists are not current API limitations. See the [architecture](../architecture.md) and [development guide](../development.md).

## 1. Public entry points

### Core (`@battlegroup/core`)

| Area | Exports / responsibility |
|---|---|
| Identity | `localIdSchema`, `rulesetIds`, `catalogIdentitySchema`, `entryReferenceSchema`, `sha256Schema` |
| Values | `trackedValueSchema`, `trackedTokenSchema`, `quantityLimitSchema`, `costDeltaSchema` and helpers; preserve zero/negative deltas and explicit unknown/not-applicable states |
| Sources | `sourceDocumentSchema`, `sourceReferenceSchema`, `errataRecordSchema`; authority/review/errata independent, PDF/printed pages distinct |
| Versioning | `CATALOG_SCHEMA_VERSION = 'catalog-shell/1'`, `ROSTER_FORMAT_VERSION = 'roster/1'`, `catalogManifestSchema`, `manifestVersionIdentity()` |
| Catalog shell | Sections, army lists, UnitEntry, composition, profiles' identity fields, options and resource grants/consumptions |
| Roster | `rosterSettingsSchema`, `optionChoiceSchema`, `rosterSelectionSchema`, `rosterDocumentSchema` |
| Result contracts | `Evaluation`, `Availability`, `CompatibilityResult`, `RulesetModule`; this contracts file defines protocols, while evaluation/roster modules implement operations |
| Integrity | `validateCatalogRelations`, `validateRosterRelations`, `resolveCompositionPath`, `resolveRosterMemberPath`, `resolveAttachmentMemberPath` |
| Commands | `createRosterDocument`, `executeRosterCommands`, command/result types and command-document validation |
| Evaluation | `evaluateRoster`, `resolveChoiceTargets`, `allocateResources` |
| Files | Transfer versions/schemas, `TRANSFER_LIMITS`, `jsonDepth` and file types; see [import/export](import-export.md) |

Catalog profile identity parsing accepts extensible profiles but core retains identity fields, not concrete combat attributes. Use the appropriate ruleset schema when retaining/validating those attributes.

### Classic (`@battlegroup/classic-coldwar`)

- Training: `classicTrainingLevelSchema`, labels and `isClassicTrainingLevel`; known values i/r/v/e, including Elite.
- Combat: `classicUnitProfileSchema`, tracked stats and `unverifiedStats(reason)`.
- Catalog/document: `classicCatalogShellSchema`, `classicRosterDocumentSchema`, `classicGameSizeSchema` and `classicCatalogReleaseSchema`.
- Rules: `evaluateClassicRoster`, `getClassicEntryAvailability`, `createClassicRuleset`.
- References: `classicCombatReferenceSchema`, `findClassicCombatCard`, `classicWeaponReferenceSchema`, `findClassicWeaponBinding` and their types.
- Descriptor: `classicColdWarRuleset`; its status is not a substitute for explicit catalog/rule coverage.

Classic schemas require the correct ruleset identity, training tokens and game-size enum. Core relation validation separately checks exact revisions and references. No React/DOM dependency is required to import these packages.

## 2. Identity and structure

A record's identity is ruleset + catalog + exact revision + localId. A player selection has independent selectionId. Repeated purchases of one entry are distinct instances. Reject cross-ruleset/revision references even when a matching localId/name exists. If roster and catalog identities differ, stop catalog-dependent relation checks. Public member resolvers also validate identity rather than trusting prior checks.

ArmyStructure stores flat section nodes with parent pointers and validates cycles/orphans. The purchase tree uses parentSelectionId. A top-level purchase declares an allowed directly purchasable section; children inherit it and cannot redeclare it. Concrete attachment eligibility and numeric limits belong to commands/rules, not generic source-free inference.

Fixed composition nodes are not paid selections and contain no independent prices. Paid attachments have their own selectionId, parent and optional targetMemberPath. ChargeLine.attributionKey prevents duplicate charging of one attribution.

## 3. Stable option targets

- `whole-selection`: applies to the whole purchase according to the declared option.
- `member-path`: resolves inside that purchase's static composition.
- `attachment-member`: carries ownerSelectionId + nodePath relative to the explicit attachment's root.

Identical attachments, duplicate member names and purchase reordering must not retarget a choice. The attachment owner must exist, have matching identity and be a descendant of the choosing purchase. Only scope-selector options can address attachment members; member-slots options remain confined to their declared static slots.

Live scope selectors rebuild the target set after composition/attachment changes. all-BMP includes qualifying fixed and paid-attachment transports in scope, each once. Target existence alone does not prove a manually supplied list is the complete all set.

## 4. Options, costs and resources

OptionGroup.scope is selection / parent-formation / section / army. Group selectionLimit, individual ownLimit and target quantity are separate. one each means a group limit plus each option's ownLimit=1, not a redundant special flag. Charge once or per-target as declared. Points and BR deltas are independent, including known zero and negative values. requires and mutuallyExclusiveWith reference choices within their declared group and are evaluated by the operation/evaluation layers.

Resources use ruleset-defined resourceKind values. Classic's army-support-choice and platoon-support-slots are data declarations, not universal core constants. Grants can be army, parent-formation or formation-member scoped; included company platoons get precise memberPath local grants without duplicate army grants. Consumers may declare eligible categories. There is no universal core support threshold.

Known/unknown/not_applicable require explicit states/reasons; quantity limits also distinguish unlimited. Budget and game size are independent. UnitEntry.baseTraining is a tracked token in purchase context; omission is not an invented default. Training effects and numeric BR are separate, and identical tokens in another ruleset do not share a game record.

The second Fire Support Section is an independent context entry with real price/composition and one local slot. For the BMP-2 company platoon, the first Section is 40 Points / 1 BR, the second 35 / 1, each with its own transport. Do not generate hidden members from names or empty effects.

## 5. Validation responsibilities

| Check | Layer | Input / result |
|---|---|---|
| Field shapes, strict keys, discriminated states, literal format versions, positive integer quantities/budget, nonnegative base price, hashes and section declaration shape | Zod | `.safeParse` → schema issues |
| Duplicate entry/profile/group/option/section/list/node/selection IDs | Relations | Parsed explicit catalog/roster → `IntegrityIssue[]` with stable checkId/path/message |
| Section cycles/orphans, entry/list ownership, group attachment and source declarations | Catalog relations | `validateCatalogRelations(catalog)` |
| Slot paths, selector profile targets, replacement/addition references, prerequisites/mutex references and formation-member grants | Catalog relations | Per entry/group/option checks |
| Exact selection identity, existing entries/parents, direct section, cycles, member anchors and explicit attachment ownership | Roster relations | `validateRosterRelations(roster, catalog)` |
| Source references and applied-errata targets | Catalog relations | Declared source/target existence, not visual verification |
| Atomic edits, context-valid destinations, copying/remapping and invalidation notices | Commands | Caller-provided IDs/revision → success or rejected batch |
| Derived composition, cost lines/totals, live targets, scoped limits/resources | Generic evaluation | Parsed/validated explicit context → one Evaluation |
| Confirmed Classic game restrictions/statistics | Classic rules | Generic snapshot + exact ruleset context |

A game-rule violation can be a structurally valid document. Budget, duplicate local support, exhausted grants or PT-76 exclusions do not become schema errors merely because they are illegal choices. Error message prose is not a stable API; diagnostic IDs and structured locations are.

## 6. Evaluation and session identity

RosterDocument.revision identifies the current edited input. Evaluation.identity.inputRevision copies it; consumers reject old results. Catalog revision and database saveRevision are separate. The evaluation also stamps full catalog identity and schema/rules/catalog versions.

Evaluation contains composition, attributed charges, independent measure completeness, resources/statistics, issues and coverage. Availability distinguishes allowed / allowed-with-issues / blocked / unknown. Confirmed game violations remain draftable; impossible references/targets are blocked. Coverage is independent of issue severity. A known subtotal is never a final total, and absence of errors under partial coverage does not prove full legality.

Commands do not generate UUIDs/time internally. Web owns session history and at most 50 undo/redo snapshots. Restoring history creates a new edit revision. Storage serializes/coalesces writes and uses a separate transactionally checked concurrency revision.

## 7. Independent fixture coverage

`packages/core/src/samples/classicM01Catalog.ts` and `classicM01Rosters.ts` are contract-test data, not runtime releases. All 23 cases are structurally representable, including those with expected game violations.

| Fixtures | Representation exercised |
|---|---|
| B01 | Multiple top-level sections, attachments, known-zero BR, separate support pools and budget/size |
| B02–B04 | Structurally valid local duplicate, over-budget and missing-grant variants |
| L01–L02 | Whole/per-member charging, prerequisites, training effects and explicit BR changes |
| L03–L05 | Independent versus company context prices; anchored included platoons; separate local limits |
| L06–L08 | Live per-target upgrade, free replacement and −5 Points / −1 BR delta |
| L09–L10 | No-entities purchase, ten-member company and per-vehicle upgrade with unchanged BR |
| S01–S02 | Independent local/army 4/4 pools and a fifth army support |
| F01–F03 | Ten fixed plus two attachment transports; separately addressable Sections and local slot boundaries |
| F04–F07 | PT-76 exclusion triggers for platoon/company/individual tank and nested transport |

BMP-1 independent-platoon versus company-platoon supports have different IDs and source contexts, including AGL 18 versus 35. Do not merge same-name contexts.

Synthetic isolation catalogs deliberately reuse t72a/shared-t72-platoon names, IDs, attributes and example costs. Each loads alone; foreign full references reject rather than borrow local records; a same-name NORTHAG-only purchase cannot be resolved in Classic. NORTHAG synthetic sections, same-name entries, one-each options and no-entity requests test contract expressiveness only, without unverified real thresholds.

## 8. Dependencies and remaining boundaries

Core's only runtime dependency is Zod. A ruleset importing Zod declares it directly. Packages remain side-effect-free and importable in Node; core cannot depend on React, browser storage or concrete rulesets. The core/samples subpath is for tests and is not the production catalog index.

Source relation checks prove references exist, not that PDF values/pages were reviewed. Release hashing/compatibility belongs to catalog loading. Combat references do not affect pricing. Unsupported formats/catalogs remain recoverable under [transfer contracts](import-export.md); a general game-data upgrader and battle-state engine are not implemented.
## Shared summary statistics

RosterStatistic reserves the common display IDs officers and scout-weight for
Officer and Scout totals. Each ruleset owns their calculation, including
weighted Scouts; this shares a result protocol, not game records or thresholds.
The UI labels the latter Scouts. Missing/unverified statistics display a dash,
while a confirmed zero stays zero. The editor and print sheet share the same
summary component and snapshot statistics.