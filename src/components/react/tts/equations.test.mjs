import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DATA, REPLICATES } from './data.ts';
import {
  parseData, validateData, dataCSV, zeroShifts, temperatures, shiftAt, shiftData, rebaseShifts,
  fitShiftLaw, shiftLawAt, predictModulus, sigmoidLog, fitSigmoid, overlapError, solveLinear, nnls, spectrumAt, fitSpectrum, relaxationAt, creepModel, creepAt, WLF_C2_MAX,
} from './equations.ts';
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const manual = { '-10': 4.25, 4: 2.25, 21: 0, 37: -1.8, 54: -3.25 };

test('default data preserve and average the reference script replicates in MPa/degrees', () => {
  assert.equal(DEFAULT_DATA.length, 30);
  assert.deepEqual(temperatures(DEFAULT_DATA), [-10, 4, 21, 37, 54]);
  near(DEFAULT_DATA[0].modulus, (27472 + 26649 + 26582) / 3);
  near(DEFAULT_DATA[29].phase, (22.87 + 24.16 + 23.33) / 3);
  assert.equal(REPLICATES.Estar3[29], 203);
  DEFAULT_DATA.forEach((p, i) => {
    near(p.modulus, (REPLICATES.Estar1[i] + REPLICATES.Estar2[i] + REPLICATES.Estar3[i]) / 3);
    near(p.phase, (REPLICATES.Delta1[i] + REPLICATES.Delta2[i] + REPLICATES.Delta3[i]) / 3);
  });
  assert.equal(new Set(DEFAULT_DATA.map(p => `${p.temperature}/${p.frequency}`)).size, 30,
    'exactly one mean modulus/phase pair per temperature and frequency');
  validateData(DEFAULT_DATA);
  assert.ok(Object.values(zeroShifts(DEFAULT_DATA)).every(s => s === 0));
});
test('CSV round trips all readings, including missing phase and replicates', () => {
  assert.deepEqual(parseData(dataCSV(DEFAULT_DATA)), DEFAULT_DATA);
  const missing = DEFAULT_DATA.map(p => ({ ...p, phase: null }));
  assert.deepEqual(parseData(dataCSV(missing)), missing);
  const threeColumns = dataCSV(missing).split('\n').map(line => line.split(',').slice(0, 3).join('\t')).join('\n');
  assert.deepEqual(parseData(threeColumns), missing);
  assert.equal(parseData(dataCSV([...DEFAULT_DATA, DEFAULT_DATA[0]])).length, 31);
});
test('invalid imports fail with row-specific errors; units are never guessed', () => {
  for (const bad of [
    dataCSV(DEFAULT_DATA).replace('modulus_MPa', 'modulus_psi'),
    dataCSV(DEFAULT_DATA).replace('-10,25,', '-10,0,'),
    dataCSV(DEFAULT_DATA).replace('-10,25,', '-10,Infinity,'),
    'temperature_C,frequency_Hz,modulus_MPa,phase_deg\n,1,2000,20',
  ]) assert.throws(() => parseData(bad));
  assert.throws(() => validateData(DEFAULT_DATA.map(p => ({ ...p, phase: 90 }))));
  assert.throws(() => validateData(DEFAULT_DATA.map(p => ({ ...p, frequency: 1 }))));
});
test('one signed log shift moves every reading at a temperature without changing ordinates', () => {
  const points = shiftData(DEFAULT_DATA, manual);
  points.forEach((p, i) => {
    near(p.reducedFrequency / p.frequency, 10 ** manual[p.temperature]);
    assert.equal(p.modulus, DEFAULT_DATA[i].modulus);
    assert.equal(p.phase, DEFAULT_DATA[i].phase);
  });
});
test('measured, interpolated and extrapolated references preserve relative shifts', () => {
  const ts = temperatures(DEFAULT_DATA);
  for (const ref of [4, 13, 21, 65]) {
    const rebased = rebaseShifts(ts, manual, ref);
    near(shiftAt(ts, rebased, ref), 0);
    ts.forEach(t => near(rebased[t] - rebased[ts[0]], manual[t] - manual[ts[0]]));
    const roundTrip = rebaseShifts(ts, rebased, 21);
    ts.forEach(t => near(roundTrip[t], manual[t]));
  }
  assert.throws(() => rebaseShifts(ts, manual, 10000));
});
test('linear solve round trip, including pivoting and singular rejection', () => {
  const A = [[0, 2, 1], [4, -2, 3], [1, 1, -1]], expected = [2, -3, 4];
  const b = A.map(row => row.reduce((sum, v, i) => sum + v * expected[i], 0));
  solveLinear(A, b).forEach((v, i) => near(v, expected[i]));
  assert.equal(solveLinear([[1, 2], [2, 4]], [3, 6]), null);
});
test('NNLS recovers known coefficients and respects the nonnegative boundary', () => {
  const A = [[1, 0], [0, 1], [1, 1]], x = [3, 2];
  const result = nnls(A, A.map(row => row[0] * x[0] + row[1] * x[1]));
  assert.equal(result.converged, true); result.x.forEach((v, i) => near(v, x[i]));
  const boundary = nnls([[1, 0], [0, 1]], [-1, 2]);
  assert.deepEqual(boundary.x, [0, 2]);
});
test('sigmoid reproduces synthetic data, not merely its initial guess', () => {
  const truth = { delta: 1.1, alpha: 3.4, beta: -0.6, gamma: -0.7 };
  const points = Array.from({ length: 51 }, (_, i) => {
    const x = -7 + 14 * i / 50;
    return { temperature: 20, frequency: 10 ** x, modulus: 10 ** sigmoidLog(truth, x), phase: null, logFrequency: x, reducedFrequency: 10 ** x };
  });
  const fit = fitSigmoid(points);
  assert.ok(fit.rmse < 0.002, `RMSE ${fit.rmse}`);
  for (const x of [-5, -2, 0, 2, 5]) near(sigmoidLog(fit, x), sigmoidLog(truth, x), 0.002);
});
test('manual reference-script shifts improve both errors; fitting does not mutate them', () => {
  const before = structuredClone(manual);
  const raw = shiftData(DEFAULT_DATA, zeroShifts(DEFAULT_DATA)), shifted = shiftData(DEFAULT_DATA, manual);
  assert.ok(fitSigmoid(shifted).rmse < fitSigmoid(raw).rmse / 15);
  assert.ok(overlapError(shifted).rmse < overlapError(raw).rmse / 15);
  assert.deepEqual(manual, before);
});
test('missing overlap is unavailable rather than a misleading zero error', () => {
  const separated = Object.fromEntries(temperatures(DEFAULT_DATA).map((t, i) => [t, 10 * i]));
  const overlap = overlapError(shiftData(DEFAULT_DATA, separated));
  assert.equal(overlap.rmse, null); assert.equal(overlap.pairs, 0);
});
test('re-referencing does not improve error or change material response', () => {
  const original = shiftData(DEFAULT_DATA, manual);
  const shifts = rebaseShifts(temperatures(DEFAULT_DATA), manual, 4);
  const shifted = shiftData(DEFAULT_DATA, shifts);
  near(fitSigmoid(original).rmse, fitSigmoid(shifted).rmse, 1e-7);
  near(overlapError(original).rmse, overlapError(shifted).rmse, 1e-10);
  const a = fitSpectrum(original), b = fitSpectrum(shifted);
  assert.ok(a.converged && b.converged);
  near(spectrumAt(a, 10).modulus, spectrumAt(b, 10 / 10 ** manual[4]).modulus, 1e-6);
});
test('storage, loss and phase agree with an analytic standard linear solid', () => {
  const model = { equilibrium: 100, times: [2], strengths: [900] };
  const f = 1 / (4 * Math.PI);
  const response = spectrumAt(model, f);
  near(response.storage, 550); near(response.loss, 450);
  near(response.modulus, Math.hypot(550, 450));
  near(response.phase, Math.atan2(450, 550) * 180 / Math.PI);
  near(relaxationAt(model, 0), 1000);
  near(relaxationAt(model, 2), 100 + 900 / Math.E);
});
test('creep interconversion matches analytic SLS, not reciprocal relaxation', () => {
  const model = { equilibrium: 100, times: [2], strengths: [900] };
  const creep = creepModel(model);
  for (const t of [0, 0.1, 2, 20, 100, 1000]) {
    near(creepAt(creep, t), 0.001 + 0.009 * (1 - Math.exp(-t / 20)), 1e-10);
  }
  assert.ok(Math.abs(creepAt(creep, 2) - 1 / relaxationAt(model, 2)) > 1e-4);
});
test('spectrum fits the default data and yields bounded monotone time responses', () => {
  const model = fitSpectrum(shiftData(DEFAULT_DATA, manual));
  assert.ok(model.converged); assert.ok(model.rmseStorage < 0.03); assert.ok(model.rmseLoss < 0.05);
  assert.ok(model.strengths.every(v => v >= 0));
  const creep = creepModel(model);
  near(creepAt(creep, 0), 1 / relaxationAt(model, 0));
  near(creepAt(creep, 1e30), 1 / model.equilibrium, 1e-7);
  let prevE = Infinity, prevJ = 0;
  for (let i = -12; i <= 12; i++) {
    const E = relaxationAt(model, 10 ** i), J = creepAt(creep, 10 ** i);
    assert.ok(E <= prevE && J >= prevJ); prevE = E; prevJ = J;
  }
  assert.equal(fitSpectrum(shiftData(DEFAULT_DATA.map(p => ({ ...p, phase: null })), manual)), null);
  assert.equal(fitSpectrum(shiftData(DEFAULT_DATA, manual), 1e9), null);
});


