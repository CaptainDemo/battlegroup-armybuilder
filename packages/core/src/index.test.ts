import { describe, expect, it } from 'vitest';
import { corePackageId } from './index';

describe('@battlegroup/core entry (M02 boundary)', () => {
  it('imports in a DOM-free Node environment', () => {
    expect(corePackageId).toBe('@battlegroup/core');
  });
});
