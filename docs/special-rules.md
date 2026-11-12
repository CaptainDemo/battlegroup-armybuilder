# Special rule display and print references

Implemented: 2026-11-11. The editor displays recorded special-rule names on purchase cards and, in unit details, identifies the units that use each rule and lists their deduplicated rule texts. Selecting a fixed member limits the detail view to that member and attachments anchored within it; selecting a formation includes its descendants. Print preview has an independent **Include special rule texts** checkbox, off by default, which adds a deduplicated appendix after the equipment appendix. Purchase rule names remain on the printed roster even with the text appendix disabled.

## Ownership and identity

`apps/web/src/rulesets/specialRules.ts` owns only projection contracts, tree traversal, scoped selection aggregation and an exact-version lookup algorithm. A `SpecialRulesAdapter` belongs to a concrete ruleset's presentation registration. It extracts entry/node rules and resolves names and prose. Shared views never search other rulesets or merge records by display name.

Reference identity includes ruleset ID, catalog ID, catalog revision, rules revision and the local rule ID. `createSpecialRuleLookup` requires all version fields to match an explicit binding. Separate rulesets can have the same ID and name with completely different text. Definitions are rendered as plain text with preserved line breaks and source attribution, not as HTML. Duplicate definition IDs in a reference set are rejected. If different catalog versions need different text, use separate reference sets with disjoint exact bindings and explicit adapter dispatch.

The projection reads the current evaluation's composition: replacement profiles and granted tags are current, zero-quantity nodes are skipped, and rules are not automatically inherited onto every member. Entry rules also cover purchases with no on-table composition. Purchased attachments are separate selections and are collected recursively. The print projection freezes the resolved names/text alongside its existing version-checked evaluation snapshot; toggling appendix visibility does not rerun rule evaluation or modify the roster.

## Classic Soviet V4.1 reference

`packages/catalogs/classic-coldwar/reference/special-rules-v1.json` contains 40 source-checked English summaries bound to the Soviet 1.0.0 and 1.1.0 releases. Each definition cites printed pages. Cold War Draft 6 supplies the main rules, the Battlegroup Rulebook supplies retained procedures, Soviet V4.1 supplies list-specific labels and values, and New Orders Rules and Special Rules V2 supplies Battle Drill and the WARPAC command context.

The Classic adapter uses purchase and profile fields, explicit Soviet catalog IDs, and evaluated member tags. It resolves the printed TOC and company SAM rules from their catalog tokens and uses one definition for Ground Radar and Ground Surveillance Radar. Marksman, BRM-1 radar, loader team and KMT references follow the evaluated equipment or member that supplies the rule. The **Rule text has not been added for this catalog version** fallback covers unresolved IDs and unsupported versions. The separate AFV card panel continues to show the card's recorded traits. This reference pass covers the mapped Soviet roster rules and selected equipment effects. It leaves a full audit of roster rule assignments and AFV traits for separate work.

## Filling another ruleset

1. Create that ruleset's independent reference records with stable local IDs, names, source-checked text and source attribution. Validate data in its adapter/module. Use exact version bindings, including rules revision.
2. Implement `entryRules`, `nodeRules`, `label` and `definition` on its own `SpecialRulesAdapter`; register it as `RulesetPresentation.specialRules`. Interpret its own profile schema and current options/tags. Reuse shared algorithms, never Classic rule records or filters.
3. Cover replacements, rule-granting/removing options, fixed members, anchored attachments and non-entity purchases. Define ownership explicitly instead of copying formation rules onto every vehicle/team.
4. Test same-name rules across rulesets and versions, missing text, deduplication, selected-member scoping and print snapshot stability. The generic UI and appendix already render the returned text.

NORTHAG remains unregistered until its actual module/catalog is implemented. Missing presentation support reports unavailable special-rule reference data and never falls back to Classic.

## Validation

The tests check text and source coverage for the two released Classic versions, evaluated equipment placement, the unsupported-version fallback, and exact-version and ruleset isolation. The browser test checks that the editor and the optional deduplicated print appendix both show rule text.
