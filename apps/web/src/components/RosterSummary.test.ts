import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RosterSummary } from './RosterSummary';

const totals = { points: { knownSubtotal: 398, complete: true }, br: { knownSubtotal: 23, complete: true } };
const statistics = [
  { statId: 'officers', label: 'Ruleset officer label', value: 1, status: 'covered' as const },
  { statId: 'scout-weight', label: 'Ruleset scout label', value: 2, status: 'covered' as const },
];

describe('shared roster summary', () => {
  it('uses common statistic IDs rather than ruleset labels in both screen and print', () => {
    for (const print of [false, true]) {
      const html = renderToStaticMarkup(createElement(RosterSummary, { totals, statistics, budget: 500, print }));
      expect(html).toContain('Officers');
      expect(html).toContain('Scouts');
      expect(html).toContain((print ? 'print-' : '') + 'officers-total">1<');
      expect(html).toContain((print ? 'print-' : '') + 'scouts-total">2<');
      expect(html).toContain('/ 500');
      expect(html).toContain((print ? 'print-' : '') + 'remaining">102<');
      expect(html).not.toContain('Ruleset scout label');
    }
  });

  it('preserves known zero statistics without inventing values for missing ones', () => {
    const html = renderToStaticMarkup(createElement(RosterSummary, { totals, budget: 500, statistics: [{ ...statistics[0]!, value: 0 }] }));
    expect(html).toContain('officers-total">0<');
    expect(html).toContain('scouts-total">—<');
  });

  it('keeps overspending visible and does not give unknown totals a remaining budget', () => {
    const over = renderToStaticMarkup(createElement(RosterSummary, { totals, statistics, budget: 397 }));
    expect(over).toContain('remaining">-1<');
    expect(over).toContain('points-metric--over');
    expect(over).not.toContain('role="meter"');
    const partial = renderToStaticMarkup(createElement(RosterSummary, { totals: { ...totals, points: { knownSubtotal: 398, complete: false } }, statistics, budget: 500 }));
    expect(partial).toContain('Known subtotal 398');
    expect(partial).toContain('remaining">—<');
    expect(partial).not.toContain('role="meter"');
  });
});
