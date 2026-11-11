# NORTHAG Soviet integration assessment

Date: 2026-11-10. Scope: assess adding the NORTHAG ruleset and its Soviet/Russian Armoured Battlegroup list. This document does not implement or release M14. No CENTAG, AirLand, hosting update or battle-state implementation is included.

Follow-up status (2026-11-10): source-baseline verification and Web decoupling have now been implemented. See [the verified baseline](northag-baseline.md) and [integration handoff](../ruleset-integration.md) for the current state. The architectural conflict descriptions and validation numbers below record the pre-change assessment; actual NORTHAG rules and catalog population remain future work.

## Conclusion

The existing architecture can support this work without replacing the domain engine or storage system. The main prerequisite is removing Classic-specific composition from the Web application, then implementing an independent NORTHAG module and catalog. Adding JSON to the current catalog index alone will fail: the loader, evaluator and several views currently require Classic.

Core already represents the essential identities, section hierarchy, purchase tree, stable member targets, opaque training tokens, option limits, non-entity purchases and partial evaluation. Real NORTHAG rules still require new enforcement and evidence. Existing synthetic NORTHAG tests demonstrate representation, not a playable ruleset.

## Evidence and scope of verification

Inspected the current core contracts/commands/evaluator, Classic schemas/rules, Web loader/editor/restore/transfer/printing, build configuration and release tests.

The local `references/NORTHAG/Battlegroup-NorthAG.pdf` opens without a password and contains 117 PDF pages. Its metadata dates to September 2020. The inspected printed pages match the 2020 reference package's chapter locations and the old wording targeted by official errata v9. This supports using the local book plus applicable v9 corrections as the working baseline; metadata is not a substitute for recording a source fingerprint and edition identity in a release manifest.

Selected pages were text-extracted for navigation. Printed pp.56, 69, 70, 72, 74 and 99, and errata PDF p.7, were also visually inspected. For those inspected book pages, the one-based PDF page is printed page + 1. The errata PDF has 12 pages and identifies itself as v9 for the 2020 printing, dated 9 May 2025. Other pages were not fully visually audited in this assessment. Inspection files are local under `.tmp/northag-assessment/`; original references remain unchanged.

Baseline verification:

- `npm test -- --reporter=dot`: 30 test files, 369 tests passed.
- `npm run typecheck`: passed.
- No build, browser workflow or NORTHAG runtime acceptance is claimed. There is no production NORTHAG module to exercise yet.

## 1. Capabilities that can be retained

| Existing capability | Evidence | NORTHAG use |
|---|---|---|
| Exact ruleset/catalog/revision identity, including `northag` | `packages/core/src/contracts/primitives.ts`, isolation tests | Independent data even for identical equipment names; no new ruleset ID mechanism needed |
| Separate section and purchase trees | `contracts/catalog.ts`, `contracts/roster.ts`, relation validation | Main Force contains Vanguard/Main Column; formations and attachments remain a different tree |
| Stable composition paths and attachment owner IDs | Composition and choice contracts; roster commands | Three independently configurable platoons, individual vehicle upgrades, safe copy/undo |
| Base formation prices and explicit option charges | `evaluation/evaluate.ts`, `evaluation/targets.ts` | Included models do not incur additional purchase costs; whole-company and per-target upgrades remain distinct |
| Group maximum, individual option maximum, prerequisites and exclusions | `optionGroupSchema`, `optionSchema`, generic evaluator | One-each menus and replacement prerequisites can reuse algorithms |
| Formation/member resource scopes | Resource contracts and allocator | Per-platoon attachment allowances can be expressed without Classic pool identities |
| Known/unknown/not-applicable values | `contracts/values.ts` | Explicit zero BR, incomplete transcription, removed combat fields |
| Opaque training tokens and separate numeric BR | Entry/evaluated-composition contracts | NORTHAG c/p/e does not require converting Classic i/r/v/e |
| No-entity purchases | `compositionStateSchema`, `unitEntryKindSchema` | Requests, tactical purchases and appropriate off-table support |
| Settings, revisions, save queue, backups | Roster/storage/transfer contracts | Optional-rule enablement and additional request selections can fit the current roster document |
| Common evaluation/availability/statistics output | `contracts/evaluation.ts` | Shared totals, Problems, Officers and Scouts UI with NORTHAG-owned calculations |

No database or JSON envelope migration is inherently necessary for the initial single-catalog NORTHAG release. Confirm this with mixed-library round-trip tests; new settings fields would require a separate compatibility decision. Do not alter Classic 1.0.0/1.1.0 releases or convert existing rosters.

## 2. Concrete integration conflicts and changes

