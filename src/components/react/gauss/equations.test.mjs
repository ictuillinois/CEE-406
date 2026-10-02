import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalAreas, normalTable, distributionStats, reliabilityDeviate, reliabilityTable } from './equations.ts';

const near = (actual, expected, tol = 2e-10) => assert.ok(Math.abs(actual - expected) < tol, `${actual} ≠ ${expected}`);

test('normal areas agree with independent erf reference values, including extreme tails', () => {
  // Reference values from Python math.erf / math.erfc (not this integrator).
  for (const [z, middle, right] of [
    [0, 0, .5], [.01, .003989356314631604, .4960106436853684],
    [1, .3413447460685429, .15865525393145707],
    [1.34, .4098773275355475, .09012267246445249],
    [1.96, .4750021048517795, .024997895148220435],
    [3.73, .4999042601147311, .00009573988526891472],
    [8, .4999999999999994, 6.220960574271819e-16],
  ]) {
    const a = normalAreas(z);
    near(a.middle, middle); near(a.right, right);
    if (z === 8) near(a.right / right, 1, 2e-8);
    near(a.left + a.right, 1); near(a.central, 2 * middle);
    near(normalAreas(-z).left, a.right);
    near(normalAreas(-z).middle, a.middle);
  }
});

test('Table 10.1 is a monotone 40 by 10 grid and reproduces reliable printed entries', () => {
  assert.equal(normalTable.length, 40);
  normalTable.forEach(row => assert.equal(row.length, 10));
  const values = normalTable.flat();
  values.slice(1).forEach((x, i) => assert.ok(x > values[i] && x < .5));
  assert.equal(normalTable[13][4].toFixed(6), '0.409877');
  assert.equal(normalTable[19][6].toFixed(6), '0.475002');
  assert.equal(normalTable[39][9].toFixed(6), '0.499967');
});

test('Huang Example 10.9 uses standard deviation sqrt(variance), giving approximately 9%', () => {
  const sd = Math.sqrt(125), z = (150 - 135) / sd;
  near(z, 1.3416407864998738);
  near(normalAreas(z).right, .08985624743949988);
  const stats = distributionStats(135, sd, 3, -.5);
  near(stats.mean, 135); near(stats.median, 135); near(stats.variance, 125);
  near(stats.covariance, -.5 * sd * 3); near(stats.cv, sd / 135 * 100);
  assert.equal(distributionStats(0, 1, 1, 0).cv, null);
  assert.equal(distributionStats(-1, 1, 1, 0).cv, null);
});

test('Table 11.15 preserves printed values and separately computes signed reliability quantiles', () => {
  assert.equal(reliabilityTable.length, 18);
  assert.equal(reliabilityDeviate(50), 0);
  near(reliabilityDeviate(95), -1.6448536269514722);
  near(reliabilityDeviate(99.99), -3.719016485455709, 2e-9);
  assert.equal(reliabilityTable.at(-1).printed, -3.750);
  assert.equal(reliabilityTable.find(t => t.reliability === 95).printed, -1.645);
  reliabilityTable.forEach(t => {
    assert.ok(t.computed <= 0);
    near(normalAreas(t.computed).right, t.reliability / 100);
  });
});

test('invalid inputs cannot silently yield plausible results', () => {
  for (const z of [NaN, Infinity, -Infinity, 8.01, -8.01]) assert.throws(() => normalAreas(z), RangeError);
  for (const r of [NaN, 0, 49.9, 100, Infinity]) assert.throws(() => reliabilityDeviate(r), RangeError);
  for (const args of [[0, 0, 1, 0], [0, -1, 1, 0], [0, 1, 0, 0], [0, 1, 1, 1.01], [NaN, 1, 1, 0]])
    assert.throws(() => distributionStats(...args), RangeError);
});
