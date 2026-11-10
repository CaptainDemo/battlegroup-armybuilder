# Development Guide

This guide describes the implemented Classic workflow: versioned catalogs, pure commands/evaluation, scoped rules, two-column browser editing, local saving, JSON transfer and print/PDF. See the [documentation index](README.md) for maintained specifications and the [module plan](implementation_modules.md) for progress.

## Prerequisites and installation

Node.js >=22.12 and npm >=10 are required (previously verified with Node 22.22.2 / npm 10.9.7). Use npm workspaces and the committed package-lock.json; do not switch package managers.

```bash
npm ci
```

This installs the locked workspace dependencies and links @battlegroup packages. Use npm install deliberately when changing dependency inputs.

## Commands

| Command | Purpose |
|---|---|
| npm run dev | Vite development server |
| npm run typecheck | TypeScript checks for core, Classic ruleset and Web |
| npm test | Vitest: contracts, commands, evaluation, rules, catalogs and Web adapters |
| npm run test:watch | Vitest watch mode |
| npm run check:catalogs | Catalog-release and combat-reference data gates |
| npm run build | Data gates followed by Vite build into apps/web/dist |
| npm run preview | Serve the existing production build |
| npm run test:e2e | Build, then Playwright against a production preview |

On Windows use npm.cmd/npx.cmd when PowerShell execution policy prevents the .ps1 shims. Start a stable local preview with:

```bash
npm run preview --workspace @battlegroup/web -- --host 127.0.0.1 --port 4173 --strictPort
```

Browser checks require a local browser. Install bundled Chromium once with `npx playwright install chromium`, or set PLAYWRIGHT_CHANNEL=chrome (or msedge) for an installed system browser. For example, in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

The root config uses port 4173 and reuses an existing server. Confirm that server serves the intended build, or use an isolated config/port with reuseExistingServer=false for independent validation. Local sandbox restrictions can affect Chrome startup or downloads; preserve those failures and distinguish environment errors from application failures.

## Debug tools

Normal pages expose the roster workflow. Open `http://localhost:5173/?debug=1#/` (or the same query before the hash on a production preview) for the independently verified 398 Points / 23 BR example and catalog diagnostics. The example uses normal commands and published entry IDs, never fixture expected totals.

The flag is not persisted. Remove it and reload to hide the tools. It does not affect rule checks, versions, choices or saving. Browser tests that need the example opt in explicitly.

Rule coverage summarizes partial coverage and checks blocked by data/settings. A nested Check diagnostics disclosure appears only under ?debug=1 and shows internal check IDs/notes. Printed sheets always use the concise player summary, even when opened in debug mode. Engineering progress belongs in the module plan, not a Roadmap application route.

## Workspaces and dependencies

```text
apps/web
  ├── react / react-dom / dexie
  ├── @battlegroup/core ──────────────> zod
  └── @battlegroup/classic-coldwar ──> core + zod
```

Core's only runtime dependency is Zod. A concrete ruleset importing Zod declares it directly. Core does not import React, DOM, storage or concrete rulesets; rulesets do not import one another. dependencyBoundary.test.ts checks the boundary. Both domain packages are side-effect-free and importable in Node tests. Internal packages export TypeScript source, compiled by Vite/Vitest.

## Contracts, commands and evaluation

[Domain contracts](contracts/domain.md) describe the full API and responsibility split.

| Location | Responsibility |
|---|---|
| packages/core/src/contracts/ | Identities, value states, sources, catalog/roster/version/transfer schemas and result types |
| packages/core/src/validation/ | Explicit catalog/roster relationship checks and stable member resolvers |
| packages/core/src/roster/ | Pure create/edit commands, atomic batches and structural validation |
| packages/core/src/evaluation/ | Generic composition, charges, live targets and resource allocation |
| packages/rulesets/classic-coldwar/src/ | Classic training/combat/release schemas, game checks, eligibility and reference boundaries |
| packages/core/src/samples/ | Synthetic and M01-based contract-test samples; never runtime releases |

