# Battlegroup Army Builder

A free community web roster editor for tabletop players of Battlegroup cold-war
rulesets. The goal flow is: pick a ruleset / nation / army list, buy formations
and configure options, see Points and Battle Rating (BR) with list validation,
save and restore rosters, and export or print them.

**Current status: early development.** M02 supplies the web shell and build
tooling; M03 adds domain contracts and schemas; M04–M06 add the initial Classic
JSON catalog, pure editing commands and generic evaluation/pricing.
M07 adds scoped Classic rule checks and availability reasons.
The browser roster editor, storage and printing are
**not implemented yet** — see the
[roadmap](docs/implementation_modules.md) and the in-app `#/roadmap` page.

The first ruleset in scope is **Classic Cold War** (Unofficial Battlegroup:
Cold War, Draft 6) with the Soviet Armoured Division V4.1 list as the initial
sample. Classic Cold War, AirLand and NORTHAG keep their game data fully
separate; only code and UI are shared.

## Quick start

Requires Node.js >= 22.12 (verified with 22.22.2) and npm >= 10 (verified with
10.9.7).

```bash
npm install          # install workspace dependencies (creates package-lock.json usage)
npm run dev          # start the Vite dev server for the web shell
```

Other commands — see [docs/development.md](docs/development.md) for the full
list and details:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript check for all workspace packages |
| `npm test` | Vitest unit tests for `packages/*` (Node environment, no DOM) |
| `npm run build` | Static production build of the web app (`apps/web/dist`) |
| `npm run test:e2e` | Build, then run Playwright checks against the built app |

## Repository layout

```text
apps/web/                            Web shell: React + TypeScript + Vite, hash routing
packages/core/                       Domain contracts, Zod schemas and integrity checks
packages/rulesets/classic-coldwar/   Classic Cold War ruleset module (rules from M07)
packages/catalogs/                   Versioned game data per ruleset (later milestone)
tests/fixtures/                      Manually verified source samples (read-only input)
tests/e2e/                           Browser checks for the web shell
tools/data-import/                   Data checking scripts (Python, stdlib only)
docs/                                Design, data verification and delivery records
references/                          Original PDF references; never published or bundled
```

Dependency direction is one-way: `apps/web` composes ruleset modules,
ruleset modules depend on `packages/core`; core's only runtime dependency is Zod.
Game data (units, weapons, options, points) is fully isolated per ruleset.

## Documentation

- [Architecture](docs/architecture.md) — layering, domain model, evaluation flow
- [Implementation modules and delivery plan](docs/implementation_modules.md)
- [Technical plan](docs/technical_plan.md)
- [Development guide](docs/development.md)

## License

[MIT](LICENSE). This is an unofficial community tool and is not affiliated
with the rules authors or publishers. Redistribution permissions for the
game data itself are handled separately from the code license.
