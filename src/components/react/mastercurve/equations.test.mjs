// Tests for dynamic modulus and the master curve. Run with:
//   node --experimental-strip-types --test src/components/react/mastercurve/equations.test.mjs
//
// Anchored to the printed answers of Huang (2004) Examples 2.16, 7.7, 7.8,
// 7.9 and 7.10 — including the intermediate constants, so a student checking
// their own arithmetic against the book can see exactly where they diverge.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  temperatureSusceptibility, penetrationIndex, viscosityFromPenetration,
  volumeFractions, dynamicModulusAI, stiffnessBonnaure,
  shiftFactor, reducedFrequency, buildMasterCurve, fitSigmoid, sigmoidAt,
  BETA_DEFAULT, BETA_RANGE,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* ───────────────── Example 7.7 — penetration index of a binder ──────────── */

test('Example 7.7 — a straight-run bitumen comes out at PI = 0', () => {
  // pen 22 at 25°C, ring-and-ball at 64°C.
  const A = temperatureSusceptibility(22, 25, 64);
  near(A, 0.04, 0.02, 'temperature susceptibility A');   // book: 0.04
  // The book rounds A to 0.04 and reports PI = 0. Carrying full precision
  // gives A = 0.0400 and PI = -0.003, i.e. zero to the book's precision.
  assert.ok(Math.abs(penetrationIndex(A)) < 0.02, 'PI is zero to the printed precision');
});

test('Example 7.10 — the recovered binder has PI just above 1', () => {
  // pen 50 at 25°C, ring-and-ball at 60°C.
  const A = temperatureSusceptibility(50, 25, 60);
  near(A, 0.0344, 0.01, 'A');                            // book: 0.0344
  near(penetrationIndex(A), 1.029, 0.02, 'PI');          // book: 1.029
});

test('a less temperature-susceptible binder has a higher PI', () => {
  const soft = penetrationIndex(temperatureSusceptibility(22, 25, 64));
  const stiff = penetrationIndex(temperatureSusceptibility(50, 25, 60));
  assert.ok(stiff > soft, 'lower susceptibility A gives higher PI');
});

/* ───────────────── Example 7.8 — volumetric composition ────────────────── */

test('Example 7.8 — volume fractions from weight and specific gravities', () => {
  // 5.5% bitumen by weight, G_mix 2.43, G_bitumen 1.02, G_agg 2.85.
  const v = volumeFractions(5.5, 2.43, 2.85, 1.02);
  near(v.Vg, 80.6, 0.01, 'aggregate volume');            // book: 80.6%
  near(v.Vb, 13.1, 0.01, 'bitumen volume');              // book: 13.1%
  near(v.Va, 100 - 80.6 - 13.1, 0.05, 'air voids by difference');
});

test('volume fractions always sum to 100', () => {
  const v = volumeFractions(6.2, 2.38, 2.70, 1.03);
  near(v.Vg + v.Vb + v.Va, 100, 1e-12, 'total');
});

/* ──────────── Example 7.10 — Asphalt Institute dynamic modulus ─────────── */

const EX710 = { f: 8, T: 77, p200: 6, va: 5, vb: 11 };

test('Eq. 7.28 — viscosity from the original penetration', () => {
  near(viscosityFromPenetration(70), 2.64, 0.01, 'lambda in 10^6 poise');  // book: 2.64
});

test('Example 7.10 — every intermediate constant matches the book', () => {
  const lambda = viscosityFromPenetration(70);
  const r = dynamicModulusAI({ ...EX710, lambda });
  const [b1, b2, b3, b4, b5] = r.beta;
  near(b5, 1.750, 0.002, 'beta5');
  near(b4, 5.313, 0.002, 'beta4');
  near(b3, 1.567, 0.005, 'beta3');
  near(b2, 4613.5, 0.005, 'beta2');
  near(b1, 0.705, 0.01, 'beta1');
  near(r.eStar, 5.07e5, 0.02, '|E*|');                   // book: 5.07 x 10^5 psi
});

