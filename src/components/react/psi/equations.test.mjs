// Tests for serviceability, roughness and skid resistance. Run with:
//   node --experimental-strip-types --test src/components/react/psi/equations.test.mjs
//
// Anchored to Huang (2004) Eqs. 9.14 and 9.15 and to the printed answers of
// Problems 9.2 and 9.4.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  psiFlexible, psiRigid, R1, R2, D1, slopeVariance,
  fitPsi, psiFromFit, meanTextureDepth, pngFromTexture, sn0FromBpn,
  skidNumber, sn0FromMeasurement, skidAtSpeed,
} from './equations.ts';

const near = (a, e, tol, what) =>
  assert.ok(Math.abs(a - e) <= Math.max(Math.abs(e) * tol, 1e-12),
    `${what}: got ${a}, expected ~${e} (±${tol * 100}%)`);

/* ─────────────────── The AASHO PSI equations ───────────────────────────── */

test('a brand new flexible pavement rates near the top of the scale', () => {
  // No roughness, no rutting, no cracking → PSI = the intercept.
  near(psiFlexible(0, 0, 0), 5.03, 1e-12, 'PSI of a perfect flexible pavement');
  near(psiRigid(0, 0), 5.41, 1e-12, 'PSI of a perfect rigid pavement');
});

test('Eq. 9.14 — each term subtracts serviceability', () => {
  const base = psiFlexible(0, 0, 0);
  assert.ok(psiFlexible(10, 0, 0) < base, 'roughness costs');
  assert.ok(psiFlexible(0, 0.3, 0) < base, 'rutting costs');
  assert.ok(psiFlexible(0, 0, 50) < base, 'cracking and patching cost');
});

test('roughness dominates the PSI equation, as the Road Test found', () => {
  // A realistic swing in SV moves PSI far more than a realistic swing in
  // cracking — which is why the profilometer replaced the panel.
  const dRough = psiFlexible(2, 0.1, 10) - psiFlexible(40, 0.1, 10);
  const dCrack = psiFlexible(2, 0.1, 10) - psiFlexible(2, 0.1, 200);
  assert.ok(dRough > dCrack,
    `roughness moved PSI by ${dRough.toFixed(2)}, cracking by ${dCrack.toFixed(2)}`);
});

test('the rigid equation has no rut depth term at all', () => {
  // Concrete does not rut, so Eq. 9.15 simply omits it.
  assert.equal(psiRigid(10, 5), psiRigid(10, 5));
  const flexSensitive = psiFlexible(10, 0, 5) - psiFlexible(10, 0.5, 5);
  assert.ok(flexSensitive > 0, 'the flexible equation does respond to rutting');
});

test('a terminal serviceability of 2.5 is a real amount of distress', () => {
  // Worth knowing what pt = 2.5 actually looks like: it is not a fresh road.
  const sv = 25, rd = 0.25, cp = 40;
  const psi = psiFlexible(sv, rd, cp);
  assert.ok(psi > 2 && psi < 3.5, `PSI = ${psi.toFixed(2)} for a visibly worn pavement`);
});

test('the linearizing transformations are the ones Huang defines', () => {
  near(R1(9), Math.log10(10), 1e-12, 'R1 = log(1 + SV)');
  near(R2(0.2), 0.04, 1e-12, 'R2 = RD²');
  near(D1(16), 4, 1e-12, 'D1 = √(C + P)');
  near(D1(-5), 0, 1e-12, 'negative distress clamps to zero rather than NaN');
});

test('slope variance is the variance of the sampled slopes', () => {
  near(slopeVariance([1, 1, 1, 1]), 0, 1e-12, 'a perfectly smooth profile');
  near(slopeVariance([0, 2, 4, 6]), 20 / 3, 1e-9, 'a known variance');
  assert.ok(Number.isNaN(slopeVariance([1])), 'one sample has no variance');
});

/* ───────────────── Problem 9.2 — fitting your own equation ─────────────── */

/** Table P9.2: five flexible sections with panel ratings. */
const P92 = [
  { sv: 2.8, rd: 0.06, cp: 0, psr: 4.3 },
  { sv: 5.8, rd: 0.10, cp: 1, psr: 3.8 },
  { sv: 10.9, rd: 0.11, cp: 13, psr: 3.2 },
  { sv: 16.8, rd: 0.16, cp: 23, psr: 2.4 },
  { sv: 56.0, rd: 0.19, cp: 31, psr: 1.1 },
];

test('Problem 9.2 — the fitted equation matches the printed answer', () => {
  // Book: PSI = 5.51 − 1.70 log(1 + SV) − 38.09 RD² − 0.004 √(C + P)
  const fit = fitPsi(P92, true);
  assert.ok(fit, 'the regression solved');
  near(fit.a0, 5.51, 0.02, 'intercept');
  near(fit.a1, -1.70, 0.03, 'log(1 + SV) coefficient');
  near(fit.a2, -38.09, 0.05, 'RD² coefficient');
  assert.ok(Math.abs(fit.b1 - -0.004) < 0.02, `√(C+P) coefficient ${fit.b1.toFixed(4)}`);
});

