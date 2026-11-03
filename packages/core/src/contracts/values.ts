import { z } from 'zod';
import { localIdSchema } from './primitives';

/**
 * Known / unknown / not-applicable value states and quantity limits
 * (docs/architecture.md §4.5).
 *
 * `known(0)`, `unknown(reason)` and `not_applicable(reason)` are three
 * distinguishable states. A bare number is never a valid tracked value: an
 * unknown cost cannot decay to 0 just because 0 is convenient, and "field
 * does not apply to this unit" is not the same as "value not recorded yet".
 */

export const knownValueSchema = z.strictObject({
  state: z.literal('known'),
  value: z.number(),
});
export const unknownValueSchema = z.strictObject({
  state: z.literal('unknown'),
  reason: z.string().min(1),
});
export const notApplicableValueSchema = z.strictObject({
  state: z.literal('not_applicable'),
  reason: z.string().min(1),
});

export const trackedValueSchema = z.discriminatedUnion('state', [
  knownValueSchema,
  unknownValueSchema,
  notApplicableValueSchema,
]);
export type TrackedValue = z.infer<typeof trackedValueSchema>;

export function knownValue(value: number): TrackedValue {
  return { state: 'known', value };
}

export function unknownValue(reason: string): TrackedValue {
  return { state: 'unknown', reason };
}

export function notApplicableValue(reason: string): TrackedValue {
  return { state: 'not_applicable', reason };
}

/**
 * Tracked non-numeric value (ruleset-defined token, e.g. a training level).
 * Core treats the token as opaque; the ruleset schema validates the enum.
 * Used so a training level can be known, explicitly unverified, or genuinely
 * not applicable — never guessed from a name, note or numeric BR.
 */
export const trackedTokenSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('known'), value: z.string().min(1) }),
  z.strictObject({ state: z.literal('unknown'), reason: z.string().min(1) }),
  z.strictObject({ state: z.literal('not_applicable'), reason: z.string().min(1) }),
]);
export type TrackedToken = z.infer<typeof trackedTokenSchema>;

export function knownToken(value: string): TrackedToken {
  return { state: 'known', value };
}

export function unknownToken(reason: string): TrackedToken {
  return { state: 'unknown', reason };
}

export function notApplicableToken(reason: string): TrackedToken {
  return { state: 'not_applicable', reason };
}

/**
 * Quantity limits distinguish a finite maximum, unlimited, unknown and
 * not-applicable. A single `null` cannot express all four (see the NORTHAG
 * reference review: `maxSelections: null` was ambiguous between "no limit"
 * and "not recorded").
 */
export const quantityLimitSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('limited'),
    max: z.number().int().nonnegative(),
  }),
  z.strictObject({ kind: z.literal('unlimited') }),
  z.strictObject({ kind: z.literal('unknown'), reason: z.string().min(1) }),
  z.strictObject({ kind: z.literal('not_applicable'), reason: z.string().min(1) }),
]);
export type QuantityLimit = z.infer<typeof quantityLimitSchema>;

export function limited(max: number): QuantityLimit {
  return { kind: 'limited', max };
}

export const unlimited: QuantityLimit = { kind: 'unlimited' };

/**
 * Cost delta of an option: Points and BR are tracked separately and each side
 * keeps its own known/unknown/not-applicable state. Deltas may be zero
 * (free replacement) or negative (downgrade, e.g. Ambulance -> Heavy Truck
 * -5 Points / -1 BR). A Points-only printed option has a *known* BR delta of
 * 0 (user clarification A09); a missing base BR on an entry stays unknown.
 *
 * Negative deltas never license negative purchase quantities — quantities and
 * capacities are validated as positive integers by their own schemas.
 */
export const costDeltaSchema = z.strictObject({
  points: trackedValueSchema,
  br: trackedValueSchema,
});
export type CostDelta = z.infer<typeof costDeltaSchema>;

/** Resource kinds are ruleset-defined free identifiers (see catalog contracts). */
export const resourceKindSchema = localIdSchema;
export type ResourceKind = z.infer<typeof resourceKindSchema>;