test('Example 7.10 — the fines sensitivity the book tabulates', () => {
  const lambda = viscosityFromPenetration(70);
  const lo = dynamicModulusAI({ ...EX710, p200: 1, lambda });
  const hi = dynamicModulusAI({ ...EX710, p200: 11, lambda });
  near(lo.beta[2], 1.466, 0.005, 'beta3 at P200 = 1%');
  near(lo.beta[0], 0.604, 0.01, 'beta1 at P200 = 1%');
  near(lo.eStar, 4.0e5, 0.03, '|E*| at P200 = 1%');      // book: 4.0 x 10^5
  near(hi.beta[2], 1.668, 0.005, 'beta3 at P200 = 11%');
  near(hi.beta[0], 0.806, 0.01, 'beta1 at P200 = 11%');
  near(hi.eStar, 6.4e5, 0.03, '|E*| at P200 = 11%');     // book: 6.4 x 10^5
});

test('the modulus responds to temperature and frequency the right way', () => {
  const lambda = viscosityFromPenetration(70);
  const cold = dynamicModulusAI({ ...EX710, T: 40, lambda }).eStar;
  const hot = dynamicModulusAI({ ...EX710, T: 100, lambda }).eStar;
  assert.ok(cold > hot, 'asphalt is stiffer when cold');

  const slow = dynamicModulusAI({ ...EX710, f: 0.1, lambda }).eStar;
  const fast = dynamicModulusAI({ ...EX710, f: 25, lambda }).eStar;
  assert.ok(fast > slow, 'asphalt is stiffer under a faster load');
});

test('invalid input returns null rather than NaN', () => {
  assert.equal(dynamicModulusAI({ ...EX710, f: 0, lambda: 2.6 }), null);
  assert.equal(dynamicModulusAI({ ...EX710, vb: 0, lambda: 2.6 }), null);
});

/* ────────────── Example 7.9 — Shell / Bonnaure stiffness modulus ───────── */

test('Example 7.9 case 1 — all four constants match the book exactly', () => {
  // Sb = 6x10^6 N/m², Vb = 5%, Vg = 80%.
  const r = stiffnessBonnaure(6e6, 5, 80);
  const [b1, b2, b3, b4] = r.beta;
  near(b1, 10.504, 0.002, 'beta1');
  near(b2, 9.821, 0.002, 'beta2');
  near(b3, 0.462, 0.01, 'beta3');
  near(b4, 0.518, 0.01, 'beta4');
  assert.equal(r.branch, 'a', 'Sb in this range uses Eq. 7.25a');
});

test('Example 7.9 case 1 — the printed answer needs the wrong beta', () => {
  // Huang prints log Sm = 9.188 for this case. Eq. 7.25a as written reduces,
  // for log Sb < 8, to beta3(log Sb - 8) + beta2. The printed value can only
  // be obtained with beta4 in that position — which contradicts cases 2 and 3,
  // where beta3 is what reproduces the printed answers. This test records the
  // discrepancy rather than papering over it.
  const [, b2, b3, b4] = stiffnessBonnaure(6e6, 5, 80).beta;
  const x = Math.log10(6e6) - 8;
  near(b3 * x + b2, 9.256, 0.002, 'Eq. 7.25a as written');
  near(b4 * x + b2, 9.188, 0.002, "the book's printed intermediate");
});

test('Example 7.9 — the whole table of nine cases', () => {
  // Book column "Equation", Table 7.6. Cases 1-6 use Eq. 7.25a, 7-9 use 7.25b.
  // Eight of the nine reproduce to within 4%. Case 1 is the outlier, for the
  // reason the previous test documents, so it is checked at a wider tolerance.
  const cases = [
    [6e6, 5, 80, 1.5e9, 'a', 0.25],
    [6e6, 10, 85, 1.8e9, 'a', 0.04],
    [6e6, 40, 60, 8.3e7, 'a', 0.04],
    [1e8, 5, 80, 6.6e9, 'a', 0.04],
    [1e8, 10, 85, 1.1e10, 'a', 0.05],
    [1e8, 40, 60, 1.3e9, 'a', 0.04],
    [2e9, 5, 80, 2.8e10, 'b', 0.04],
    [2e9, 10, 85, 3.6e10, 'b', 0.04],
    [2e9, 40, 60, 1.5e10, 'b', 0.04],
  ];
  for (const [sb, vb, vg, expected, branch, tol] of cases) {
    const r = stiffnessBonnaure(sb, vb, vg);
    assert.equal(r.branch, branch, `Sb = ${sb} should use branch ${branch}`);
    near(r.sm, expected, tol, `Sm for Sb=${sb}, Vb=${vb}, Vg=${vg}`);
  }
});

