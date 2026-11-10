# Classic Soviet catalog

`public/catalogs/index.json` is the application allowlist. It pins exact catalog
identity, rules revision, module contract, relative asset path and SHA-256 of the
entire release bytes. After publication, changes require a new revision/path;
never replace a pinned version or silently choose the latest one.
`.gitattributes` pins catalog files to LF so Windows checkout conversion does
not change the bytes covered by release fingerprints.

The JSON release is the runtime authority. It was initially curated from M01
facts and reviewed independently against `docs/data/classic-sample-scope.md`;
the M03 contract-test sample is not imported by runtime code or the build.
Version 1.0.0 remains indexed as the original 10-entry release. Version 1.1.0
is the default, with 120 top-level purchases, 31 attachment purchase contexts
and 203 options from the Soviet V4.1 roster. The fixed platoons inside companies
are included in their company price.

Formation/member and transport identities are recorded; detailed weapon loads
and combat stats are not complete. Profiles retain explicitly unknown stats.
`purchases` declares purchase context, including eligible fixed member paths.
The Classic rules module checks the implemented constraints separately. See the
[formation constraints](../../../docs/data/classic-constraints.md)
for the data and rule coverage boundaries.

`npm run check:catalogs` checks schemas, relationships, all release fingerprints,
source identities, the independent M01 cost table and the publication file list.
The normal build runs this gate and publishes this directory's `public/` only;
source PDFs, fixtures, tools, reports and scratch files are never public assets.

`reference/soviet-afv-v1.json` is a separately versioned, read-only combat
reference for the detail panel. It contains 51 visually checked Soviet AFV
cards with explicit bindings to 52 profile IDs in catalog 1.1.0 and 7 in 1.0.0.
Bindings use full catalog identity and profile IDs; names never select a card.
The web build bundles this JSON after ruleset-specific schema validation.
It adds movement, armour, source-card weapons and traits without rewriting
immutable catalog bytes, saved selections, costs or legality coverage.
It is not a complete resolved equipment loadout. Unverified vehicle profiles
remain explicitly missing; optional missiles are not auto-equipped.
The catalog check also validates this supplement and all its profile bindings.
See [combat data guide](../../../docs/data/classic-unit-data.md).

`reference/draft6-weapons-v1.json` adds 33 Classic-only weapon references from
Draft 6. All 125 current catalog profiles have an explicit presentation kind:
86 vehicles, 29 carried-weapon/unit-equipment bindings, 7 personnel/container
or non-weapon equipment records, and 3 weapons with unverified data. Infantry
shows carried weapons instead of vehicle stats. Counts are used only for
explicitly recorded weapons, not inferred from personnel or squad size.
Current evaluated replacement profiles and targeted tags drive PKM/RPG/SAM
and Konkurs/Svir presentation. Generic missile-table data retains its own
source; it does not silently overwrite differing AFV-card values. A selected
ATGM replacement hides the replaced base-card missile row for its target.
