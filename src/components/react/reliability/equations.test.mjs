// Tests for the reliability calculations. Run with:
//   node --experimental-strip-types --test src/components/react/reliability/equations.test.mjs
//
// Checked against the printed answers of Huang (2004) Examples 10.11, 10.12
// and 10.13, pp. 452-456.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trafficPrediction, performancePrediction, structuralNumber, varStructuralNumber,
  logWtOf, reliability, rosenblueth, monteCarlo, reliabilityVsSN, LOG10E_SQ,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-9),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* Example 10.11 inputs — 55% 20-kip singles (EALF 1.51), 45% 36-kip tandems
 * (EALF 1.38), so Σ pᵢFᵢ = 1.452. */
const TRAFFIC = {
  sumPF: 0.55 * 1.51 + 0.45 * 1.38, cvSumPF: 0.35,
  ADT0: 5000, cvADT: 0.15,
  r: 0.06, cvR: 0.10,
  T: 0.20, cvT: 0.10,
  A: 2.5, cvA: 0.10,
  D: 0.50, cvD: 0,
  L: 1.00, cvL: 0,
  Y: 20,
};

/* Example 10.12 inputs — Table 10.3. */
const PERF = {
  layers: [
    { name: 'HMA surface', a: 0.42, cvA: 0.10, D: 8.0, cvD: 0.10, m: 1.0, cvM: 0 },
    { name: 'Base', a: 0.14, cvA: 0.143, D: 7.0, cvD: 0.10, m: 1.2, cvM: 0.10 },
    { name: 'Subbase', a: 0.08, cvA: 0.182, D: 11.0, cvD: 0.10, m: 1.2, cvM: 0.10 },
  ],
  p0: 4.6, cvP0: 0.067,
  pt: 2.0,
  MR: 5700, cvMR: 0.15,
};

test('the log-e² factor is the 0.1886 the book uses', () => {
  near(LOG10E_SQ, 0.1886, 0.001, '(log e)²');
});

/* ───────────────────────────── Example 10.11 ────────────────────────────── */

test('Example 10.11 — traffic prediction mean and variance', () => {
  const t = trafficPrediction(TRAFFIC);
  near(t.G, 2.104, 0.002, 'growth factor G');
  near(t.logWT, 7.445, 0.002, 'log W_T');
  near(t.varLogWT, 0.033, 0.06, 'V[log W_T]');
});

test('Example 10.11 — the axle mix dominates the traffic variance', () => {
  const t = trafficPrediction(TRAFFIC);
  const top = [...t.terms].sort((a, b) => b.variance - a.variance)[0];
  assert.match(top.name, /pᵢFᵢ/, 'Σ pF is the largest single contributor');
  // Book: 0.1886 × 0.122 of a total 0.1886 × 0.172.
  near(top.share, 0.122 / 0.172, 0.05, 'share of the total variance');
});

test('a deterministic input contributes nothing', () => {
  const t = trafficPrediction(TRAFFIC);
  const dTerm = t.terms.find(x => x.name.startsWith('Directional'));
  near(dTerm.variance, 0, 1e-12, 'V from a CV of zero');
});

/* ───────────────────────────── Example 10.12 ────────────────────────────── */

test('Example 10.12 — structural number and its variance', () => {
  near(structuralNumber(PERF.layers), 5.592, 0.001, 'SN');
  near(varStructuralNumber(PERF.layers), 0.341, 0.02, 'V[SN]');
});

test('Example 10.12 — performance prediction mean and variance', () => {
  const p = performancePrediction(PERF);
  near(p.logWt, 8.074, 0.002, 'log W_t');
  near(p.varLogWt, 0.163, 0.05, 'V[log W_t]');
  // Book: 0.128 from SN, 0.012 from p0, 0.023 from MR.
  near(p.terms[0].variance, 0.128, 0.06, 'V from SN');
  near(p.terms[1].variance, 0.012, 0.10, 'V from p0');
  near(p.terms[2].variance, 0.023, 0.06, 'V from MR');
});

test('the AASHTO equation is reproduced at the book values', () => {
  near(logWtOf(5.592, 5700, 4.6, 2.0), 8.074, 0.002, 'log W_t');
});

/* ───────────────────────────── Example 10.13 ────────────────────────────── */

test('Example 10.13 — reliability from the two predictions', () => {
  const t = trafficPrediction(TRAFFIC);
  const p = performancePrediction(PERF);
  const r = reliability(t.logWT, t.varLogWT, p.logWt, p.varLogWt);
  near(r.meanLogDr, -0.629, 0.01, 'mean of log D_r');
  near(r.varLogDr, 0.196, 0.05, 'V[log D_r]');
  near(r.z, 1.42, 0.03, 'z');
  near(r.R, 92.2, 0.01, 'reliability %');
});

