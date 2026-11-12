# Battlegroup Army Builder — Technical Plan

Updated: 2026-11-10. This is the product and technology plan. The [architecture](architecture.md) defines domain boundaries, [contracts](contracts/domain.md) describe current APIs, and the [module plan](implementation_modules.md) records progress. Superseded flat-schema and calculate/validate examples have been consolidated into those maintained specifications.

## 1. Product goal

Build a free community browser roster editor for Battlegroup cold-war tabletop games. Players choose a ruleset, nation and list; buy formations and equipment; inspect Points, Battle Rating (BR), restrictions and sources; save, restore, transfer and print their rosters.

The initial success criterion is a practical Classic Soviet Armoured Division V4.1 workflow: create → purchase/configure → understand issues → reopen saved choices → export or print for play. My Rosters, the editor, unit details and printing form the initial product. Low running cost, data accuracy, maintainability and later ruleset expansion take priority over accounts, cloud sync, a public library or battle simulation.

| Ruleset | Role |
|---|---|
| Unofficial Battlegroup: Cold War | Initial ruleset; RichardC's unofficial cold-war adaptation of Battlegroup |
| AirLand Battlegroup | Independent later ruleset; verify list-building differences from Classic |
| Battlegroup NORTHAG | Independent ruleset with materially different core assumptions |
| Battlegroup CENTAG | NORTHAG expansion, not a fourth engine |

All Classic, AirLand and NORTHAG game data is completely isolated, including identical units, weapons, names, attributes, costs and options. Shared software does not mean shared game records. Start with Classic; another ruleset's incomplete sources do not block its release. The default later order is AirLand then NORTHAG unless the user reprioritizes it.

## 2. Technology decisions

Use one monorepo, one React application and independent ruleset/data modules. Each roster belongs to one explicit ruleset. Do not create a separate NORTHAG React project or an early generic plugin platform.

| Area | Choice |
|---|---|
| UI / language / build | React / TypeScript / Vite |
| Packages | npm workspaces and package-lock.json |
| Runtime data | Versioned JSON; CSV/OCR are preparation tools |
| Boundary validation | Zod |
| Local persistence | IndexedDB with Dexie |
| UI state | React state; consider additional libraries only for demonstrated needs |
| Unit / browser checks | Vitest / Playwright |
| Localization | Independent English dictionary with a later translation entry point |
| PDF | Browser print styles, without a dedicated PDF engine |
| Initial hosting | Existing Sites test deployment |
| Later hosting candidates | Cloudflare Workers Static Assets or GitHub Pages |

There is no required business backend. Keep hosting-specific configuration outside domain code. Do not introduce Sites-only identity, databases or connectors merely to host the app.

## 3. Software organization

Web composes concrete rulesets; rulesets depend on core. Core and rulesets remain pure TypeScript without React, browser storage, filesystem, network, clock or random-ID dependencies. Web supplies infrastructure, IDs and editing sessions.

- `apps/web/`: pages, sessions, presentation, catalog/storage adapters, transfer and printing.
- `packages/core/`: contracts, structural validation, commands and generic evaluation.
- `packages/rulesets/<ruleset>/`: concrete schemas, eligibility, game checks and statistics.
- `packages/catalogs/<ruleset>/`: independently maintained runtime releases and reference supplements.
- `tests/fixtures/`: hand-verified input and expected results, never runtime catalog authority.
- `tools/data-import/`: preparation and release checks.
- `docs/`: maintained English specifications and rule evidence.
- `references/` and `.tmp/`: local sources/evidence excluded from Git and publication.

Create packages only when needed. Keep shared UI in Web until actual reuse justifies extraction. See [architecture](architecture.md) for the detailed structure.

## 4. Data model

### 4.1 Distinct entities

Separate the combat profile (a T-72's attributes), purchase entry (a list-specific tank platoon) and selection (the player's particular platoon). One entry can contain multiple roles, profiles, squads, platoons and paid attachments. A formation's printed price/BR is not inferred by adding individually purchased children.

ArmyList and ArmySection express the list's section tree. Parent selection and member paths express purchased composition. An expanded model list supports statistics/printing without replacing purchase ownership.

### 4.2 Choices and identity

Persist format version, roster ID/name, exact catalog reference, army list, explicit budget/size/scenario/optional rules, stable selection IDs/parents, option choices and notes. Derive rather than store authoritative totals and expanded combat data.

Stable member paths and explicit attachment owners identify option targets. Group, per-option and per-target limits are distinct. Charge once, per target or through an explicitly supported algorithm. Replacement, removal, training changes, prerequisites, mutual exclusion, resource effects and negative/zero differences must be explicit.

