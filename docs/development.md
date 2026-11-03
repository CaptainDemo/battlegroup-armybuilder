# Development Guide

Engineering setup for the Battlegroup Army Builder. This documents what is
actually implemented through milestone M08: contracts, versioned catalog,
atomic editing commands, evaluation, Classic rules and the browser editor.
Storage, import/export and printing remain future work; see
[implementation modules](implementation_modules.md) for the delivery plan.

## Prerequisites

| Tool | Requirement | Verified version |
| --- | --- | --- |
| Node.js | >= 22.12 (Vite 8 / Vitest 5 engine requirement) | 22.22.2 |
| npm | >= 10 (npm workspaces) | 10.9.7 |

Do not switch package managers. The repository uses npm workspaces with a
`package-lock.json`; clean installs should use `npm ci`.

## Install

```bash
npm install
```

This installs dependencies for all workspaces and creates the workspace
symlinks (`node_modules/@battlegroup/*` point at `packages/` and `apps/`).

## Commands (root package.json scripts)

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server for the web shell (hash routing at `http://localhost:5173`) |
| `npm run typecheck` | `tsc --noEmit` for `packages/core`, `packages/rulesets/classic-coldwar` and `apps/web` in sequence |
| `npm test` | Vitest run — core, ruleset, Web adapters/session and catalog release tests, without a DOM |
| `npm run test:watch` | Same tests in watch mode |
| `npm run build` | Static production build into `apps/web/dist` |
| `npm run preview` | Preview server for the built app |
| `npm run test:e2e` | Runs `npm run build`, then Playwright checks against a preview server of the built app (port 4173) |

Playwright needs a local browser binary once per machine:

```bash
npx playwright install chromium
```

On slow or offline networks you can run the checks against an installed system
browser instead of the bundled Chromium:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e      # or msedge
```

(The env var is optional; without it Playwright uses its bundled Chromium.)

## Workspaces and dependency direction

```text
apps/web (@battlegroup/web)
  ├── react / react-dom
  ├── @battlegroup/core ────────────────> zod (pure schema library)
  └── @battlegroup/classic-coldwar ──> @battlegroup/core + zod (declared directly)
```

Rules enforced today (checked by
`packages/core/src/dependencyBoundary.test.ts`):

- `@battlegroup/core` declares exactly one runtime dependency: `zod` (M03).
  No React, no DOM, no ruleset imports, no browser storage.
- A ruleset module depends on core and declares `zod` directly when it
  imports it — no reliance on hoisting. Ruleset modules never depend on each
  other or on the web app.
- Only `apps/web` composes ruleset modules.
- Core and ruleset packages must stay importable from plain Node without a
  DOM; their tests run in Vitest's `node` environment to prove it.

Internal packages consume TypeScript sources directly (`main`/`exports` point
at `src/index.ts`), so Vite and Vitest compile them on the fly. Both packages
declare `"sideEffects": false`, so the web bundle tree-shakes the schema code
it does not use. The current editor includes Zod for catalog boundary checks.

## Domain contracts (M03)

M05 exports `createRosterDocument` and `executeRosterCommands`: pure atomic edits
with caller-provided ids/revisions and explicit invalidation notices. M06 exports
`evaluateRoster`, `resolveChoiceTargets` and `allocateResources`: one deterministic
derived snapshot with live selectors, charges, capacity matching and coverage.
The catalog must already be validated. Concrete game checks arrive in M07;
M06 always retains a game-rule coverage gap. See the [M05](implementation/m05-acceptance.md)
and [M06](implementation/m06-acceptance.md) acceptance records.

M07 now provides `evaluateClassicRoster`, `getClassicEntryAvailability` and
`createClassicRuleset` in `@battlegroup/classic-coldwar`. It uses an explicit
catalog/purchase context, preserves the generic snapshot, and reports remaining
full-rule coverage gaps. The initial catalog remains limited to 10 purchases.
See [M07 acceptance](implementation/m07-acceptance.md) for enabled checks and
which boundary cases use synthetic data instead of published purchases.

M04 adds `npm run check:catalogs` and an independent partial Classic JSON release
under `packages/catalogs/classic-coldwar/public/`. The normal production build
runs this data gate before Vite. Only this explicit public directory is copied;
the Web adapter loads exact indexed identities and verifies SHA-256 before parsing.
See [M04 acceptance](implementation/m04-acceptance.md) for the covered entries,
purchase contexts and failure states. Test fixtures are not runtime catalogs.

Pure TypeScript + Zod contracts and structural validation live in
`packages/core/src`:

| Area | Entry points |
| --- | --- |
| Identity & references | `contracts/primitives.ts` — `CatalogIdentity`, `EntryReference`, `rulesetIds` |
| Value states | `contracts/values.ts` — `TrackedValue` (`known`/`unknown`/`not_applicable`), `QuantityLimit`, `CostDelta` |
| Sources & errata | `contracts/source.ts` — `SourceDocument` (authority / review / errata status separate), `SourceReference` (PDF page vs printed page) |
| Versions | `contracts/versioning.ts` — `CATALOG_SCHEMA_VERSION`, `ROSTER_FORMAT_VERSION`, `CatalogManifest` |
| Catalog shell | `contracts/catalog.ts` — sections tree, `UnitEntry` + composition (known / no-entities / pending), `OptionGroup`/`Option`, resource grants & consumptions |
| Roster document | `contracts/roster.ts` — `RosterDocument`, selections with stable member paths, budget and game size stored independently |
| Evaluation protocol | `contracts/evaluation.ts` — result-shape interfaces only (`Evaluation`, `Availability`, `RulesetModule`); there is intentionally no evaluate/pricing function yet |
| Integrity checks | `validation/catalogRelations.ts`, `validation/rosterRelations.ts` — reference/relationship checks taking an explicit catalog; distinct from game rules |

`packages/core/src/samples/` holds **synthetic contract-test fixtures** (three
same-name ruleset catalogs proving isolation, plus the M01-facts Classic
catalog and the 23 account-shaped roster documents). They are test data, not
a publishable catalog.

Member paths address the selection's static composition. Purchased attachments
use an `attachment-member` target carrying `ownerSelectionId` and its own
relative node path; reordering identical purchases cannot retarget an option.
Only scope-selector options can address attachments, not options restricted
to declared static member slots. The document's edit `revision` is copied to
`Evaluation.identity.inputRevision`; it is distinct from catalog revisions
and the future storage concurrency revision.

`UnitEntry.baseTraining` carries an opaque tracked token per purchase context;
Classic validates known levels as i/r/v/e. The Classic catalog and roster
schemas also reject foreign ruleset identities. Entry, profile, option and
errata source references are checked against the manifest's document registry.
See [the contract guide](implementation/m03-contracts.md) and
[M03 acceptance](implementation/m03-acceptance.md) for exact coverage.

The Classic-specific schema boundary lives in
`packages/rulesets/classic-coldwar/src`: training levels `i/r/v/e`
(`training.ts`), tracked combat stats that stay honestly unknown until
verified (`profiles.ts`), and the Classic catalog/roster refinements
(`classicSchema.ts`, e.g. game sizes squad/platoon/company/battalion).

See [M03 contracts](implementation/m03-contracts.md) for the full public API,
the schema-vs-relationship check division, and the 23-account mapping.

## Web shell notes

- **Routing:** hash routing (`#/`, `#/roadmap`) implemented in
  `apps/web/src/app/hashRouter.ts`. Unknown paths render a not-found page.
  Hash routing keeps the app deployable to any static host without rewrite
  rules, but asset base paths still need verification per host.