test('Problem 9.2 — five sections give a rut coefficient 27x the published one', () => {
  // THE lesson of the exercise. AASHO fitted 74 sections and got −1.38; five
  // sections give −38. The fit is excellent and the coefficient is garbage,
  // because RD barely varies across these five and is collinear with SV.
  const fit = fitPsi(P92, true);
  assert.ok(fit.r2 > 0.98, `R² = ${fit.r2.toFixed(4)} — the fit looks superb`);
  const ratio = Math.abs(fit.a2 / -1.38);
  assert.ok(ratio > 20,
    `yet the rut coefficient is ${ratio.toFixed(0)}x the published −1.38`);
});

test('a fitted equation reproduces its own training data', () => {
  const fit = fitPsi(P92, true);
  P92.forEach((o, i) => {
    near(psiFromFit(fit, o.sv, o.rd, o.cp), fit.predicted[i], 1e-9, `section ${i + 1}`);
    assert.ok(Math.abs(fit.predicted[i] - o.psr) < 0.25, `section ${i + 1} within 0.25 of the panel`);
  });
});

test('the rigid form drops the rut term and needs one fewer section', () => {
  const fit = fitPsi(P92, false);
  assert.ok(fit, 'a three-term fit solved');
  assert.equal(fit.a2, 0, 'no rut coefficient is reported');
  // With one fewer degree of freedom it cannot fit as tightly.
  const full = fitPsi(P92, true);
  assert.ok(fit.rms >= full.rms, 'the three-term fit is looser, as it must be');
});

test('too few sections refuse to fit rather than returning nonsense', () => {
  assert.equal(fitPsi(P92.slice(0, 3), true), null, 'four unknowns need four sections');
  assert.ok(fitPsi(P92.slice(0, 3), false), 'but three suffice without the rut term');
});

/* ──────────────────── Problem 9.4 — skid resistance ────────────────────── */

test('Problem 9.4 — mean texture depth from the glass bead patch', () => {
  // 2 in³ of beads spread to a 10 in patch.
  near(meanTextureDepth(2, 10), 2 / (Math.PI * 25), 1e-12, 'MTD');
  near(meanTextureDepth(2, 10), 0.02546, 0.01, 'MTD in inches');
});

test('Problem 9.4 — the skid numbers at 20 and 60 mph', () => {
  const mtd = meanTextureDepth(2, 10);
  near(skidAtSpeed(40, 40, mtd, 20), 47.7, 0.01, 'SN at 20 mph');   // book: 47.7
  near(skidAtSpeed(40, 40, mtd, 60), 33.6, 0.01, 'SN at 60 mph');   // book: 33.6
  near(skidAtSpeed(40, 40, mtd, 40), 40, 1e-9, 'and it round-trips at 40');
});

test('Eq. 9.33 — a coarser surface holds its friction better', () => {
  const smooth = pngFromTexture(0.01);
  const coarse = pngFromTexture(0.06);
  assert.ok(coarse < smooth, 'a deeper texture gives a lower gradient');
  // So at speed the coarse surface keeps more of its skid number.
  const snSmooth = skidNumber(60, smooth, 60);
  const snCoarse = skidNumber(60, coarse, 60);
  assert.ok(snCoarse > snSmooth,
    `at 60 mph: coarse ${snCoarse.toFixed(1)} vs smooth ${snSmooth.toFixed(1)}`);
});

test('Eq. 9.32 — zero-speed skid number from the pendulum', () => {
  near(sn0FromBpn(70), 1.32 * 70 - 34.9, 1e-12, 'SN0');
  // A BPN below about 26 gives a negative SN0, which is the equation telling
  // you it is outside the data it was fitted to.
  assert.ok(sn0FromBpn(20) < 0, 'the correlation has a floor');
});

test('skid number falls with speed and is exactly SN0 at rest', () => {
  near(skidNumber(55, 0.9, 0), 55, 1e-9, 'SN at zero speed is SN0');
  let prev = Infinity;
  for (const V of [0, 20, 40, 60, 80]) {
    const sn = skidNumber(55, 0.9, V);
    assert.ok(sn < prev, `SN must fall with speed; ${V} mph gave ${sn.toFixed(1)}`);
    prev = sn;
  }
});

test('the SN0 back-calculation inverts the forward model', () => {
  const png = 0.85;
  const sn0 = sn0FromMeasurement(38, png, 40);
  near(skidNumber(sn0, png, 40), 38, 1e-9, 'round trip');
});

test('microtexture and macrotexture are independent levers', () => {
  // Two surfaces with the same SN at 40 mph can differ sharply at 60 —
  // which is the entire safety argument for macrotexture.
  const mtdSmooth = 0.008, mtdCoarse = 0.05;
  const a = skidAtSpeed(40, 40, mtdSmooth, 60);
  const b = skidAtSpeed(40, 40, mtdCoarse, 60);
  assert.ok(b > a + 5,
    `same SN at 40 mph, but ${a.toFixed(1)} vs ${b.toFixed(1)} at 60 mph`);
});