test('log-space 1 − R² error matches normalized residuals and improves with alignment', () => {
  const points = shiftData(DEFAULT_DATA, manual), fit = fitSigmoid(points);
  const mean = points.reduce((sum, p) => sum + Math.log10(p.modulus), 0) / points.length;
  const sse = points.reduce((sum, p) => sum + (Math.log10(p.modulus) - sigmoidLog(fit, p.logFrequency)) ** 2, 0);
  const sst = points.reduce((sum, p) => sum + (Math.log10(p.modulus) - mean) ** 2, 0);
  near(1 - fit.r2, sse / sst, 1e-12);
  assert.ok(1 - fit.r2 < (1 - fitSigmoid(shiftData(DEFAULT_DATA, zeroShifts(DEFAULT_DATA))).r2) / 100);
  for (const ref of temperatures(DEFAULT_DATA)) {
    const rebased = shiftData(DEFAULT_DATA, rebaseShifts(temperatures(DEFAULT_DATA), manual, ref));
    near(1 - fitSigmoid(rebased).r2, 1 - fit.r2, 1e-7);
  }
});


const wlf = (c1, c2, reference) => t => -c1 * (t - reference) / (c2 + t - reference);

test('the WLF fit recovers the constants that generated the shifts, at every reference', () => {
  // The projection solves C1 exactly at the right C2, so a noiseless dataset
  // has to come back at full precision -- not merely close.
  const ts = [-10, 4, 20, 37, 54];
  for (const reference of ts) {
    // every C2 here keeps the pole below -10 degrees at every reference, which
    // is the branch the fit searches; a pole inside the data is not WLF data
    for (const [c1, c2] of [[19, 92], [23.5, 197.6], [12, 70]]) {
      const law = fitShiftLaw(ts, Object.fromEntries(ts.map(t => [t, wlf(c1, c2, reference)(t)])), reference);
      near(law.c1, c1, 1e-6); near(law.c2, c2, 1e-6); near(law.r2, 1, 1e-12);
      assert.equal(law.atBound, false);
      near(shiftLawAt(law, reference), 0);
      near(shiftLawAt(law, 30), wlf(c1, c2, reference)(30), 1e-6);
    }
  }
});

