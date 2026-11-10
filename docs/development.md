# Development Guide

Engineering setup for the Battlegroup Army Builder. This documents what is
actually implemented through milestone M11: contracts, versioned catalog,
atomic editing commands, evaluation, Classic rules, the browser editor, local
saving, JSON import/export and the print/PDF view. See
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
full-rule coverage gaps. The initial 10-purchase release remains pinned at
1.0.0. New rosters use 1.1.0, which expands the Soviet V4.1 static formation
catalog to 151 purchase records.
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
and the storage concurrency revision.

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
- **Save status:** local autosave reports saving, saved, failure and conflict
  states. Game-rule coverage is reported separately.

## Browser editing (M08)

The `#/` route manages multiple locally saved rosters. Create an empty
Classic Soviet roster or use the 398 Points / 23 BR example. `#/editor` shows
the active roster; a direct link with no session offers a route back to creation.
The workspace stays mounted during hash navigation, so visiting Roadmap does
not discard drafts. After reopening the browser, open a saved roster from the list.

`features/roster-editor/RosterWorkspace.tsx` composes the exact catalog release,
M05 commands and M07 evaluation/availability. The UI reads totals, composition,
charges and issues from one evaluation whose `inputRevision` must match the
active document. `session.ts` keeps at most 50 undo/redo snapshots; restoring
one creates a fresh edit revision. Applying name/budget/size is one command
batch and one undo step. UI selection and small-screen panel state are separate
from roster choices.

Desktop uses two columns with Roster on the left and Actions on the right. Each
catalog section has an add button. Fixed platoons appear inside their company
with their own support menu and purchased attachments. `RosterTree.tsx` renders these destinations
and a separate delete button on every purchase row. Deleting a parent cascades
through its attachments and can be undone.

Actions switches between `CatalogPanel.tsx` (only candidates for the chosen
section or parent instance) and the selected purchase's details/options. Adding
keeps the candidate list open for repeated purchases; clicking a roster unit
switches to its details. The destination and details headings include an instance
ordinal to distinguish identical platoons. Deleting a target parent clears its
attachment chooser. Selection/add-destination UI state is not saved as roster data.

Purchases that exceed the budget or violate game rules can be added to a draft.
The purchase preview returns `allowed-with-issues` with the resulting rule
reasons. Invalid references or purchase destinations return `blocked`.
After each edit, the editor reevaluates the current roster and updates the
problem list, including clearing issues that the edit resolves.

The desktop action pane remains visible while scrolling a long roster, with
its own scrolling for lengthy details. Small screens have only Roster / Actions
panel buttons and a route back to the roster; no third panel is created for
attachments. Issues select the offending purchase, or focus the budget input for
a budget problem. See [two-column acceptance](implementation/m08-two-column-layout.md).

The runtime example uses published purchase IDs and normal commands. It never
imports manual fixture expectations or supplies precalculated totals. Coverage
and verified browser flows are recorded in [M08 acceptance](implementation/m08-acceptance.md).

## Local saving (M09)

Local saving is implemented in `adapters/storage/`. The storage port separates
database revisions from edit revisions. Dexie schema version 2 adds rebuildable
summaries and deletion markers to version 1 rows, preserving each original
document and its exact catalog identity. The save queue serializes writes per
roster and coalesces pending edits. A successful older save acknowledges only its
own edit revision. A transaction compares the expected database revision before
writing or deleting. Conflicts require reloading the saved version or saving a
copy. Storage failures retain the memory draft and offer retry and recovery JSON.
This recovery download contains the raw draft document. The M10 import workflow
and backup bundle format are planned separately.

See [M09 acceptance](implementation/m09-acceptance.md) for the validation record.

## Import & export (M10)

Roster JSON transfer is implemented in `features/roster-transfer/` with
envelope contracts in `packages/core/src/contracts/transfer.ts`. Exports read
the current in-memory draft (unsaved and failed-save rosters included):
**Export JSON** produces a `roster-file/1` single-roster file, **Download all
rosters (backup)** a `library-backup/1` backup that merges memory drafts over
stored rows and skips tombstones.

