import { describe, expect, it } from 'vitest';
import { createRosterDocument, executeRosterCommands, type RosterCommand } from '@battlegroup/core';
import { classicCatalogReleaseSchema } from '@battlegroup/classic-coldwar';
import rawRelease from '../../../../../packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json';
import { projectSectionAllowances } from './sectionAllowances';

const release = classicCatalogReleaseSchema.parse(rawRelease);
const identity = release.catalog.manifest.identity;
const topLevel = new Set(release.purchases.filter(access => access.kind === 'top-level').map(access => access.entryId));
const baseline = ['fhq', 't72-platoon', 'bmp1-platoon', 'brdm2-recon', 'zsu23-4', 'artillery-request-priority3'];

function roster(ids: string[], attachments: string[] = []) {
  const created = createRosterDocument({ rosterId: 'allowances', revision: 'initial', name: 'Allowance test', catalogRef: identity, armyListId: release.catalog.armyLists[0]!.armyListId, settings: { budgetPoints: 5000, gameSizeId: 'battalion', optionalRules: [] } }, release);
  if (!created.ok) throw Error('Creation failed');
  const commands: RosterCommand[] = [...ids, ...attachments].map((entryId, index) => ({
    kind: 'add', selection: {
      selectionId: 'selection-' + index, entryReference: { ...identity, localId: entryId }, optionChoices: [],
      parentSelectionId: index < ids.length ? null : 'selection-' + ids.indexOf('bmp1-platoon'),
      ...(index < ids.length ? { sectionId: release.catalog.entries.find(entry => entry.localId === entryId)!.sectionIds[0]! } : {}),
    },
  }));
  const edited = executeRosterCommands(created.document, commands, release, 'edited');
  if (!edited.ok) throw Error(JSON.stringify(edited.problems));
  return edited.document;
}

function allowances(ids: string[], attachments?: string[]) {
  return projectSectionAllowances(roster(ids, attachments), release.catalog, topLevel);
}

describe('section allowance presentation', () => {
  it('keeps unrestricted formation counts separate from paid local attachments', () => {
    const result = allowances(baseline, ['bmp1-platoon-medic', 'bmp1-platoon-fire-support']);
    expect(result.get('motor-rifle')).toEqual({ selected: 1, limits: [] });
    expect(result.get('hq')).toEqual({ selected: 1, limits: [] });
    expect(result.get('artillery')).toEqual({ selected: 0, limits: [] });
    expect(result.get('reconnaissance')!.limits).toEqual([{ used: 1, capacity: 7, shared: true }]);
  });

  it('respects overlapping pools and other sections rather than displaying independent caps', () => {
    const result = allowances(baseline);
    expect(result.get('specialist')!.limits).toEqual([{ used: 1, capacity: 7, shared: true }]);
    expect(result.get('logistics')!.limits).toEqual([{ used: 0, capacity: 4, shared: true }]);
    expect(result.get('additional-fire-support')!.limits).toEqual([{ used: 1, capacity: 1, shared: true }]);
    const moreRecon = allowances([...baseline, 'brdm2-recon']);
    expect(moreRecon.get('reconnaissance')!.selected).toBe(2);
    expect(moreRecon.get('specialist')!.limits[0]!.capacity).toBe(6);
  });

  it('retains counts and zero capacity for unsupported draft purchases', () => {
    const result = allowances(['brdm2-recon', 'brdm2-recon']);
    expect(result.get('reconnaissance')).toEqual({ selected: 2, limits: [{ used: 2, capacity: 0, shared: false }] });
  });

  it('reallocates flexible purchases so a narrowly eligible section is not undercounted', () => {
    // With HQ + tank choices, Logistics can use the tank pool, preserving HQ's
    // only Additional Fire Support choice. A fixed allocation subtraction fails.
    const result = allowances(['fhq', 't72-platoon', 'ambulance']);
    expect(result.get('additional-fire-support')!.limits[0]!.capacity).toBe(1);
  });

  it('includes exempt purchases in selected count without consuming a choice', () => {
    const free = release.catalog.entries.find(entry => entry.sectionIds.includes('additional-fire-support') && topLevel.has(entry.localId) && !entry.resourceConsumptions?.length)!;
    const result = allowances(['fhq', 'artillery-request-priority3', free.localId]);
    expect(result.get('additional-fire-support')).toEqual({ selected: 2, limits: [{ used: 1, capacity: 1, shared: true }] });
  });
});
