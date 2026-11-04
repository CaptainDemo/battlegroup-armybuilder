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
[formation acceptance](../../../docs/implementation/soviet-v41-formations-acceptance.md)
for the data and rule coverage boundaries.

`npm run check:catalogs` checks schemas, relationships, all release fingerprints,
source identities, the independent M01 cost table and the publication file list.
The normal build runs this gate and publishes this directory's `public/` only;
source PDFs, fixtures, tools, reports and scratch files are never public assets.
