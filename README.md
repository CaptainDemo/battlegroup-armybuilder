# Battlegroup Army Builder

A free community browser roster editor for Battlegroup cold-war tabletop games. Choose an army list, buy formations and configure equipment, inspect Points / Battle Rating and rule issues, save locally, transfer JSON backups and print rosters with an optional vehicle/weapon data appendix.

Classic Cold War (Unofficial Battlegroup: Cold War, Draft 6) supports Soviet Armoured Division V4.1, with the 1.1.0 catalog as the default and exact 1.0.0 roster compatibility. NORTHAG supports the 2020 Russian Armoured Battlegroup with applicable Official Rules Errata v9 corrections. Each ruleset has its own catalog, rules and equipment data. See [NORTHAG release scope](docs/data/northag-release.md) for covered roster checks and remaining source gaps.

The app includes editing, undo/redo, IndexedDB autosave/conflict recovery, JSON import/export and browser print/PDF. See the [deployment guide](docs/deployment.md) for the hosted test site and publishing instructions.

## Quick start

Requires Node.js >=22.12 and npm >=10.

```bash
npm ci
npm run dev
```

Open the printed local URL and choose Create roster. Desktop has the roster on the left and candidates or selected-unit details on the right. Fixed platoons and attachments remain nested in the roster. You can keep an over-budget or otherwise violating draft and resolve Problems afterward.

The 398 Points / 23 BR calibration example is a debug tool, hidden on normal pages. Add `?debug=1` before the hash, for example `http://localhost:5173/?debug=1#/`, to expose it and editor check diagnostics. Remove the query and reload to hide them.

| Command | Purpose |
|---|---|
| npm run typecheck | Check all implemented workspace TypeScript |
| npm test | Domain, ruleset, catalog and Web-adapter unit checks |
| npm run build | Data gates and static production build into apps/web/dist |
| npm run preview | Serve the built app |
| npm run test:e2e | Build and run browser checks |

See [development](docs/development.md) for browser setup, Windows commands, version loading and debug behavior.

## Repository layout

```text
apps/web/                           React UI, sessions, adapters, transfer and printing
packages/core/                      Pure contracts, commands and evaluation tools
packages/rulesets/classic-coldwar/  Classic schemas and rule implementation
packages/catalogs/                  Independent versioned game releases and references
tests/fixtures/                     Independent manual source/calculation expectations
tests/e2e/                          Browser workflows
tools/data-import/                  Source and catalog release checks
docs/                               Maintained English design, contracts and source guides
references/                         Local read-only source material; ignored and unpublished
.tmp/                               Local evidence/caches; ignored and unpublished
```

Dependencies run Web → concrete ruleset → core. Core's only runtime dependency is Zod; it does not depend on React, storage or hosting. No account/backend is required to build rosters. Local saves belong to a browser origin; export/import backups when moving sites or browsers.

## Documentation

Start with the [documentation index](docs/README.md), [architecture](docs/architecture.md), [technical plan](docs/technical_plan.md), [module plan](docs/implementation_modules.md) and [development guide](docs/development.md).

Completed task dispatches, external-model reports, review iterations and acceptance logs under docs/implementation/ and docs/consultations/ are preserved locally but no longer tracked. Current specifications and source decisions do not depend on these archives.

## License

[MIT](LICENSE). This is an unofficial community tool, not affiliated with the rules authors or publishers. Game-data redistribution permissions are separate from the application's code license.