### A. Runtime registry, release loading and creation — required

`apps/web/src/adapters/catalog/catalogLoader.ts` imports only the Classic index and schema, returns `ClassicCatalogRelease`, and accepts only `classic/1` and `classic/2` with two Classic rules revisions. A NORTHAG release currently fails lookup or compatibility/schema validation.

`RosterWorkspace.tsx` loads `catalogIndex.releases[0]`, stores Classic releases, directly calls `evaluateClassicRoster`, and exposes disabled Classic-only ruleset/army selectors. Its heading and size choices are also fixed to Classic. `CatalogPanel.tsx` directly calls `getClassicEntryAvailability`.

Introduce a small explicit application registry for supported rulesets and releases, not a dynamic plugin platform. Route parsing, supported versions, concrete roster validation, evaluation, purchase availability, game sizes/settings and presentation through it. Reuse the core `RulesetModule` protocol and `RosterCommandContext`/`PurchaseAccess` where appropriate. The current protocol's `unknown` context is a seam, not a complete typed Web integration.

The creation flow should select ruleset → nation/list → an explicitly designated default release. Array order must not decide the ruleset. Existing rosters continue opening their exact release. Never weaken the Classic schema to accept NORTHAG.

### B. Actual NORTHAG constraints — required new rules

`packages/rulesets/classic-coldwar/src/rules.ts` owns Classic constraints, size guidance and counting. It explicitly rejects foreign contexts. Its Restricted caps for Platoon/Company/Battalion are 3/4/5; NORTHAG p.56 states 2/3/4. Classic also has Squad size, its own support pools, PT-76 exclusion, TOC restrictions and company SAM logic. None of those facts should become NORTHAG defaults.

Add independent NORTHAG schemas, rules, training and release validation under `packages/rulesets/northag/`. Define verified section/entry min/max restrictions, Restricted upgrade events, company-local attachment counts, cross-selection upgrade limits, optional requests and statistics. General pricing can call core; NORTHAG checks must not call the Classic evaluator.

The core section and entry schemas do not currently contain generic purchase min/max rule records. `QuantityLimit` provides maxima for options, not a universal minimum-selection engine. Add a small NORTHAG-owned constraint schema/evaluator first. Promote reusable mechanisms into core only when actual examples justify it; do not add NORTHAG thresholds to core or build a general rule DSL.

Missing required sections and excess purchases should produce issues on an editable draft. They must not prevent creating an empty roster or deleting a required formation. Invalid identities/targets/purchase contexts remain structural errors.

### C. Nested sections and allowance display — required

`RosterTree.tsx` maps sections as a flat list and filters out sections without top-level purchasable entries. It does not render `parentSectionId`. Main Force would disappear, with Vanguard and Main Column presented as unrelated peers. `printProjection.ts` similarly flattens sections and removes those without direct purchases.

Render the section hierarchy recursively, preserve grouping-only parents, and offer purchase actions only on directly purchasable sections. Aggregate descendant counts without counting purchases twice.

`sectionAllowances.ts` derives display limits from army-wide resource grants and direct section purchases. That is not sufficient for NORTHAG's mandatory Forward Screen, exactly-one Vanguard and entry-local limits. Feed section constraint summaries from the same ruleset evaluation/projection used for issues. Do not invent Classic-style support grants just to populate the existing counters.

### D. Formations, attachments and options — reuse with explicit modeling

The existing anchored attachment model is a good fit for Soviet motor-rifle companies. Each of the three fixed platoons needs a stable node ID and its own two-team allowance. The same weapon team may occur in different platoons, but not twice in one platoon. Existing formation-member resources and scoped checks can express this without a new purchase tree.

The generic option scopes are selection, parent-formation, section and army; there is no implicit per-member option-count scope. Do not put all three platoons in one selection-wide two-choice group. Use anchored attachments/member resources, separate explicit groups, or a narrowly justified shared extension.

The Tactical Command Centre's extra units should preferably be attachments: they have their own prices, BR, composition and, for the FAC, vehicle options. Enforce one of each attachment locally. Reusing the generic one-each option limits is also possible if nested configuration is preserved, but four independent top-level entries would lose the parent requirement.

`RosterTree.tsx` and print projections recognize fixed child nodes specifically as configurable `role === 'platoon'`; support labels also inspect `platoon-support-slots`. Generalize presentation only as needed for actual NORTHAG formations. Do not inherit Classic resource names or four-choice limits.

Tank-company KMT upgrades target one tank. A single quantity-10 leaf does not identify one vehicle: represent separately addressable upgrade slots rather than applying a tag/replacement to all ten. Preserve whole-company conversion prices as one charge where the book prints a total.

