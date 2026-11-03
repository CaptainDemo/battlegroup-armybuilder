import { z } from 'zod';

/**
 * Classic Cold War training levels (BASE PDF p.44 / printed p.43; CW PDF p.29).
 *
 * i = Inexperienced, r = Regular, v = Veteran, e = Elite. The letter is a
 * separate dimension from the numeric BR: 'e' is part of the system even
 * though the first sample batch only buys i and r. These tokens belong to
 * Classic only — NORTHAG's c/p/e never shares or converts into them, and
 * core deliberately has no training enumeration at all.
 */
export const classicTrainingLevelSchema = z.enum(['i', 'r', 'v', 'e']);
export type ClassicTrainingLevel = z.infer<typeof classicTrainingLevelSchema>;

export const classicTrainingLevelLabels: Readonly<Record<ClassicTrainingLevel, string>> = {
  i: 'Inexperienced',
  r: 'Regular',
  v: 'Veteran',
  e: 'Elite',
};

export function isClassicTrainingLevel(value: string): value is ClassicTrainingLevel {
  return classicTrainingLevelSchema.safeParse(value).success;
}
