import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import baseline from '../../tests/fixtures/northag/source-baseline.json';
import calibration from '../../tests/fixtures/northag/calibration.json';

it('keeps source evidence distinct from released game records and within reviewed pages', () => {
  expect(baseline.status).toBe('source-baseline-only');
  expect(new Set(baseline.sources.map(source => source.id)).size).toBe(baseline.sources.length);
  for (const source of baseline.sources) {
    expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(source.visuallyReviewedPdfPages.every(page => page > 0 && page <= source.pdfPages)).toBe(true);
  }
  expect(calibration.samples).toHaveLength(7);
  for (const item of [...calibration.samples, ...calibration.additionalArithmeticInputs]) {
    const source = baseline.sources.find(source => source.id === item.source.sourceId)!;
    expect(source.visuallyReviewedPdfPages).toContain(item.source.pdfPage);
    expect(item.source.pdfPage).toBe(item.source.printedPage + 1);
  }
});

it('preserves hand-calculated totals, one-each children and no advance reinforcement BR', () => {
  const inputs = new Map([...calibration.samples, ...calibration.additionalArithmeticInputs].map(item => [item.id, item]));
  for (const fragment of calibration.fragments) {
    const totals = fragment.selections.reduce((total, selection) => {
      const input = inputs.get(selection.sampleId)!;
      return {points: total.points + input.points * selection.count, br: total.br + input.br * selection.count};
    }, {points: 0, br: 0});
    expect(totals).toEqual(fragment.expected);
    expect(fragment.fullLegality).toBe('not-assessed');
  }
  const children = calibration.fragments[1]!.selections.filter(item => item.sampleId.startsWith('tcc/'));
  expect(children).toHaveLength(4);
  expect(children.every(item => item.count === 1)).toBe(true);
  const requests = calibration.fragments[2]!.requests!;
  expect(requests.free + requests.paid).toBe(requests.total);
  expect(requests.total).toBeLessThanOrEqual(requests.platoonCap);
  expect(calibration.fragments[2]!.expected.br).toBe(calibration.fragments[1]!.expected.br);
});

// Original PDFs are ignored and not required on CI. When supplied locally, a
// changed source must be explicitly re-reviewed rather than silently re-used.
for (const source of baseline.sources) {
  it.skipIf(!existsSync(source.path))(`matches the locally inspected ${source.id} fingerprint`, () => {
    expect(createHash('sha256').update(readFileSync(source.path)).digest('hex')).toBe(source.sha256);
  });
}
