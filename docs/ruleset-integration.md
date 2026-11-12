# Ruleset integration handoff

Updated: 2026-11-12. The application registers Classic and NORTHAG. The first NORTHAG release covers the 2020 Russian Armoured Battlegroup with the applicable v9 corrections and explicitly partial equipment and statistics coverage. See [NORTHAG release scope](data/northag-release.md).

## Read first

- [NORTHAG source baseline](data/northag-baseline.md): exact sources, reviewed pages, targeted errata, small hand calculations and open decisions NAG-01 through NAG-06.
- [Integration assessment](data/northag-integration-assessment.md): pre-change findings and remaining rules/data requirements. Its Web conflict descriptions describe the state before this refactor.
- [Domain contracts](contracts/domain.md): shared identities, validation, commands, versioning and evaluation output.

## Implemented seams

| Owner | Responsibility / extension point |
|---|---|
| `apps/web/src/rulesets/types.ts` | `AppCatalogRelease` shares the command context and coverage envelope. `RulesetRegistration` owns exact supported contracts, parsing, concrete document validation, evaluation, availability, explicit creation defaults and settings, training labels, section presentation, option badges and issue wording. |
| `apps/web/src/rulesets/registry.ts` | Explicit registry composition; duplicate IDs fail. `creationChoices` uses declared army defaults matched to supported indexed revisions, never `index.releases[0]`. Classic and NORTHAG are installed. |
| `apps/web/src/rulesets/classic/registration.ts` | All Classic parser/evaluator/settings/label behavior, plus the optional 398/23 debug example. Classic schemas and immutable releases are unchanged. |
| `apps/web/src/rulesets/presentationTypes.ts`, `presentation.ts` | Optional concrete unit-details/print-reference adapters. Common print summaries contain no concrete armor/weapon types. Appendix payloads are adapter-owned locally derived view data, never persisted or imported. Missing adapters show unavailable reference data; no Classic fallback. |
| `apps/web/src/rulesets/classic/` | Classic combat JSON imports, unit-card rendering, reference aggregation and print appendix live together here. |
| `apps/web/src/adapters/catalog/catalogLoader.ts` | Load by exact application-indexed identity, verify digest, parse with that ruleset, compare resulting identity/contract/rules revision. Unknown modules/contracts cannot fall back to Classic. Injectable loader/registry supports independent module tests. |
| `packages/catalogs/registry.ts` | Explicit list of independent public data roots/indexes and combined application index. A new root must be registered deliberately. |
| `tools/data-import/catalogAssets.ts`, `apps/web/vite.config.ts` | Dev serving and production emission use the same indexed asset map. Verify source ruleset, paths, duplicate assets and hashes. Emit only listed releases and combined index; never copy whole data/reference directories. Restart dev after changing catalog registry/content. |
| `RosterForms.tsx`, `RosterWorkspace.tsx`, `CatalogPanel.tsx` | Ruleset/nation/list selectors, per-module sizes/settings/defaults and dispatch. Changing creation choice loads its exact catalog with stale-request protection; existing sessions retain their own catalogs. Structural/concrete boundary errors block edits; ordinary game-rule issues remain editable. |
| `restoreRoster.ts`, `parseImportFile.ts`, `applyImport.ts` | Common document/envelope boundaries, then loaded module's concrete validation. Existing unsupported-original preservation and copy/overwrite/save-conflict behavior remain. No storage/envelope migration. |
| `sectionTree.ts`, `RosterTree.tsx`, `printProjection.ts` | Recursive section hierarchy; grouping parents retained; add actions only on eligible directly purchasable sections; descendant selection counts without double counting. Print totals and composition still come from one frozen evaluation. |
| `tools/typecheck.mjs` | Checks core, every installed ruleset workspace with a package.json, then Web. No hardcoded Classic-only workspace list. |

`sectionAllowances` receives the current evaluation. Classic uses its resource-allocation projection. NORTHAG supplies its own Forward Screen minimum, Vanguard capacity, and included/paid request counts. The shared counter displays these values, while the ruleset evaluator enforces them.

Roster members and printed members now share a recursive projection of the evaluated composition. `memberPresentation(node, catalog)` owns each ruleset's visible member roles and labels. Return a label for formations, squads, teams or individual vehicles that should appear in the roster; returning null keeps that node's details within its nearest visible parent while still traversing its children. The older `isMemberGroup` callback remains a compatibility fallback for adapters without `memberPresentation`.

Member paths remain relative to the purchasing selection and retain every stable node ID, including omitted display wrappers. Purchased attachments match their entire `targetMemberPath`. Each adapter should expose its declared member attachment destinations so users can add attachments at those locations. Existing attachments without a displayed destination remain accessible under the purchasing selection. Added, removed and replaced members follow the current evaluation. Removing the currently selected member returns focus to the nearest remaining visible ancestor.

Member-slot options appear at the deepest visible owner of each target. Editing a choice preserves targets in sibling members. An adapter can explicitly return `single` from `memberChoiceMode(option)` to move an assignment instead; the UI names the existing assignment and explains that selecting another member moves it. The shared default is `multiple`: target cardinality is independent of charge mode. Classic declares single-target behavior for its existing once-priced member options. Whole-selection options stay on the purchase, and scope selectors stay at their declared member scope or nearest visible ancestor. Shared group/option limits continue to be evaluated at the original scope. Member rows display inclusion in the formation price, while the purchase retains its base price and aggregate charges.

