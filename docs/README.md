# Documentation

These documents describe maintained behavior and design decisions. Start with the development guide for commands and with the module plan for implementation status.

| Document | Purpose |
|---|---|
| [Technical plan](technical_plan.md) | Product goals, scope, stack and delivery approach |
| [Architecture](architecture.md) | Dependency boundaries, domain model and runtime flows |
| [Implementation modules](implementation_modules.md) | Module responsibilities, acceptance boundaries and current progress |
| [Development guide](development.md) | Commands, source entry points, debugging and checks |
| [Deployment](deployment.md) | Existing test site, source boundary and update/migration procedure |
| [Domain contracts](contracts/domain.md) | Identities, schemas, relation checks, commands and evaluation |
| [Import/export](contracts/import-export.md) | File formats, limits, compatibility and transactional imports |
| [Printing](contracts/printing.md) | Snapshot identity, paper contents, PDF options and pagination |
| [Classic scope](data/classic-sample-scope.md) | Source baseline and representative purchase contexts |
| [Classic constraints](data/classic-constraints.md) | Rule IDs, scope, counting semantics and source pages |
| [Classic clarifications](data/classic-ambiguities.md) | Resolved source issues and remaining coverage question |
| [Classic calibration](data/classic-calibration.md) | Independent hand-calculated fixtures |
| [Base-rulebook review](data/classic-base-rulebook-review.md) | Reviewed passages and the limits of their conclusions |
| [Classic unit data](data/classic-unit-data.md) | Vehicle/weapon reference bindings and known gaps |
| [NORTHAG preparation](data/northag-notes.md) | Source distinctions and requirements for the next ruleset |

Raw source files remain local under references/. Completed task dispatches, model responses, review iterations, acceptance reports and tool-limit experiments remain local under docs/implementation/ and docs/consultations/. Those two archive directories are ignored and no longer tracked. Durable contracts and decisions have been consolidated into the documents above; a fresh checkout does not require the archives.

Keep documentation in English. Source titles, identifiers, hashes, version strings and game terminology retain their source spelling. Do not replace verified source evidence with a historical implementation report.