test('a bitumen volume below about 0.75% has no Bonnaure solution', () => {
  // The beta3 logarithm needs 1.33Vb > 1.
  assert.equal(stiffnessBonnaure(1e8, 0.5, 85), null);
});

/* ─────────── Example 7.10 — the two methods disagree, on purpose ────────── */

test('Example 7.10 — AI and Shell differ by about 65% on the same mix', () => {
  // AI, from the original binder: 5.07 x 10^5 psi.
  const ai = dynamicModulusAI({ ...EX710, lambda: viscosityFromPenetration(70) }).eStar;
  // Shell, from the RECOVERED binder read off the nomograph as Sb = 10^7 N/m²,
  // with Vb = 11% and Vg = 100 − 11 − 5 = 84%.
  const shellNm2 = stiffnessBonnaure(1e7, 11, 84).sm;
  const shellPsi = shellNm2 / 6900;
  near(shellPsi, 3.1e5, 0.15, 'Shell Sm in psi');        // book: 3.1 x 10^5 psi

  const ratio = ai / shellPsi;
  assert.ok(ratio > 1.4 && ratio < 1.9,
    `the two published methods differ by ${((ratio - 1) * 100).toFixed(0)}% — that gap is the lesson`);
});

/* ─────────────── Example 2.16 — time-temperature superposition ─────────── */

test('Example 2.16 — the shift factor from 70°F to 50°F', () => {
  // beta = 0.113, so t_50 = 0.0055 t_70.
  near(shiftFactor(50, 70, 0.113), 0.0055, 0.02, 'a_T');
});

test('the shift factor is 1 at the reference temperature', () => {
  near(shiftFactor(70, 70, 0.113), 1, 1e-12, 'a_T at T = T0');
});

test('the default beta and its range are the FHWA values', () => {
  near(BETA_DEFAULT, 0.113, 1e-12, 'average beta');
  assert.deepEqual(BETA_RANGE, [0.061, 0.170]);
});

test('a hotter test behaves like a slower load at the reference', () => {
  // Above the reference the shift factor exceeds 1, so reduced frequency drops.
  const fr = reducedFrequency(10, 100, 70, 0.113);
  assert.ok(fr < 10, `10 Hz at 100°F reduces to ${fr.toFixed(3)} Hz at 70°F`);
  const frCold = reducedFrequency(10, 40, 70, 0.113);
  assert.ok(frCold > 10, 'and a colder test behaves like a faster load');
});

test('shifting is reversible', () => {
  const f = 5, T = 95, T0 = 70;
  const fr = reducedFrequency(f, T, T0);
  near(fr * shiftFactor(T, T0), f, 1e-9, 'round trip');
});

/* ──────────────────────────── The master curve ─────────────────────────── */

const BASE = { p200: 6, va: 5, vb: 11, lambda: viscosityFromPenetration(70) };
const TEMPS = [40, 55, 70, 85, 100, 115];
const FREQS = [0.1, 0.5, 1, 5, 10, 25];

test('the master curve spans decades of reduced frequency', () => {
  const pts = buildMasterCurve(BASE, TEMPS, FREQS, 70);
  assert.equal(pts.length, TEMPS.length * FREQS.length);
  const lo = pts[0].fr, hi = pts[pts.length - 1].fr;
  assert.ok(Math.log10(hi / lo) > 6,
    `shifting six isotherms should span many decades; got ${Math.log10(hi / lo).toFixed(1)}`);
  // Sorted by reduced frequency, as the chart needs.
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i].fr >= pts[i - 1].fr);
});

