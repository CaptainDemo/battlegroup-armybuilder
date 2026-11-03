import { en, type EnglishDictionary } from './en';

export type Dictionary = EnglishDictionary;

/** Active dictionary. English first; a Chinese dictionary entry can be added later as a sibling. */
export const dictionary: Dictionary = en;

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node !== null && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);
}

/** Translate a dot-path dictionary key; missing keys fall back to the key itself. */
export function t(key: string): string {
  const value = lookup(key);
  return typeof value === 'string' ? value : key;
}
