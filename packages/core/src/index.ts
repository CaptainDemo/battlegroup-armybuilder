/**
 * Package identity for the ruleset-agnostic core.
 *
 * M02 only establishes the importable package boundary: core declares no
 * runtime dependencies and never imports React, browser APIs or a concrete
 * ruleset module. Domain contracts (roster trees, catalog shells, evaluation
 * protocol) are introduced by M03 and must not be pre-written here.
 */
export const corePackageId = '@battlegroup/core' as const;