test('the sigmoid fits the shifted points and reports how well', () => {
  const pts = buildMasterCurve(BASE, TEMPS, FREQS, 70);
  const fit = fitSigmoid(pts);
  assert.ok(fit, 'a fit was returned');
  assert.ok(fit.alpha > 0, 'the curve rises with reduced frequency');
  assert.ok(fit.r2 > 0.95, `R2 = ${fit.r2.toFixed(3)}`);
});

test('the fitter recovers a sigmoid it did not generate', () => {
  // The regression test that matters most here. An earlier version of solve4
  // indexed row[i][i] — indexing into a NUMBER, which yields undefined and
  // turned every solution into NaN. Every Levenberg-Marquardt step was then
  // rejected and the fit silently returned its own seed, looking plausible
  // while optimizing nothing. Synthetic data with a known answer is the only
  // thing that catches that.
  // delta = 2.9 puts the lower asymptote at ~800 psi, inside the physical
  // range the fitter constrains to. A synthetic truth outside those bounds
  // would be testing the clamp, not the optimizer.
  const truth = { delta: 2.9, alpha: 3.3, beta: 0.5, gamma: -0.8 };
  const pts = [];
  for (let k = -8; k <= 8; k += 0.4) {
    const fr = Math.pow(10, k);
    const logE = truth.delta + truth.alpha / (1 + Math.exp(truth.beta + truth.gamma * k));
    pts.push({ T: 70, f: 1, fr, eStar: Math.pow(10, logE) });
  }
  const fit = fitSigmoid(pts);
  near(fit.delta, truth.delta, 0.01, 'delta');
  near(fit.alpha, truth.alpha, 0.01, 'alpha');
  near(fit.beta, truth.beta, 0.02, 'beta');
  near(fit.gamma, truth.gamma, 0.02, 'gamma');
  assert.ok(fit.r2 > 0.9999, `noise-free data must fit essentially exactly; R2 = ${fit.r2}`);
});

test('the fit does not simply hand back its seed', () => {
  // A second guard on the same failure mode, independent of the parameters.
  const pts = [];
  for (let k = -4; k <= 4; k += 0.4) {
    const fr = Math.pow(10, k);
    pts.push({ T: 70, f: 1, fr, eStar: Math.pow(10, 3.0 + 2.5 / (1 + Math.exp(-1.2 - 0.9 * k))) });
  }
  const fit = fitSigmoid(pts);
  // The seed is always beta = 0 and gamma = -0.5; a real fit moves off both.
  assert.ok(Math.abs(fit.beta) > 1e-6, 'beta moved off its seed');
  assert.ok(Math.abs(fit.gamma + 0.5) > 1e-6, 'gamma moved off its seed');
});

test('superposition holds for the AI model once the slope is fitted', () => {
  // With the shift slope chosen to suit the mix, the isotherms collapse
  // essentially onto one curve.
  let best = { rms: Infinity, beta: 0, r2: 0 };
  for (let b = 0.02; b <= 0.30; b += 0.002) {
    const f = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, b));
    if (f && f.rmsLog < best.rms) best = { rms: f.rmsLog, beta: b, r2: f.r2 };
  }
  assert.ok(best.r2 > 0.99, `a fitted slope should collapse cleanly; R2 = ${best.r2.toFixed(4)}`);
});

test('the textbook average slope costs real accuracy on this mix', () => {
  // The finding the tool exists to surface: 0.113 is an average over many
  // mixes, and using it instead of fitting costs about 25% in modulus here.
  const at113 = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, 0.113));
  const atLow = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, 0.061));
  assert.ok(atLow.rmsLog < at113.rmsLog,
    'the bottom of the FHWA range collapses better than its average');
  const pctAt113 = 100 * (Math.pow(10, at113.rmsLog) - 1);
  assert.ok(pctAt113 > 10,
    `the residual at 0.113 should be material, not negligible; got ${pctAt113.toFixed(1)}%`);
});