Imports run a fixed gate order — `File.size` before the bytes are even read
(20 MiB), byte size again before `JSON.parse`, the 2 MiB single-roster cap on
every single-file shape (envelope, bare M09 document, recognizable unknown
format), then JSON depth (64, measured iteratively), then per-record
classification: `ready` (exact indexed catalog loads and the document passes
the same command-document check used for restore), `original` (unknown catalog
revision or unknown format version — preserved verbatim as a recovery row,
never evaluated or converted), or `error` (corrupt structure,
cross-ruleset/orphan/cycle references, limits exceeded, or an indexed catalog
that cannot be verified right now — rejected from the library). The preview
writes nothing; confirm applies the default copy (fresh roster and edit ids,
all player choices verbatim), an explicit single-target overwrite
(compare-and-write against the page-known queue-anchored revision after all
pending writes settle — never a fresh store read, so another tab's committed
update conflicts instead of being silently replaced; a deleted/deleting target
is refused), or an all-or-nothing `importBatch` transaction for full backups.
A backup preview containing error records is rejected as a whole — the import
button stays disabled with the reason shown. The M09 bare recovery document
remains importable. Catalogs load only from the application index by exact
identity — nothing in a file can direct a request. Limits and semantics:
[M10 contracts](implementation/m10-contracts.md).

## Print / PDF view (M11)

`features/roster-output/` contains the pure print projection
(`printProjection.ts`) and the preview overlay (`PrintPreview.tsx`). The
projection consumes exactly one (document, catalog release, evaluation)
snapshot; it verifies rosterId, the edit revision (`inputRevision`), the
exact catalog identity on all three sides, and the evaluation's stamped
version triple (schemaVersion / rulesRevision / catalogRevision) against the
release manifest — a mismatched or out-of-date evaluation is refused instead
of printed. Totals, charge lines, composition and problems all come from that
snapshot — the projection adds no pricing or rule logic of its own; its only
arithmetic is summing the snapshot's charge lines into clearly labelled
display subtotals. Every composition member prints exactly once per purchase
(fixed platoons print as titled blocks and never repeat in the purchase's own
rows), and a composition root that itself carries a profile (the exact 1.0.0
BRDM-2 leaf) prints as a member.

The editor toolbar's **Print / PDF** button freezes the current in-memory
draft (saved or not, valid or violating) plus its evaluation into a preview.
The preview states the frozen edit revision, offers refresh/close, and calls
`window.print()`; the print stylesheet shows only the paper sheet on A4 with
all editor chrome hidden. Closing or refreshing the preview never edits the
roster, the undo history or the save state. Paper contents: header with
settings (including selected optional rules), Points/BR (final totals vs
known subtotals), rules/catalog/document versions and player notes; every
purchase including fixed sub-platoons and member-anchored attachments,
selected upgrades with per-target billing, and per-purchase price breakdowns;
problems with rule ids and purchase location; support ledgers, statistics,
check coverage and a vehicle/weapon quick reference aggregated from the
verified reference packages (their versions and gaps are printed). Long
blocks may split across pages; only small rows avoid page breaks, so no
oversized block is clipped. See
[M11 contracts](implementation/m11-contracts.md) for the full projection
contract and [M11 delivery](implementation/m11-result.md) for the validation
record.

The preview's **PDF options → Append vehicle and weapon data** checkbox is
off by default. Enabling it appends the current roster's vehicle cards and
weapon properties on new pages. Equal vehicle configurations are grouped;
targeted missile upgrades remain separate. Carried and mounted weapon
references are deduplicated by ID. Unverified data is shown explicitly.
This option changes presentation only: it survives Refresh snapshot, resets
when reopening the preview, and is never saved into the roster document.
See [PDF options](implementation/m11-pdf-options.md).

## Tests

- **Unit (Vitest):** `packages/core` and
  `packages/rulesets/classic-coldwar` — contract schema shape checks,
  catalog/roster relationship integrity positives and negatives, three-ruleset
  isolation, the Classic schema boundary, and the dependency boundaries
  above — plus the Web storage adapters and transfer pipeline (fake-indexeddb,
  no DOM). Config: `vitest.config.ts` (root).
- **Browser (Playwright):** `tests/e2e/web-shell.spec.ts` (shell, routing,
  small viewport), `tests/e2e/roster-transfer.spec.ts` — real downloads,
  file selection, preview/cancel, copy and overwrite import, exact-catalog
  and unknown-version handling — and `tests/e2e/roster-print.spec.ts` —
  current-draft printing, close/reopen freshness, editor-intact checks,
  real A4 `page.pdf()` output of a long multi-page roster and a
  violations/coverage roster (PDFs land in `.tmp/m11/` as acceptance
  evidence, never in the published app). Config: `playwright.config.ts`
  (root). The suite starts `vite preview` of the built app, so a pass
  exercises the static artifacts.

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