### 4.3 Ruleset isolation

Classic, AirLand and NORTHAG each own complete records and references. For example, their T-72 profiles have unrelated full identities even if localId/name/stats match. Prohibit cross-ruleset inheritance, aliases, runtime overlays and automatic conversion. Loading one data set must not require another. Apply corrections separately after verifying each source. CENTAG may extend only a declared compatible NORTHAG version set.

### 4.4 Value and composition states

Known zero, unknown and not applicable are different. Limits additionally distinguish finite and unlimited. Explicitly no-entities support/request purchases differ from pending composition. Numeric BR and training are separate; Classic i/r/v/e and NORTHAG c/p/e are independent definitions. Budget does not silently determine game size.

## 5. Rules and validation

Use supported declarative configuration plus generic tools and tested ruleset-specific functions. Implement real sample needs before extracting abstractions. Do not execute JavaScript from JSON or build an unrestricted rules DSL.

Potential rule families include minima/maxima, prerequisites, exclusions, option counts, ratios, shared resources, budget, conditional eligibility, tiered costs and uniqueness. Each implemented rule declares scope, counted object, applicable version, severity and source. A list of possible families is not a claim that every family is implemented.

One evaluation resolves exact context, checks relationships, expands actual composition, creates attributed charges, allocates resources and runs concrete rules. Totals, statistics, problems and coverage share that input/version snapshot. Errors represent confirmed mandatory violations; warnings/info carry their appropriate meaning. Coverage is independent: an error-free partial result is not a full legality claim. Label incomplete totals as known subtotals.

Allow rule-breaking drafts, including over-budget purchases, and update Problems after each edit. Structural corruption remains blocked. Do not display speculative purchase-warning banners.

### 5.1 Classic evidence

Representative cases include BMP platoons/companies and local supports (Soviet pp.2–5), tank formations/upgrades (pp.6–7), Restricted/Unique (Draft 6 pp.31–32), defences (Soviet p.9), PT-76 restrictions (p.10) and off-table support (pp.13–15).

User clarifications establish the T-72 company typo correction, independent army/platoon support pools, recursive all-BMP targets, the second Fire Support slot, upgrade-event Restricted/Unique counting, company-local SAM restrictions, PT-76 exclusions and unchanged BR for Points-only options. Preserve them in the [clarification register](data/classic-ambiguities.md), not as unresolved implementation blockers.

### 5.2 AirLand requirements to verify

Verify reconnaissance as frontline choices, revised support categories, compulsory formation mechanisms, tiered artillery pricing, speculative equipment and experimental versus confirmed rules. Author proposals are not enforced before their source status is established. Reuse algorithms only after comparing real samples; do not inherit Classic data.

### 5.3 NORTHAG requirements to verify

Keep nested sections separate from purchases; same-name entries in different sections retain independent identities. Verify explicit size, training, Scout/statistics, one-each limits, non-entity fire support and static reinforcement requests. Record edition, errata and compatibility; do not mix 2020, Omnibus or community-card material automatically. See [NORTHAG preparation](data/northag-notes.md). Battle rolls, arrival and dynamic BR remain out of scope.

## 6. Version policy

Manage database schema, roster and file formats, catalog schema, rules revision, catalog revision, source edition/printing and applied errata separately. Published catalogs are immutable; revisions produce new releases. An exact original catalog plus compatible rule implementation is required to reproduce historical behavior.

Format migration must not change rules. A future game-data upgrade is a deliberate user operation with before/after Points, BR and option differences, unmapped-item reporting and an upgraded copy. Preserve unsupported originals for recovery rather than guessing the latest version. Current releases 1.0.0 and 1.1.0 remain separately loadable.

## 7. User experience

My Rosters is the home page. Show only published usable rulesets/lists. Creation records budget, game size and relevant scenario settings explicitly. Later rulesets are not presented as already supported.

Use two columns on desktop: left roster with section add buttons and per-purchase deletion; right candidate list or selected-unit details/upgrades. Fixed company platoons and attachments stay in the left hierarchy. On small screens switch Roster / Actions. Provide undo/redo, keyboard/touch access, search, source details and current save state.

Hide debug examples and internal implementation records from normal pages. `?debug=1` enables the verified example and catalog diagnostics without changing saved choices. Show the Problems list rather than rule-coverage declarations. Printing expands every purchased member regardless of editor folding and can optionally append vehicle/weapon data.

## 8. Sources and maintenance

Local Classic material is under `references/Coldwar/`: the base rulebook, Cold War Draft 6, Soviet V4.1 list, New Orders / Special Rules and Soviet AFV cards. NORTHAG material is under `references/NORTHAG/`, including a local rulebook and the Soviet reference package. File presence does not establish printing, compatibility or verified values.