test('a thicker pavement is more reliable', () => {
  const t = trafficPrediction(TRAFFIC);
  const thick = {
    ...PERF,
    layers: PERF.layers.map(l => ({ ...l, D: l.D * 1.3 })),
  };
  const p = performancePrediction(thick);
  const r = reliability(t.logWT, t.varLogWT, p.logWt, p.varLogWt);
  assert.ok(r.R > 92.2, `R rose to ${r.R.toFixed(1)}% when the section grew 30%`);
});

test('more variable traffic costs reliability even at the same mean', () => {
  const p = performancePrediction(PERF);
  const base = trafficPrediction(TRAFFIC);
  const noisy = trafficPrediction({ ...TRAFFIC, cvSumPF: 0.70 });
  near(noisy.logWT, base.logWT, 1e-12, 'the mean is unchanged');
  const rBase = reliability(base.logWT, base.varLogWT, p.logWt, p.varLogWt);
  const rNoisy = reliability(noisy.logWT, noisy.varLogWT, p.logWt, p.varLogWt);
  assert.ok(rNoisy.R < rBase.R,
    `doubling the axle-mix CV dropped R from ${rBase.R.toFixed(1)}% to ${rNoisy.R.toFixed(1)}%`);
});

/* ────────────────────── Rosenblueth and Monte Carlo ─────────────────────── */

test('Rosenblueth reproduces the exact variance of a linear function', () => {
  // For f = 2x + 3y the first-order expansion is exact, and so is Rosenblueth.
  const res = rosenblueth([10, 5], [1, 2], ([x, y]) => 2 * x + 3 * y);
  near(res.mean, 35, 1e-12, 'mean');
  near(res.variance, 4 * 1 + 9 * 4, 1e-9, 'variance');   // 2²·1² + 3²·2²
});

test('Rosenblueth catches curvature that a first-order expansion misses', () => {
  // f = x², mean 0, sd 1. Taylor about the mean gives V = (2·0)²·1 = 0;
  // the true variance is 2, and Rosenblueth returns the mean shift at least.
  const res = rosenblueth([0], [1], ([x]) => x * x);
  near(res.mean, 1, 1e-12, 'Rosenblueth recovers E[x²] = 1 where Taylor gives 0');
});

test('Rosenblueth agrees with Taylor on the performance equation', () => {
  const p = performancePrediction(PERF);
  // Three variables: SN, p0, MR — the same three Eq. 10.43 expands about.
  const res = rosenblueth(
    [p.SN, PERF.p0, PERF.MR],
    [Math.sqrt(p.varSN), PERF.p0 * PERF.cvP0, PERF.MR * PERF.cvMR],
    ([SN, p0, MR]) => logWtOf(SN, MR, p0, PERF.pt)
  );
  // The design equation is mildly curved over ±1σ, so the two agree to about
  // 10% — close enough to trust, far enough apart to be worth discussing.
  near(res.variance, p.varLogWt, 0.15, 'Rosenblueth vs Taylor variance');
});

test('Monte Carlo lands on the same reliability as the closed form', () => {
  const mc = monteCarlo(TRAFFIC, PERF, 8000, 406);
  assert.ok(mc, 'Monte Carlo ran');
  near(mc.meanLogDr, -0.629, 0.06, 'mean log D_r');
  // The closed form says 92.2%; sampling the full nonlinear equation should
  // agree within a couple of points.
  assert.ok(Math.abs(mc.R - 92.2) < 3.5,
    `Monte Carlo R = ${mc.R.toFixed(1)}% against the closed form's 92.2%`);
});

test('Monte Carlo is reproducible from its seed', () => {
  const a = monteCarlo(TRAFFIC, PERF, 1500, 42);
  const b = monteCarlo(TRAFFIC, PERF, 1500, 42);
  const c = monteCarlo(TRAFFIC, PERF, 1500, 43);
  assert.equal(a.R, b.R, 'the same seed gives the same answer');
  assert.notEqual(a.R, c.R, 'a different seed gives a different answer');
});

/* ─────────────────────────── Reliability vs SN ──────────────────────────── */

test('the reliability-vs-SN curve rises monotonically', () => {
  const pts = reliabilityVsSN(TRAFFIC, PERF, [0.7, 0.85, 1.0, 1.15, 1.3, 1.5]);
  assert.equal(pts.length, 6);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].SN > pts[i - 1].SN, 'SN increases');
    assert.ok(pts[i].R >= pts[i - 1].R - 1e-9, 'R does not fall as SN grows');
  }
});