Core exports createRosterDocument / executeRosterCommands with caller-supplied IDs/revision, and evaluateRoster / resolveChoiceTargets / allocateResources. Classic exports evaluateClassicRoster / getClassicEntryAvailability / createClassicRuleset. The result protocol file itself contains interfaces; this does not mean the separately exported evaluators are unimplemented.

Use explicit full identity (ruleset/catalog/revision/localId), independent selection IDs and stable member targets. Static member-path and explicit ownerSelectionId+nodePath attachment-member targets are different. Member-slot options cannot address arbitrary attachments; scope selectors can rebuild actual matching targets.

Roster edit revision, evaluation inputRevision, catalog revision and storage saveRevision are different concepts. UI must consume a matching input/version snapshot. Base training is a tracked context token; Classic validates i/r/v/e, separately from numeric BR and explicit game size.

## Catalog loading and publication

The application allowlist is packages/catalogs/classic-coldwar/public/catalogs/index.json. loadCatalog in the Web catalog adapter resolves only exact indexed identity, verifies SHA-256 before parsing and checks the required module/rules revision. Results distinguish ready, not-found, unsupported-version, network-error, digest-mismatch and invalid-data. An imported URL cannot become a catalog request.

Release 1.0.0 remains the original ten-purchase release. New rosters use 1.1.0 with 120 top-level purchases, 31 attachment contexts and 203 options. Fixed platoons are included in the parent price. The actual catalogId is soviet-armoured-division-v4_1, not the asset directory's shorter name.

Only the explicit public catalog directory is copied into static output. The normal build runs release/reference data gates first. Preserve immutable release bytes and LF endings. Fixtures are independent evidence, not runtime catalog authority. See the [catalog README](../packages/catalogs/classic-coldwar/README.md), [source baseline](data/classic-sample-scope.md) and [constraints](data/classic-constraints.md).

## Application and editing

Hash routes are #/ (My Rosters) and #/editor. Unknown paths render a not-found page. The workspace remains mounted across supported route navigation. After reopening, choose a saved roster from My Rosters; a direct editor link without an active roster offers a route back.

Strings live in apps/web/src/i18n/en.ts through t(). A later language dictionary can be a sibling module. Set VITE_BASE (for example /armybuilder/) for subpath builds; see apps/web/vite.config.ts. Hash routing avoids rewrite requirements but not asset-base verification.

RosterWorkspace composes catalog, commands, evaluation, save queue and UI. One matching evaluation drives totals, composition, charges and issues. session.ts retains at most 50 undo/redo snapshots, each restoration with a fresh edit revision. Name/budget/size changes are one batch/history step. Panel/search/selection state is separate from roster data.

Desktop uses Roster left and Actions right. RosterTree renders section add buttons, company fixed platoons, support destinations, attachments and independent delete controls. Parent deletion cascades and can be undone. Actions switches between CatalogPanel candidates for the selected destination and selected-unit details/options. Adding leaves candidates open; selecting a purchase opens details. Instance ordinals distinguish identical purchases. Deleting a parent clears an invalid chooser. Small screens switch Roster/Actions; attachments do not create a third panel.

Over-budget and other rule-breaking purchases remain editable. Availability can be allowed-with-issues, but ordinary candidates show no speculative warning banner. After editing, Problems updates and clears resolved issues. Invalid references/destinations remain blocked. Problems navigation selects the purchase or focuses the budget field as appropriate.

## Unit reference data

The detail panel reads the evaluation's actual subtree using versioned Classic vehicle/weapon supplements. Vehicles have independent cards; infantry/teams display explicitly recorded carried weapons. Replacements and targeted tags drive PKM/RPG/SAM and Konkurs/Svir presentation. Unknown values/variants remain explicit, and reference display never prices a purchase. See [unit data](data/classic-unit-data.md) for sources, counts and gaps.

## Local saving

