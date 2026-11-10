# Battlegroup Army Builder — Agent Guide

## Project goal

A free, browser-based roster editor for tabletop wargames. The main workflow is: choose a ruleset, nation and army list → purchase formations and configure options → calculate Points / BR and check restrictions → save and restore → import/export JSON and print.

Prioritize Classic Cold War, starting with Soviet Armoured Division V4.1. AirLand and NORTHAG are independent long-term targets; CENTAG is a NORTHAG expansion. The initial product centers on My Rosters, the editor, unit details and printing. Accounts, a business backend, cloud sync, a public roster library and battle simulation are outside the default scope. See the module plan for progress rather than duplicating milestone history here.

## Technology and repository structure

React + TypeScript + Vite static application, using npm workspaces and package-lock.json. The domain layer is pure TypeScript; Zod validates data boundaries. Vitest and Playwright cover domain and browser behavior. Local persistence uses IndexedDB / Dexie; PDF output uses browser printing.

| Directory | Responsibility |
|---|---|
| apps/web/ | Pages, editing sessions, dependency composition and infrastructure adapters |
| packages/core/ | Shared contracts, pure domain operations and generic utilities |
| packages/rulesets/<ruleset>/ | Ruleset-specific schemas and rules |
| packages/catalogs/<ruleset>/ | Fully independent, versioned game data for each ruleset |
| tests/ | Source fixtures, combined checks and browser tests |
| tools/data-import/ | Data preparation and release checks |
| docs/ | Maintained design, contracts, rules evidence and development guides |
| references/ | Local original sources; read-only, Git-ignored and never published |
| .tmp/ | Local evidence, caches and collaboration state; Git-ignored |

Create directories as needed. Dependencies run Web → concrete ruleset → core. Core must not depend on React, browser storage, hosting platforms or concrete rulesets. Ruleset modules must not depend directly on one another.

## Long-term constraints

- Keep every Classic / AirLand / NORTHAG game record independent. Identical names or attributes still mean separate records. Do not introduce cross-ruleset equipment sharing, inheritance, aliases or automatic synchronization; program code and UI may be shared.
- Model purchase entries, combat profiles and player instances separately. Keep the section tree separate from the purchase tree. Bind references to a ruleset and exact catalog revision. Use stable instance and member identities, never names or array positions as fallback targets.
- Fixed members are included in the parent formation price. Define option targets, scope and charge counts explicitly. Derive costs, composition, statistics and checks from one evaluation snapshot; persist player choices and exact version references.
- Distinguish known zero, unknown and not applicable; budget from game size; numeric BR from training level. Coverage and issue severity are independent: an absence of errors cannot establish full legality when applicable rules are not covered.
- Keep static roster building separate from battle state. Source material about rolls, arrivals or consumption does not authorize implementing a battle simulator.

## Documentation

- [Architecture](docs/architecture.md): layers, domain model and version boundaries.
- [Implementation modules](docs/implementation_modules.md): progress, dependencies and scope.
- [Technical plan](docs/technical_plan.md): product goals and deployment approach.
- [Development guide](docs/development.md): actual entry points, commands and dependencies.
- [Domain contracts](docs/contracts/domain.md): public APIs and validation responsibilities.
- [Classic scope](docs/data/classic-sample-scope.md), [constraints](docs/data/classic-constraints.md) and [clarifications](docs/data/classic-ambiguities.md): verified facts, user decisions and remaining coverage questions.

Current user instructions and explicit clarifications take precedence over historical design candidates, external-model opinions and reference-package suggestions. Consult the relevant source documents for game rules; early schema examples are not final contracts. PDF text extraction is for navigation. Verify columns, numbers and suspected errors against the original page. Record corrections in maintained documentation or data without changing original sources.

## Workspace boundaries

- Preserve unrelated edits, untracked material and collaboration evidence. Do not bulk-clean, reset, stage, commit or push without explicit authorization.
- Work only on authorized modules; do not automatically start the next milestone. Run external implementation tasks serially in this repository and do not edit concurrently with an active external task.
- Publish only application assets and selected released data. Exclude references, fixtures, .tmp and the complete working directory.
- Keep maintained documentation in English. Historical task, review and acceptance files under docs/implementation/ and docs/consultations/ are local, ignored archives, not current specifications.

## Git Commit Format

- Follow the existing Conventional Commit style in this repo: `type: short imperative summary`.
- Common types in this repo include `feat:` for user-facing implementation changes and `docs:` for documentation-only changes.
- Keep the summary lowercase after the type unless a proper noun or code identifier requires capitalization.