`OptionEditor.tsx` uses one checkbox per option, with member target controls. Repeated timed strikes and paid requests are better represented as repeated purchases with separate IDs (or an explicit quantity UI issuing those commands), not repeated identical checkbox choices.

### E. Unit details, training and printing — required for feature parity

`unitData.ts` imports and parses Classic vehicle/weapon JSON globally. `UnitDataPanel.tsx`, `PrintUnitDataAppendix.tsx` and `printProjection.ts` use Classic card/weapon types; print training labels come from `classicTrainingLevelLabels`. Existing identity guards prevent silently borrowing Classic cards, but NORTHAG would display missing data or incomplete labels.

Use independent NORTHAG profiles, weapons, bindings and presentation. The visually inspected p.99 table has five range bands (0–20, 20–30, 30–40, 40–50, 50–70); Classic's weapon reference schema requires eight. Relabeling Classic columns cannot work. NORTHAG armor/HE/AA and aircraft field semantics also need their own schemas. Handle removed fields as not applicable, not zero. Keep range-specific no-effect markers and footnotes distinct from missing data.

Share layout and aggregation code where useful; dispatch field layouts by ruleset. Bind reference supplements to exact NORTHAG catalog identities. Show c/p/e labels in editor and print, and derive Officer/Scout counts in the NORTHAG module with explicit counting units and weights. Do not copy Classic's profile-counting loop, which only handles Scout/Scout2 and may count a different object.

Static support purchases may still need weapon/loadout reference information even when no deployed-model composition is produced. Do not add aircraft/models to the initial army just to force the current composition-only appendix to display a reference.

### F. Restore, transfer and release assets — required integration work

Storage itself is mostly generic. Restore and import depend on the current Classic loader; `parseImportFile.ts` also types ready releases as Classic. Extend those paths through the registry and preserve unsupported-original recovery, exact-version matching, digest failures, transactionality and conflict protection. Apply concrete roster/settings validation consistently; generic structural validation alone cannot establish a supported NORTHAG game size.

`apps/web/vite.config.ts` exposes only `packages/catalogs/classic-coldwar/public`. Add an explicit build asset assembly step or equivalent allowlisted copying for independent catalogs and one application index. Do not make the repository or `references/` a public directory.

The root `typecheck` command enumerates only core, Classic and Web. Add NORTHAG; npm workspace discovery and Vitest's ruleset glob already accommodate another package. Web dependencies and the lockfile will also need updating.

`tools/data-import/catalog-release.test.ts` assumes every indexed release is Classic and validates Classic fixture hashes/counts. Preserve those tests and add independent NORTHAG source/release gates. `tests/e2e/catalog-assets.spec.ts` assumes the first release has 151 entries; change the test to select by identity and verify all published releases instead of relying on array order.

## 3. Source findings that affect implementation

| Finding | Source and verification | Consequence |
|---|---|---|
| Four top-level categories; Main Force contains Vanguard and Main Column | Book p.56 visually checked | Preserve hierarchy instead of five flat categories |
| At least one Forward Screen choice; exactly one Soviet Vanguard | pp.56, 69–70 visually checked | Independent minimum/exact-count checks; Main Column may be empty |
| NORTHAG Restricted caps are 2/3/4 | p.56 visually checked | Different from Classic's 3/4/5 at corresponding sizes |
| Vanguard motor-rifle company contains three fixed platoons, each allowing up to two distinct weapon teams | p.70 visually checked | Anchor local menus/counts to each platoon |
| p.72 one-each correction targets Tactical Command Centre extra units | Book p.72 and errata PDF p.7 visually checked | FAC, EW Team, Supply Truck and Ambulance may each be added once; these are ordinary attachments, not reinforcement requests |
| Forward Screen FOO loses the +5 Artillery Spotter option | Book p.69 and errata PDF p.7 visually checked | Remove only the matched purchase-context option |
| Enabled Russian requests include one free request; total caps 3/4/5; each additional request costs 30 Points / 0 BR | p.74 visually checked; free cost explained in p.57 text | Derived free allowance plus paid non-entity selections; no future-arrival BR in initial totals |
| NORTHAG cannon/missile table has five distance bands | p.99 visually checked | Independent schema/presentation; Classic's eight-band table cannot be reused as data |

The reference package's `02_NORTHAG_Soviet_Army_List.md` calls the p.72 menu a reinforcement upgrade group and its navigation index lists its children beside Main Column entries. Those descriptions are not purchase-context authority. The local page layout and errata resolve the target and four candidates.

The package remains preparation material:

- `data/manifest.json` still says the book was not provided and the cards are unread/encrypted, while the local full book and unlocked card PDF exist. Do not propagate those stale blockers into a release manifest.
- `northag-2020-rules-partial.json` still contains inconsistent flat/nested section representations, singular/plural request IDs and ambiguous null limits.
- Numeric calibration rows still carry `web_transcription_crosscheck_required`. This assessment verifies selected original pages, not every row/option/profile in the package.
- The third-party 499-point example's visible BR sums to 58 rather than the stated 66. It is not a golden legal-roster fixture.
- Official book/errata and HWC v6 community cards remain different sources. A card grants no purchase eligibility. Do not merge 2025 Omnibus data into this baseline.

Before release, record source hashes and exact page mappings, reconcile each errata target, transcribe every included purchase/option, and explicitly mark unverified combat fields. Preserve the reference package read-only.

## 4. Remaining semantic checks

These do not block starting the application registry work, but should be resolved before declaring the Soviet list fully supported:

1. Verify all pp.69–75 purchases/options and pp.94–100 profile/weapon rows visually, not by OCR alone. Some local extracted text has broken font mappings, especially the motor-rifle blocks.
2. Resolve transport grouping for attached infantry weapons teams and the scope of “replace all BTRs” in p.70/p.71 conversions. Explicitly document how added transports are affected and charged; do not import Classic's prior user clarification into NORTHAG automatically.
3. Define Scout/Officer counting objects from NORTHAG text and errata. Mixed infantry/vehicle patrols must not inherit one special rule onto every composition node and double count. Support Scout2/Scout3 as appropriate.
4. Distinguish a purchase prerequisite from “requires a spotter to use” and similar battlefield conditions. Do not make every usage condition a hard roster error without source support.
5. Review each tactical/fire-support choice and aircraft loadout, including known-zero BR and count limits. The Soviet Gunship counter result and p.74–75 reinforcement categories are not normal pregame purchases.
6. Specify static reinforcement UX: enable/disable, free and paid counts, size-change violations and handling paid requests when the rule is disabled. Preserve editable choices; report issues rather than silently deleting purchases. No roll, arrival, expenditure or dynamic BR subsystem is required.

## 5. Suggested implementation order and acceptance

1. Establish the 2020 + v9 source baseline and real manual fixtures; maintain separate constraints/ambiguities/profile coverage. The current user choice makes NORTHAG the next ruleset; AirLand is not a technical prerequisite.
2. Extract the small Web registry/shared release context while running only Classic. Retain existing exact releases, totals, save/restore, transfer and printing behavior.
3. Add NORTHAG schemas, independent Soviet catalog and evaluator with verified purchase contexts. Implement nested section rendering and ruleset settings alongside this.
4. Add NORTHAG unit-data views, printing, static reinforcement controls and multi-catalog asset assembly. Full feature acceptance includes these even if an earlier internal milestone only evaluates purchases.
5. Run isolated NORTHAG, mixed-library and unchanged Classic acceptance. Publishing is a separate authorized action.

Minimum meaningful acceptance cases:

- Empty/incomplete drafts remain editable; missing Forward Screen/Vanguard and two Vanguards produce the expected issues.
- Same-name Tank Companies in Vanguard/Main Column have distinct identities and limits.
- Three motor-rifle platoons have independent two-team pools; duplicates within one platoon fail, the same team in different platoons does not.
- TCC accepts all four different attachments together, rejects duplicate instances as a game violation, and does not offer those attachments without their parent context. FAC options retain their own prices/BR.
- Tank conversion is charged once; one KMT upgrade affects one identified tank; copied/reordered formations retain targets.
- Restricted limits use NORTHAG's size table and count restricted upgrades at the declared unit/event scope.
- Optional requests derive one free request, count paid requests correctly against the total cap, and never add unknown future units or BR.
- No-entity tactical/support purchases contribute their actual Points and known-zero BR. Repeated timed strikes obey their own limits.
- c/p/e labels, independent weapon columns, Officer/Scout totals and print sections agree with the same evaluation.
- Save/reopen/import/export a library containing both rulesets; unsupported revisions remain recoverable and foreign references reject.
- NORTHAG data loads without Classic game data; assets include only allowlisted releases; existing Classic regressions pass.

A small independently hand-added starting fixture can use p.69 Armoured Car Patrol (24/2) plus p.70 Vanguard Tank Company (180/20): 204 Points / 22 BR before options. Those two values were visually checked here. This is a useful arithmetic/required-section fixture, not proof of exhaustive legality or full rule coverage; add option, attachment and request variants after their source checks.