- **Strings:** all UI copy lives in the English dictionary
  `apps/web/src/i18n/en.ts` and is read through `t()` from
  `apps/web/src/i18n/index.ts`. A future Chinese dictionary can be added as a
  sibling module.
- **Asset base path:** set `VITE_BASE` (for example `VITE_BASE=/armybuilder/`
  in `apps/web/.env.production`) to build for a sub-path deployment. See
  `apps/web/vite.config.ts`.
- **Honesty in the UI:** show partial data/rule coverage and the session-only
  state. No local save is promised before M09 is implemented and verified.

## Browser editing (M08)

The `#/` route manages multiple rosters within the open page. Create an empty
Classic Soviet roster or use the 398 Points / 23 BR example. `#/editor` shows
the active roster; a direct link with no session offers a route back to creation.
The workspace stays mounted during hash navigation, so visiting Roadmap does
not discard drafts. Refreshing or closing the page does discard them.

`features/roster-editor/RosterWorkspace.tsx` composes the exact catalog release,
M05 commands and M07 evaluation/availability. The UI reads totals, composition,
charges and issues from one evaluation whose `inputRevision` must match the
active document. `session.ts` keeps at most 50 undo/redo snapshots; restoring
one creates a fresh edit revision. Applying name/budget/size is one command
batch and one undo step. UI selection and small-screen panel state are separate
from roster choices. No browser database or storage adapter is involved yet.

Desktop shows Catalog / Roster / Details together. Small screens use panel
buttons. Select a BMP platoon (or its attachment) to expose its attachment menu;
select a purchase in the roster to configure options. Issues select the offending
purchase, or focus the budget input for a budget problem.

The runtime example uses published purchase IDs and normal commands. It never
imports manual fixture expectations or supplies precalculated totals. Coverage
and verified browser flows are recorded in [M08 acceptance](implementation/m08-acceptance.md).

## Tests

- **Unit (Vitest):** `packages/core` and
  `packages/rulesets/classic-coldwar` — contract schema shape checks,
  catalog/roster relationship integrity positives and negatives, three-ruleset
  isolation, the Classic schema boundary, and the dependency boundaries
  above. Config: `vitest.config.ts` (root).
- **Browser (Playwright):** `tests/e2e/web-shell.spec.ts` — home page load,
  hash-route navigation, direct deep links, not-found fallback, and
  small-viewport layout without horizontal overflow. Config:
  `playwright.config.ts` (root). The suite starts `vite preview` of the built
  app, so a pass exercises the static artifacts.

There are intentionally no unit tests for the page copy; the e2e checks cover
the shell's main access paths without mirroring every string.

## Build output

`npm run build` writes `apps/web/dist`. The build bundles only the web app
and its workspace dependencies. It must never include `references/`,
`tests/fixtures/`, `.tmp/` or raw source PDFs — verify with a directory
listing when changing build inputs. `dist/`, `node_modules/`, test reports
and `.tmp/` are git-ignored.

## Data checks (pre-existing, unchanged)

The M01 fixture account checker predates the npm workspace and still runs on
Python alone:

```bash
python tools/data-import/check_m01_fixtures.py
```

It verifies source fingerprints and arithmetic in the manual fixture
accounts. It is not a rule engine and is unaffected by this repository's npm
setup. On machines where `python` resolves to the Windows Store stub (exit
code 49, no output), run it through the local uv interpreter instead:

```bash
uv run --python 3.12 python tools/data-import/check_m01_fixtures.py
```