An individually configurable model needs its own stable node with quantity one. A quantity-three node represents one addressed group of three models. Existing catalog revisions and stored member paths remain valid; splitting a grouped node into individual models requires a new catalog revision. Infantry personnel and weapon detail nodes need not become selectable roster rows. NORTHAG supplies its own presentation callback and game data while reusing the recursive tree, scoped option editor, details and print components.

## NORTHAG implementation sequence

1. Resolve or explicitly defer NAG-01/02/03/06. Preserve coverage gaps and the disputed 499/66 example. The evidence fixtures are not a complete legal army or a game catalog.
2. Add an independent `packages/rulesets/northag` workspace with schemas and module rules. It may call generic core operations but must not import Classic rules/data. Declare its own module contract and supported rules revisions. Validate NORTHAG settings at import/restore/create/edit boundaries while keeping ordinary roster violations editable.
3. Add independent versioned `packages/catalogs/northag` records: entries, profiles, choices, purchase contexts, source evidence, explicit errata status and reference bindings. Preserve known zero, unknown and not applicable. No live battle/request state. Source documents and calibration fixtures remain outside published assets.
4. Add NORTHAG's application registration and explicit nation/list/default revision only when an actual compatible release exists. Register its data root in `packages/catalogs/registry.ts`, update Web's package dependency/lockfile for the new ruleset workspace, and add its own release/reference gates to `check:catalogs`. The generic asset gate verifies packaging, not all game content.
5. Implement NORTHAG's independent unit-details and print appendix adapter, including its five-band table and armor shape. Register it in `presentation.ts`; do not reshape Classic records to fit NORTHAG or vice versa.
6. Replace synthetic-only assurance with real NORTHAG domain and browser cases. Verify mixed Classic/NORTHAG library create/edit/save/restore/import/export/print, exact legacy Classic revisions, selector switching and stale loads, section-local limits, one-each children, per-platoon attachments, whole-company charges, requests with no initial arrival BR, Restricted/statistics coverage and independent reference data.

The original preparatory refactor left the core schema, Classic thresholds and catalog bytes, persistence schema and transfer envelope intact. The first NORTHAG release uses those existing contracts.

## Validation

Recursive member editing acceptance (2026-11-12): TypeScript checks, all 393 Vitest tests in 35 files, the production build and all 26 browser cases passed. Browser coverage includes independent squad/tank upgrades, preserving sibling choices, nested company members, shared option limits, single-target assignment moves, save/restore, whole-platoon transport replacement, undo after selecting a removed member, 360-pixel layout and real multi-page A4 PDF output. The existing Classic catalog revisions and persisted roster format remain unchanged. Synthetic adapter tests exercise independent member labels and arbitrary nesting; actual NORTHAG rules/data acceptance remains deferred.

Acceptance recorded on 2026-11-11: TypeScript checks passed; all 383 Vitest tests in 33 files passed (including the three local PDF fingerprint checks); the production build and its 11 data/publication checks passed; all 24 existing browser cases passed in system Chrome with the temporary-directory workaround below. Browser coverage includes exact Classic 1.0.0/1.1.0 data, imports/exports, save conflicts, real A4 PDF output and mobile layout. The second ruleset remains a synthetic contract fixture, not an actual NORTHAG browser release.

Run `npm run typecheck`, `npm test`, `npm run build`, then the existing Playwright suite against that build. The source fixtures have optional fingerprint checks: they run when ignored original PDFs exist locally and skip when those sources are absent on CI. No test downloads/publishes the PDFs.

Additional contract coverage in `apps/web/src/rulesets/registry.test.ts` uses a clearly marked synthetic second adapter. It verifies independent loading/dispatch, unsupported-contract rejection, explicit defaults under index reordering, mixed import/restore, nested sections/settings/training and absence of Classic combat-data fallback. `catalog-assets.test.ts` checks two separate synthetic public roots, allowlisting, collisions and tampering. These tests are not NORTHAG rules acceptance.

On this Windows sandbox the system Chrome channel works; its default temporary download directory cancelled downloads. The same export/import test passes with a workspace-local temporary directory. Use a process-local environment for this workaround, without changing application download code:

```powershell
New-Item -ItemType Directory -Force .tmp/playwright-temp | Out-Null
$env:TEMP = (Resolve-Path .tmp/playwright-temp).Path
$env:TMP = $env:TEMP
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npx playwright test --workers=4
```

The installed Playwright package expects bundled Chromium revision 1248, which was absent locally during this run; the existing older bundled revisions were not substituted. Build warnings about future Vite native-config import requirements and a JavaScript chunk above 500 kB remain non-blocking. Deployment, commit and push are separate actions and were not performed.

The final Windows browser run completed all cases, then waited on preview-server teardown. Stopping only the verified test-owned Vite preview process released the runner, which reported `24 passed` and exited with code 0. This was test-process cleanup, not an application change.
