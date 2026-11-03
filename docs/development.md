# Development Guide

Engineering setup for the Battlegroup Army Builder. This documents what is
actually implemented as of milestone M03 (domain contracts and Zod boundary
schemas). Roster editing commands, rule evaluation, storage and printing do
not exist yet; see [implementation modules](implementation_modules.md) for
the delivery plan.

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
| `npm test` | Vitest run — unit tests under `packages/*/src`, executed in a Node environment without a DOM |
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
it does not use (the M02 shell still ships without zod in its bundle).

## Domain contracts (M03)

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
- **Honesty in the UI:** the shell explicitly labels itself as an engineering
  milestone; do not add screens that imply roster functionality exists before
  the matching module (M07+) lands.

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
