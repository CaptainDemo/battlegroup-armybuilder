import { z } from 'zod';
import { localIdSchema, trackedValueSchema } from '@battlegroup/core';
import { sourceReferenceSchema } from '@battlegroup/core';

/**
 * Classic Cold War unit profiles — the ruleset-specific combat-stat boundary.
 *
 * M01 fingerprinted the Soviet AFV data cards but did NOT verify any stats,
 * so the sample data carries every stat as `unknown` with its reason. The
 * schema makes that honest state representable and forbids the silent
 * zero-fill that "missing armour = 0" would produce. Stats are Classic's
 * own records: AirLand and NORTHAG define their own profile schemas even
 * for the same real-world vehicle.
 */
export const classicProfileStatsSchema = z.strictObject({
  frontArmour: trackedValueSchema,
  sideArmour: trackedValueSchema,
  rearArmour: trackedValueSchema,
  topArmour: trackedValueSchema,
  hits: trackedValueSchema,
});
export type ClassicProfileStats = z.infer<typeof classicProfileStatsSchema>;

export const classicUnitProfileSchema = z.strictObject({
  localId: localIdSchema,
  name: z.string().min(1),
  stats: classicProfileStatsSchema,
  /** Named special rules (ruleset-defined strings), e.g. "slow". */
  specialRules: z.array(localIdSchema).optional(),
  sourceRefs: z.array(sourceReferenceSchema).min(1),
});
export type ClassicUnitProfile = z.infer<typeof classicUnitProfileSchema>;

/** Convenience: the honest state of every M01 profile stat. */
export function unverifiedStats(reason: string): ClassicProfileStats {
  return {
    frontArmour: { state: 'unknown', reason },
    sideArmour: { state: 'unknown', reason },
    rearArmour: { state: 'unknown', reason },
    topArmour: { state: 'unknown', reason },
    hits: { state: 'unknown', reason },
  };
}