test('WLF constants convert between references exactly, when the data are exactly WLF', () => {
  // C2' = C2 + dT and C1' = C1 C2 / C2' is the textbook conversion, and it is
  // a property of the equation, not of the fit: refitting at another reference
  // must land on the converted constants whenever the shifts have no scatter.
  const ts = [-10, 4, 21, 37, 54], reference = 21, c1 = 23.5, c2 = 197.6;
  const shifts = Object.fromEntries(ts.map(t => [t, wlf(c1, c2, reference)(t)]));
  for (const moved of ts) {
    const dt = moved - reference;
    const rebased = rebaseShifts(ts, shifts, moved);
    const law = fitShiftLaw(ts, rebased, moved);
    near(law.c2, c2 + dt, 1e-6);
    near(law.c1, c1 * c2 / (c2 + dt), 1e-6);
  }
});

test('the default trial shifts give asphalt-scale WLF constants and a curve through them', () => {
  const ts = temperatures(DEFAULT_DATA);
  const law = fitShiftLaw(ts, manual, 21);
  near(law.c1, 23.0276, 1e-3); near(law.c2, 197.553, 1e-3);
  assert.ok(law.r2 > 0.999, `R2 ${law.r2}`);
  assert.equal(law.atBound, false);
  near(shiftLawAt(law, 21), 0);
  // the pole stays below the coldest reading, so every drawn temperature is finite
  assert.ok(21 - law.c2 < ts[0], `pole ${21 - law.c2}`);
  ts.forEach(t => assert.ok(Math.abs(shiftLawAt(law, t) - manual[t]) < 0.12));
});