adapters/storage/ contains the port, Dexie implementation and save queue. Schema 2 adds rebuildable summaries and deletion markers while preserving original documents/exact catalogs. Per-roster writes serialize and coalesce; an older completion acknowledges only its edit revision. Transactions compare expected storage revision before save/delete.

Conflicts offer reload or save-as-copy; failed writes retain the memory draft and offer retry/recovery JSON. Tombstones stop a stale tab from resurrecting a deleted roster. Raw recovery downloads remain importable by the transfer flow. Database schema migration must not upgrade game rules.

## Import/export

features/roster-transfer/ implements roster-file/1 and library-backup/1. Exports read current drafts even when unsaved. Backups merge drafts over stored rows and exclude tombstones. Imports enforce byte/depth/count limits, classify ready/original/error, preview without writes and apply only on confirmation.

Copies get fresh roster/edit IDs but retain internal choices/targets and catalog version. Explicit overwrite settles the queue and uses its last acknowledged page-known saveRevision, never a fresh database read. Concurrent remote changes therefore conflict. Full backups write atomically and reject the entire batch if any record is an error. Unsupported originals remain recoverable. See [transfer contracts](contracts/import-export.md) for exact limits and API semantics.

## Print/PDF

features/roster-output/ contains a pure projection and overlay. Verify roster ID, edit revision, all catalog identities and evaluation schema/rules/catalog stamps against the release. Reject stale/mismatched inputs. The snapshot supplies all composition/costs/problems; print adds no rules or repricing.

Print / PDF freezes the current draft/evaluation, shows revision, supports refresh/close and calls window.print. Unsaved/violating drafts can print without editing choices/history/save state. Fixed platoons, member-anchored attachments, optional rules, upgrades, versions, notes, issues and incomplete totals are preserved. Every member appears once, including legacy profile-bearing roots. Rule coverage uses the player summary rather than raw implementation records.

Append vehicle and weapon data is off by default, survives refresh and resets on reopening. It groups equal vehicle configurations, isolates target upgrades, deduplicates weapon IDs and prints source/gap notes. It is never stored in RosterDocument. See [printing contracts](contracts/printing.md) for paper contents, identity reasons and A4 pagination.

## Verification

Vitest covers schema/relation boundaries, commands, evaluation, rules, isolation, catalog/reference releases and Web storage/transfer adapters (including fake-indexeddb), without a DOM. Root configuration is vitest.config.ts.

Playwright checks web shell/routing/small screens, indexed catalog assets, real download/file-selection/preview/import flows, conflicts and print snapshots/options. Print checks generate actual A4 PDFs under .tmp/m11/ and .tmp/m11-appendix/. Root configuration is playwright.config.ts. The suite serves built assets rather than only a development server. For print changes, inspect actual output where pagination/readability is affected.

Run checks appropriate to a change. Documentation-only changes require link/consistency checks rather than repeating unrelated application tests. A passing build is not a substitute for independent source arithmetic or browser reopen/printing evidence.

## Build output and fixture checker

npm run build writes apps/web/dist. It must not contain references/, tests/fixtures/, .tmp/, source PDFs or the working directory. dist/, dependencies, reports and .tmp/ are ignored. Preserve the existing chunk-size warning as a warning, not a failed build or a reason for an unrelated dependency change.

The independent fixture checker runs without npm or pytest:

```bash
python tools/data-import/check_m01_fixtures.py
```

It checks source fingerprints and manual arithmetic, not game-rule execution. Where python is a Windows Store stub, a locally available interpreter can be selected with `uv run --python 3.12 python tools/data-import/check_m01_fixtures.py`. Verify local source paths when checking moved reference files rather than changing fingerprint expectations.

## Maintained and archived documentation

Keep maintained documentation in English, using the [index](README.md). docs/implementation/ and docs/consultations/ contain ignored local historical reports; a fresh checkout must not depend on them. Durable APIs, deployment identity and source decisions have been consolidated into maintained contracts/guides. The tracked root AGENTS.md provides the project's standing agent guidance.
