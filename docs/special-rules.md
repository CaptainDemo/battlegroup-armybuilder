# Special rule display and print references

Implemented: 2026-11-11. The editor displays recorded special-rule names on purchase cards and, in unit details, identifies the units that use each rule and lists their deduplicated rule texts. Selecting a fixed member limits the detail view to that member and attachments anchored within it; selecting a formation includes its descendants. Print preview has an independent **Include special rule texts** checkbox, off by default, which adds a deduplicated appendix after the equipment appendix. Purchase rule names remain on the printed roster even with the text appendix disabled.

## Ownership and identity

`apps/web/src/rulesets/specialRules.ts` owns only projection contracts, tree traversal, scoped selection aggregation and an exact-version lookup algorithm. A `SpecialRulesAdapter` belongs to a concrete ruleset's presentation registration. It extracts entry/node rules and resolves names and prose. Shared views never search other rulesets or merge records by display name.

Reference identity includes ruleset ID, catalog ID, catalog revision, rules revision and the local rule ID. `createSpecialRuleLookup` requires all version fields to match an explicit binding. Separate rulesets can have the same ID and name with completely different text. Definitions are rendered as plain text with preserved line breaks and source attribution, not as HTML. Duplicate definition IDs in a reference set are rejected. If different catalog versions need different text, use separate reference sets with disjoint exact bindings and explicit adapter dispatch.

The projection reads the current evaluation's composition: replacement profiles and granted tags are current, zero-quantity nodes are skipped, and rules are not automatically inherited onto every member. Entry rules also cover purchases with no on-table composition. Purchased attachments are separate selections and are collected recursively. The print projection freezes the resolved names/text alongside its existing version-checked evaluation snapshot; toggling appendix visibility does not rerun rule evaluation or modify the roster.

## Classic adapter and deferred content

`apps/web/src/rulesets/classic/specialRules.ts` interprets existing Classic entry/profile rule fields and a small set of evaluated Officer/Scout tags. Its filter excludes existing engine hooks such as `max-per-parent:*`, `tank-family:*`, `requires-*`, `toc-battalion-only` and purchase-option constraints. These hooks must not be presented as rulebook paragraphs. A future Classic content pass should review extraction/mapping and human-facing labels as well as prose, especially parameterized rules and selected equipment effects. The adapter receives the selected choices and catalog so conditional rule mappings can be added there without changing common UI.

`packages/catalogs/classic-coldwar/reference/special-rules-v1.json` is an independent Classic reference set with explicit bindings for the existing 1.0.0/1.1.0 catalogs. Its definitions array is intentionally empty pending the later source/content pass. Existing names therefore display **Rule text has not been added for this catalog version.** An empty rule list says **No special rules recorded**, not that the actual game unit has none. No rules text was invented, borrowed from NORTHAG or asserted to be fully transcribed. Existing immutable catalog releases were not rewritten.

## Filling another ruleset

1. Create that ruleset's independent reference records with stable local IDs, names, source-checked text and source attribution. Validate data in its adapter/module. Use exact version bindings, including rules revision.
2. Implement `entryRules`, `nodeRules`, `label` and `definition` on its own `SpecialRulesAdapter`; register it as `RulesetPresentation.specialRules`. Interpret its own profile schema and current options/tags. Reuse shared algorithms, never Classic rule records or filters.
3. Cover replacements, rule-granting/removing options, fixed members, anchored attachments and non-entity purchases. Define ownership explicitly instead of copying formation rules onto every vehicle/team.
4. Test same-name rules across rulesets and versions, missing text, deduplication, selected-member scoping and print snapshot stability. The generic UI and appendix already render the returned text.

NORTHAG remains unregistered until its actual module/catalog is implemented. Missing presentation support reports unavailable special-rule reference data and never falls back to Classic.

## Validation

Type checking, the production build and all 388 unit/integration tests passed. All 25 browser cases passed, including the new unit-name/missing-text display, deduplicated appendix toggle and print-media visibility check. Final text-wrapping CSS was followed by another build and targeted browser check. The lookup tests use populated independent fixture texts to prove same-name isolation across rulesets and exact catalog/rules revisions; these fixture texts are not shipped game content.