test('the best-collapsing slope sits inside the FHWA range', () => {
  let best = { rms: Infinity, beta: 0 };
  for (let b = 0.02; b <= 0.30; b += 0.002) {
    const f = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, b));
    if (f && f.rmsLog < best.rms) best = { rms: f.rmsLog, beta: b };
  }
  assert.ok(best.beta >= BETA_RANGE[0] * 0.9 && best.beta <= BETA_RANGE[1],
    `best beta ${best.beta.toFixed(3)} should be plausible for an asphalt mix`);
  assert.ok(best.beta < BETA_DEFAULT,
    `this mix prefers a flatter shift line than the 0.113 average; got ${best.beta.toFixed(3)}`);
});

test('the reference temperature moves the curve but not its shape', () => {
  const a = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70));
  const b = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 100));
  // Same asymptotes: changing the reference slides the curve along the
  // frequency axis, it does not change what the material can do.
  near(b.delta, a.delta, 0.10, 'lower asymptote');
  near(b.delta + b.alpha, a.delta + a.alpha, 0.10, 'upper asymptote');
});

test('a wrong shift slope degrades the collapse', () => {
  // Superposition is an assumption. Shifting with a slope far from the one the
  // data actually follows scatters the isotherms instead of collapsing them,
  // and the fit quality is what reveals it.
  const good = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, 0.113));
  const bad = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, 0.020));
  assert.ok(bad.rmsLog > good.rmsLog,
    `a bad shift slope should fit worse: ${bad.rmsLog.toFixed(4)} vs ${good.rmsLog.toFixed(4)}`);
});

test('too few points refuse to produce a fit', () => {
  assert.equal(fitSigmoid([{ T: 70, f: 1, fr: 1, eStar: 5e5 }]), null);
});

/* ─────────────── The asymptotes must stay physically possible ──────────── */

test('the fitted asymptotes never leave the physical range', () => {
  // Unbounded, the sigmoid drifts to a near-straight line with an enormous
  // alpha whenever the data does not span both plateaus — reporting a glassy
  // modulus of billions of psi while the residual still looks respectable.
  for (const b of [0.061, 0.113, 0.170]) {
    const fit = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, b));
    const lower = Math.pow(10, fit.delta);
    const upper = Math.pow(10, fit.delta + fit.alpha);
    assert.ok(lower >= 250 && lower <= 2.5e5, `lower asymptote ${lower.toFixed(0)} psi is not physical`);
    assert.ok(upper <= 5.05e6, `upper asymptote ${upper.toExponential(2)} psi exceeds the glassy limit`);
    assert.ok(fit.gamma < 0, 'modulus must rise with reduced frequency');
  }
});

test('an asymptote sitting on its bound is flagged as undetermined', () => {
  const fit = fitSigmoid(buildMasterCurve(BASE, TEMPS, FREQS, 70, 0.113));
  assert.ok(typeof fit.atBound.upper === 'boolean');
  assert.ok(typeof fit.atBound.lower === 'boolean');
  // This mix does not reach its glassy plateau over the modeled range, so the
  // upper asymptote is a bound rather than a measurement — and says so.
  assert.equal(fit.atBound.upper, true, 'the upper asymptote is pinned here');
});

test('data that DOES span both plateaus is not flagged', () => {
  const truth = { delta: 2.6, alpha: 3.0, beta: 0.5, gamma: -0.8 };
  const pts = [];
  for (let k = -8; k <= 8; k += 0.4) {
    const fr = Math.pow(10, k);
    pts.push({ T: 70, f: 1, fr,
      eStar: Math.pow(10, truth.delta + truth.alpha / (1 + Math.exp(truth.beta + truth.gamma * k))) });
  }
  const fit = fitSigmoid(pts);
  assert.equal(fit.atBound.upper, false, 'a fully spanned S determines its own asymptotes');
  near(fit.delta, truth.delta, 0.01, 'delta');
  near(fit.alpha, truth.alpha, 0.01, 'alpha');
});
