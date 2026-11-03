# Classic Soviet initial catalog

`public/catalogs/index.json` is the application allowlist. It pins exact catalog
identity, rules revision, module contract, relative asset path and SHA-256 of the
entire release bytes. After publication, changes require a new revision/path;
never replace a pinned version or silently choose the latest one.
`.gitattributes` pins catalog files to LF so Windows checkout conversion does
not change the bytes covered by release fingerprints.

The JSON release is the runtime authority. It was initially curated from M01
facts and reviewed independently against `docs/data/classic-sample-scope.md`;
the M03 contract-test sample is not imported by runtime code or the build.
Only 10 core purchases are enabled (6 top-level, 4 BMP-1 platoon attachments).
The request belongs to Additional Fire Support, separately from Artillery.

Formation/member and transport identities are recorded; detailed weapon loads
and combat stats are not complete. Profiles retain explicitly unknown stats.
Companies, other nations, unlisted upgrades, and A05/A06 combinations are not
enabled. `purchases` declares purchase context; it does not perform game-rule
validation. M07 will define the implemented rule coverage independently.

`npm run check:catalogs` checks schemas, relationships, all release fingerprints,
source identities, the independent M01 cost table and the publication file list.
The normal build runs this gate and publishes this directory's `public/` only;
source PDFs, fixtures, tools, reports and scratch files are never public assets.