Preserve source identity, PDF page versus printed page, review status and errata status. Text extraction locates passages; numbers, columns and suspected errors require original-page review. Record corrections without changing sources.

Preparation follows collection → transcription → source review/clarification → formal JSON → schema/relation checks → independent sample comparison → release. JSON is the sole runtime data authority. Validate uniqueness, references, scopes, costs, targets and release coverage. Use issue reports and reviewed changes for community maintenance; data fixes should not require pricing changes in React components.

## 9. Hosting

Sites is the initial test host. The main Git checkout remains the application source of truth, and publishing is a separate step. The [deployment guide](deployment.md) links to the test site and explains how to publish updates and manage access.

Keep a normal Vite static build and explicit release assets. A hosting-specific source snapshot must trace to the main revision rather than become an independent business-code branch. Verify asset bases, direct navigation, refresh, indexed catalog requests and printing on each host. Hash routing does not eliminate asset-path requirements.

Cloudflare Workers Static Assets and GitHub Pages remain project-selected candidates. Recheck their current limits/workflows when actually migrating; this document is not a current quota or pricing comparison. Keep static hosting and any future backend execution requirements distinct.

IndexedDB is origin-bound. Moving protocol, host or port requires JSON backup/import to transfer rosters. Preserve database name/schema compatibility when keeping the same origin. Publish only application assets and selected released data, never references, fixtures or .tmp.

## 10. Delivery approach

1. Verify Classic sources, limits, ambiguities and independent hand accounts.
2. Establish contracts, releases, commands, evaluation and concrete rules.
3. Deliver the Classic browser workflow, local restore, transfer and printing.
4. Test on Sites, fix real feedback and choose longer-term hosting separately.
5. Add AirLand and NORTHAG through independent source audits, samples, data and rule modules; add compatible CENTAG material after NORTHAG.
6. Consider more nations, richer source indexes, localization, sharing or PWA only as separate scoped work.

The [module plan](implementation_modules.md) defines dependencies and acceptance boundaries. Do not make Classic depend on three complete rulebooks or a universal schema.

## 11. Verification

Use independent hand-calculated rosters, not expected values fed back into engine outputs. Cover nested fixed-price members, whole/per-target upgrades, zero/negative differences, support pools, Restricted/Unique and conditional eligibility. Test same-name cross-ruleset isolation, independent loading and unchanged unrelated records.

Separate invalid structure, confirmed rule violations, missing inputs and unknown costs. Verify exact-version restore and unsupported-original recovery. Exercise actual browser reopen, rapid saves, stale acknowledgements, conflicts, failed-save export and backup round trips. Validate small-screen interaction and complete long-roster/PDF output, not merely compilation.

Run applicable data, domain, browser and build checks for releases. Keep local tests, actual publication and hosted verification distinct. Existing deployment does not prove subsequently added features are online.

## 12. Distribution

The application's MIT code license is separate from game-data redistribution permission. Maintain the unofficial community-tool notice. Classic/AirLand adaptations and commercial NORTHAG/CENTAG source material require their own redistribution basis; do not infer permission from a publicly accessible PDF.

## 13. Decisions already made

One static React/TypeScript monorepo; pure shared code; independent rulesets and game records; Classic Soviet V4.1 first; CENTAG under NORTHAG; exact versions; local persistence without signup; browser PDF; Sites testing with portable hosting; references local and documentation in docs.

## 14. Open work

Confirm future ruleset restrictions, source editions and release permissions; establish independently checked examples; choose later hosting/domain and public data scope. Custom units, speculative equipment policy, same-ruleset house rules, cloud features and additional UI libraries require separate decisions. Resolved Classic clarifications are not open questions.

## 15. Reference entry points

- [Cold War / WARPAC lists](https://coldwarhot.blogspot.com/p/my-cold-war-to.html), [NATO lists](https://coldwarhot.blogspot.com/p/us-army-in-europe-to.html), [rules and aircraft material](https://coldwarhot.blogspot.com/p/scenarios.html).
- [AirLand list-structure article](https://coldwarhot.blogspot.com/2026/08/prototype-airland-battlegroup-army-list.html).
- [NORTHAG product page](https://www.battlegroup.uk/products/battlegroup-northag-ruleset), [CENTAG product page](https://www.battlegroup.uk/products/battlegroup-centag-supplement-book).
- [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Zod](https://zod.dev/), [Dexie](https://dexie.org/).
- [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Dexie schema design](https://dexie.org/docs/Tutorial/Design), [browser storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [GitHub Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

External links are source-navigation references retained from the design, not claims that their current contents were re-audited during documentation cleanup.