test('a straight line is the C2 to infinity limit, and is reported as a bound rather than a fit', () => {
  const ts = [-10, 4, 21, 37, 54];
  const law = fitShiftLaw(ts, Object.fromEntries(ts.map(t => [t, -0.12 * (t - 21)])), 21);
  assert.equal(law.atBound, true);
  near(law.c2, WLF_C2_MAX, 1e-9);
  near(law.c1 / law.c2, 0.12, 2e-4);   // only the ratio is identified
  assert.ok(law.r2 > 0.99999);
});

test('WLF is undefined below its pole, and the fit keeps that pole off the data', () => {
  const ts = [-10, 4, 21, 37, 54];
  const law = fitShiftLaw(ts, manual, 21);
  const pole = 21 - law.c2;
  assert.ok(Number.isNaN(shiftLawAt(law, pole)));
  assert.ok(Number.isNaN(shiftLawAt(law, pole - 10)));
  assert.ok(Number.isFinite(shiftLawAt(law, pole + 1e-6)));
  // a reference at the coldest group still cannot put the pole inside the data
  const cold = fitShiftLaw(ts, rebaseShifts(ts, manual, -10), -10);
  assert.ok(-10 - cold.c2 < -10);
  ts.forEach(t => assert.ok(Number.isFinite(shiftLawAt(cold, t))));
});

test('two temperatures and flat shifts are refused or flagged, never given false constants', () => {
  assert.equal(fitShiftLaw([0, 20], { 0: 2, 20: 0 }, 20), null);
  assert.equal(fitShiftLaw([-10, 4, 21], { '-10': 2, 4: 1, 21: 0 }, 37), null);
  const ts = [-10, 4, 21, 37, 54];
  const law = fitShiftLaw(ts, Object.fromEntries(ts.map(t => [t, 0])), 21);
  assert.equal(law.r2, null); near(law.c1, 0); assert.equal(law.atBound, true);
  assert.ok(Object.is(law.c1, 0), 'a zero C1 is never reported as -0');
});

test('modulus prediction composes fitted temperature shifts with the saved sigmoid', () => {
  const points = shiftData(DEFAULT_DATA, manual), fit = fitSigmoid(points);
  const law = fitShiftLaw(temperatures(DEFAULT_DATA), manual, 21);
  const prediction = predictModulus(fit, law, 30, 10);
  near(prediction.logFrequency, 1 + shiftLawAt(law, 30));
  near(prediction.modulus, 10 ** sigmoidLog(fit, prediction.logFrequency));
  near(predictModulus(fit, law, 21, 10).modulus, 10 ** sigmoidLog(fit, 1));
  assert.equal(predictModulus(fit, law, 30, 0), null);
  assert.equal(predictModulus(fit, law, 30, -1), null);
  assert.equal(predictModulus(fit, law, NaN, 10), null);
  assert.equal(predictModulus(fit, law, 30, Infinity), null);
});
