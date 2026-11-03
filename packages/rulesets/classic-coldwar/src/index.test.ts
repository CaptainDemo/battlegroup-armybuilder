import { describe, expect, it } from 'vitest';
import { corePackageId } from '@battlegroup/core';
import { classicColdWarRuleset } from './index';

describe('@battlegroup/classic-coldwar entry (M02 boundary)', () => {
  it('imports in a DOM-free Node environment together with core', () => {
    expect(classicColdWarRuleset.id).toBe('classic-coldwar');
    expect(classicColdWarRuleset.corePackageId).toBe(corePackageId);
  });

  it('reports partial development status while rule coverage is incomplete', () => {
    expect(classicColdWarRuleset.status).toBe('in-development');
    expect(classicColdWarRuleset.label).toBe('Classic Cold War');
  });
});
