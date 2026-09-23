// Time-temperature superposition. No function in this module optimizes shifts.
// Frequency is Hz, modulus MPa, temperature °C, phase degrees, time seconds.
export interface TestPoint { temperature: number; frequency: number; modulus: number; phase: number | null }
export interface ShiftedPoint extends TestPoint { logFrequency: number; reducedFrequency: number }
export type Shifts = Record<string, number>;
export const temperatures = (points: TestPoint[]) => [...new Set(points.map(p => p.temperature))].sort((a, b) => a - b);
export const zeroShifts = (points: TestPoint[]): Shifts => Object.fromEntries(temperatures(points).map(t => [t, 0]));

export function validateData(points: TestPoint[]): void {
  if (points.length < 6 || points.length > 500) throw Error('Use 6–500 readings, with at least three distinct frequencies at each of two or more temperatures.');
  points.forEach((p, i) => {
    if (!Number.isFinite(p.temperature) || p.temperature < -200 || p.temperature > 300)
      throw Error(`Row ${i + 1}: temperature must be between −200 and 300 °C.`);
    if (!Number.isFinite(p.frequency) || p.frequency < 1e-10 || p.frequency > 1e10)
      throw Error(`Row ${i + 1}: frequency must be between 10⁻¹⁰ and 10¹⁰ Hz.`);
    if (!Number.isFinite(p.modulus) || p.modulus < 1e-8 || p.modulus > 1e8)
      throw Error(`Row ${i + 1}: modulus must be between 10⁻⁸ and 10⁸ MPa.`);
    if (p.phase !== null && (!Number.isFinite(p.phase) || p.phase < 0 || p.phase >= 90))
      throw Error(`Row ${i + 1}: phase must be 0 ≤ φ < 90°, or blank.`);
  });
  const ts = temperatures(points);
  if (ts.length < 2 || ts.length > 12) throw Error('Use 2–12 temperature groups.');
  for (const t of ts) {
    if (new Set(points.filter(p => p.temperature === t).map(p => p.frequency)).size < 3)
      throw Error(`${t} °C needs at least three distinct frequencies.`);
  }
  if (Math.max(...points.map(p => p.modulus)) / Math.min(...points.map(p => p.modulus)) < 1.001)
    throw Error('A constant modulus does not identify a sigmoid or horizontal shift. Use a dataset with frequency-dependent modulus.');
}

/** Strict units/header; invalid imports never silently discard rows. */
export function parseData(text: string): TestPoint[] {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw Error('Include the header and at least six data rows.');
  const split = (line: string) => line.split(/[\t,;]/).map(v => v.trim());
  const header = split(lines[0]).map(v => v.toLowerCase());
  const expected = ['temperature_c', 'frequency_hz', 'modulus_mpa', 'phase_deg'];
  if (header.length < 3 || header.length > 4 || header.some((v, i) => v !== expected[i]))
    throw Error('Header must be temperature_C,frequency_Hz,modulus_MPa,phase_deg (phase_deg is optional).');
  const result = lines.slice(1).map((line, i) => {
    const v = split(line);
    if (v.length !== header.length || v.slice(0, 3).some(s => s === '')) throw Error(`Line ${i + 2}: expected ${header.length} columns; temperature, frequency and modulus are required.`);
    return { temperature: Number(v[0]), frequency: Number(v[1]), modulus: Number(v[2]),
      phase: v[3] === undefined || v[3] === '' ? null : Number(v[3]) };
  });
  validateData(result);
  return result;
}
export const dataCSV = (points: TestPoint[]) => 'temperature_C,frequency_Hz,modulus_MPa,phase_deg\n' + points.map(p =>
  [p.temperature, p.frequency, p.modulus, p.phase ?? ''].join(',')).join('\n');

/** Piecewise-linear interpolation of log shifts, with end-segment extrapolation. */
export function shiftAt(ts: number[], shifts: Shifts, temperature: number): number {
  if (ts.length < 2 || !Number.isFinite(temperature)) throw Error('A finite reference temperature and at least two groups are required.');
  let i = ts.findIndex(t => t >= temperature);
  i = i < 0 ? ts.length - 1 : Math.max(1, i);
  const lo = ts[i - 1], hi = ts[i];
  return shifts[lo] + (shifts[hi] - shifts[lo]) * (temperature - lo) / (hi - lo);
}
export function rebaseShifts(ts: number[], shifts: Shifts, reference: number): Shifts {
  const offset = shiftAt(ts, shifts, reference);
  const rebased = Object.fromEntries(ts.map(t => [t, shifts[t] - offset]));
  if (Object.values(rebased).some(v => !Number.isFinite(v) || Math.abs(v) > 24))
    throw Error('This reference or shift requires more than 24 decades. Choose a closer reference or smaller shifts.');
  return rebased;
}
export const shiftData = (points: TestPoint[], shifts: Shifts): ShiftedPoint[] => points.map(p => {
  const logFrequency = Math.log10(p.frequency) + shifts[p.temperature];
  return { ...p, logFrequency, reducedFrequency: 10 ** logFrequency };
});

export interface SigmoidFit { delta: number; alpha: number; beta: number; gamma: number; rmse: number; r2: number; atBound: boolean }
export const sigmoidLog = (fit: SigmoidFit, x: number) => fit.delta + fit.alpha / (1 + Math.exp(Math.max(-700, Math.min(700, fit.beta + fit.gamma * x))));

/** Williams–Landel–Ferry, anchored at the student's reference temperature:
 *     log10 aT = −C1 (T − Tref) / (C2 + T − Tref)
 * C1 enters LINEARLY once C2 is fixed, so this is a one-dimensional search over
 * C2 with C1 projected out of it — no Jacobian, and no seed to get wrong. Each
 * temperature carries equal weight, and the reference is satisfied exactly
 * (T = Tref gives log10 aT = 0) rather than fitted.
 *
 * Two limits bound the search, and both are reported rather than hidden.
 * The pole at T = Tref − C2 is held below the coldest test temperature, which
 * is the branch WLF is written for; and C2 → ∞ at fixed C1/C2 IS a straight
 * line, so shifts carrying no curvature drive C2 to the ceiling and identify
 * only that ratio.
 */
export const WLF_C2_MAX = 1e4;
export interface ShiftLaw { reference: number; c1: number; c2: number; r2: number | null; atBound: boolean }
export function fitShiftLaw(ts: number[], shifts: Shifts, reference: number): ShiftLaw | null {
  if (!ts.includes(reference) || ts.length < 3 ||
      ts.some(t => !Number.isFinite(t) || !Number.isFinite(shifts[t]))) return null;
  const dt = ts.map(t => t - reference), y = ts.map(t => shifts[t]);
  const span = Math.max(...ts) - Math.min(...ts);
  if (!(span > 0)) return null;
  const floor = Math.max(0, -Math.min(...dt)) + Math.max(1, span / 50);
  if (!(floor < WLF_C2_MAX)) return null;
  /** Least-squares C1 at a fixed C2, and the residual the search minimizes. */
  const project = (c2: number) => {
    const u = dt.map(v => v / (c2 + v));
    const uu = u.reduce((sum, v) => sum + v * v, 0);
    if (!(uu > 1e-30)) return { c1: 0, error: Infinity };
    const c1 = -u.reduce((sum, v, i) => sum + v * y[i], 0) / uu;
    return { c1, error: u.reduce((sum, v, i) => sum + (y[i] + c1 * v) ** 2, 0) };
  };
  const steps = 400, ratio = Math.log(WLF_C2_MAX / floor) / steps;
  const grid = Array.from({ length: steps + 1 }, (_, i) => floor * Math.exp(i * ratio));
  let index = 0, least = Infinity;
  grid.forEach((c2, i) => { const error = project(c2).error; if (error < least) { least = error; index = i; } });
  // Golden section inside the bracket the 2%-resolution scan already located.
  let lo = grid[Math.max(0, index - 1)], hi = grid[Math.min(steps, index + 1)];
  const golden = (Math.sqrt(5) - 1) / 2;
  let a = hi - golden * (hi - lo), b = lo + golden * (hi - lo);
  let fa = project(a).error, fb = project(b).error;
  for (let k = 0; k < 120 && hi - lo > 1e-10 * hi; k++) {
    if (fa < fb) { hi = b; b = a; fb = fa; a = hi - golden * (hi - lo); fa = project(a).error; }
    else { lo = a; a = b; fa = fb; b = lo + golden * (hi - lo); fb = project(b).error; }
  }
  const c2 = (lo + hi) / 2, { c1, error } = project(c2);
  const mean = y.reduce((sum, v) => sum + v, 0) / y.length;
  const sst = y.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return { reference, c1: Object.is(c1, -0) ? 0 : c1, c2, atBound: index === 0 || index === steps,
    r2: sst > 1e-20 ? 1 - error / sst : null };
}
/** Undefined at or below the pole; the caller reports that, never a number. */
export function shiftLawAt(law: ShiftLaw, temperature: number): number {
  const dt = temperature - law.reference, denominator = law.c2 + dt;
  return denominator > 0 ? -law.c1 * dt / denominator : NaN;
}
export function predictModulus(fit: SigmoidFit, law: ShiftLaw, temperature: number, frequency: number) {
  if (!Number.isFinite(temperature) || !Number.isFinite(frequency) || frequency <= 0) return null;
  const logShift = shiftLawAt(law, temperature), logFrequency = Math.log10(frequency) + logShift;
  if (!Number.isFinite(logFrequency)) return null;
  const modulus = 10 ** sigmoidLog(fit, logFrequency);
  return Number.isFinite(modulus) && modulus > 0 ? { modulus, logShift, logFrequency } : null;
}

/** Variable projection: solve the two plateaus at each center/slope candidate.
 * Log-frequency is centered for invariance under reference-temperature changes.
 * Two decades of extrapolation beyond the observed moduli bounds each plateau.
 */
export function fitSigmoid(points: ShiftedPoint[]): SigmoidFit | null {
  if (points.length < 6) return null;
  const rawX = points.map(p => p.logFrequency), y = points.map(p => Math.log10(p.modulus));
  const origin = (Math.min(...rawX) + Math.max(...rawX)) / 2;
  const x = rawX.map(v => v - origin);
  const lo = Math.min(...y), hi = Math.max(...y);
  const span = Math.max(1, Math.max(...x) - Math.min(...x));
  if (hi - lo < 1e-6) return null;
  const objective = (center: number, logSlope: number) => {
    const slope = Math.exp(logSlope);
    const z = x.map(v => 1 / (1 + Math.exp(Math.max(-700, Math.min(700, -slope * (v - center))))));
    let aa = 0, ab = 0, bb = 0, ay = 0, by = 0;
    z.forEach((v, i) => { const a = 1 - v; aa += a * a; ab += a * v; bb += v * v; ay += a * y[i]; by += v * y[i]; });
    const candidates: [number, number][] = [];
    const det = aa * bb - ab * ab;
    if (det > 1e-14) candidates.push([(ay * bb - by * ab) / det, (by * aa - ay * ab) / det]);
    for (const lower of [lo - 2, lo]) candidates.push([lower, Math.max(hi, Math.min(hi + 2, (by - ab * lower) / Math.max(bb, 1e-30)))]);
    for (const upper of [hi, hi + 2]) candidates.push([Math.max(lo - 2, Math.min(lo, (ay - ab * upper) / Math.max(aa, 1e-30))), upper]);
    let best = { error: Infinity, lower: lo, upper: hi, center, slope };
    for (const [lower, upper] of candidates) {
      if (lower < lo - 2 || lower > lo || upper < hi || upper > hi + 2) continue;
      const error = z.reduce((sum, v, i) => sum + (y[i] - lower * (1 - v) - upper * v) ** 2, 0);
      if (error < best.error) best = { error, lower, upper, center, slope };
    }
    return best;
  };
  let best = objective(0, Math.log(1 / span));
  for (const seed of [-0.5, 0, 0.5]) for (const steep of [1, 4, 12]) {
    let c = seed * span, l = Math.log(steep / span), dc = span / 3, dl = 0.7;
    let current = objective(c, l);
    for (let k = 0; k < 130; k++) {
      let improved = false;
      for (const [cc, ll] of [[c - dc, l], [c + dc, l], [c, l - dl], [c, l + dl]]) {
        if (Math.abs(cc) > 2 * span || ll < Math.log(0.03 / span) || ll > Math.log(80 / span)) continue;
        const candidate = objective(cc, ll);
        if (candidate.error < current.error - 1e-14) { current = candidate; c = cc; l = ll; improved = true; }
      }
      if (!improved) { dc *= 0.5; dl *= 0.5; }
      if (dc < 1e-7 && dl < 1e-7) break;
    }
    if (current.error < best.error) best = current;
  }
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  const sst = y.reduce((a, b) => a + (b - mean) ** 2, 0);
  return { delta: best.lower, alpha: best.upper - best.lower,
    beta: best.slope * (best.center + origin), gamma: -best.slope,
    rmse: Math.sqrt(best.error / y.length), r2: sst > 0 ? 1 - best.error / sst : 0,
    atBound: Math.abs(best.lower - (lo - 2)) < 1e-5 || Math.abs(best.upper - (hi + 2)) < 1e-5 };
}

/** Adjacent-temperature overlap error, independent of the fitted sigmoid.
 * Replicates at identical frequencies are averaged in log modulus.
 * Missing overlap is reported, never assigned zero error.
 */
export function overlapError(points: ShiftedPoint[]) {
  const ts = temperatures(points);
  const curves = ts.map(t => {
    const grouped = new Map<number, number[]>();
    for (const p of points.filter(p => p.temperature === t)) {
      const ys = grouped.get(p.logFrequency) ?? []; ys.push(Math.log10(p.modulus)); grouped.set(p.logFrequency, ys);
    }
    return [...grouped].map(([x, ys]) => ({ x, y: ys.reduce((a, b) => a + b) / ys.length })).sort((a, b) => a.x - b.x);
  });
  const valueAt = (curve: { x: number; y: number }[], x: number) => {
    const i = Math.max(1, curve.findIndex(p => p.x >= x));
    const a = curve[i - 1], b = curve[i];
    return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  };
  let squared = 0, count = 0, pairs = 0;
  for (let i = 1; i < curves.length; i++) {
    const a = curves[i - 1], b = curves[i];
    const lo = Math.max(a[0].x, b[0].x), hi = Math.min(a.at(-1)!.x, b.at(-1)!.x);
    if (hi - lo < 0.05) continue;
    pairs++;
    for (let j = 0; j <= 10; j++) {
      const x = lo + (hi - lo) * j / 10;
      squared += (valueAt(a, x) - valueAt(b, x)) ** 2; count++;
    }
  }
  return { rmse: count ? Math.sqrt(squared / count) : null, pairs, totalPairs: ts.length - 1 };
}

/** Scaled partial-pivot elimination; returns null on rank deficiency. */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length, m = A.map((row, i) => [...row, b[i]]);
  const scale = Math.max(...A.flat().map(Math.abs), 1e-300);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    if (Math.abs(m[pivot][i]) < 1e-13 * scale) return null;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    for (let j = i + 1; j < n; j++) {
      const factor = m[j][i] / m[i][i];
      for (let k = i; k <= n; k++) m[j][k] -= factor * m[i][k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) x[i] = (m[i][n] - m[i].slice(i + 1, n).reduce((sum, v, k) => sum + v * x[i + 1 + k], 0)) / m[i][i];
  return x.every(Number.isFinite) ? x : null;
}

/** Lawson–Hanson active-set NNLS on small, normalized viscoelastic systems. */
export function nnls(A: number[][], b: number[]) {
  const n = A[0].length;
  const gram = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => A.reduce((s, row) => s + row[i] * row[j], 0)));
  const rhs = Array.from({ length: n }, (_, i) => A.reduce((s, row, k) => s + row[i] * b[k], 0));
  let x = Array(n).fill(0);
  const passive = new Set<number>();
  const tol = 1e-10 * Math.max(...rhs.map(Math.abs), 1);
  let converged = false;
  for (let iteration = 0; iteration < 20 * n; iteration++) {
    const gradient = rhs.map((v, i) => v - gram[i].reduce((s, g, j) => s + g * x[j], 0));
    let enter = -1, largest = tol;
    for (let j = 0; j < n; j++) if (!passive.has(j) && gradient[j] > largest) { enter = j; largest = gradient[j]; }
    if (enter < 0) { converged = true; break; }
    passive.add(enter);
    for (let inner = 0; inner < 3 * n; inner++) {
      const ids = [...passive];
      const solution = solveLinear(ids.map(i => ids.map(j => gram[i][j])), ids.map(i => rhs[i]));
      if (!solution) return { x, converged: false };
      const z = Array(n).fill(0); ids.forEach((id, i) => { z[id] = solution[i]; });
      if (ids.every(i => z[i] > 0)) { x = z; break; }
      let alpha = 1;
      for (const i of ids) if (z[i] <= 0) alpha = Math.min(alpha, x[i] / (x[i] - z[i] || 1));
      x = x.map((v, i) => Math.max(0, v + alpha * (z[i] - v)));
      for (const i of ids) if (x[i] <= 1e-12) { x[i] = 0; passive.delete(i); }
    }
  }
  return { x, converged };
}

export interface Spectrum { equilibrium: number; times: number[]; strengths: number[]; converged: boolean; rmseStorage: number; rmseLoss: number | null }
export function spectrumAt(model: Pick<Spectrum, 'equilibrium' | 'times' | 'strengths'>, frequency: number) {
  const w = 2 * Math.PI * frequency;
  let storage = model.equilibrium, loss = 0;
  model.times.forEach((t, i) => {
    const v = w * t, v2 = v * v;
    storage += model.strengths[i] * v2 / (1 + v2);
    loss += model.strengths[i] * v / (1 + v2);
  });
  return { storage, loss, modulus: Math.hypot(storage, loss), phase: Math.atan2(loss, storage) * 180 / Math.PI };
}
export function fitSpectrum(points: ShiftedPoint[], equilibrium = 1): Spectrum | null {
  const phasePoints = points.filter(p => p.phase !== null);
  if (phasePoints.length < 6 || !(equilibrium > 0) || !Number.isFinite(equilibrium)) return null;
  const xs = phasePoints.map(p => p.logFrequency);
  const min = Math.min(...xs), max = Math.max(...xs);
  // Adaptive time grid shifts exactly with a change in reference temperature.
  const times = Array.from({ length: 20 }, (_, i) => 10 ** (-max - Math.log10(2 * Math.PI) - 1 + i * (max - min + 2) / 19));
  const scale = Math.max(...phasePoints.map(p => p.modulus));
  const storage = phasePoints.map(p => p.modulus * Math.cos(p.phase! * Math.PI / 180));
  const loss = phasePoints.map(p => p.modulus * Math.sin(p.phase! * Math.PI / 180));
  if (equilibrium >= Math.min(...storage)) return null;
  const A = [false, true].flatMap(isLoss => phasePoints.map(p => times.map(t => {
    const v = 2 * Math.PI * p.reducedFrequency * t;
    return isLoss ? v / (1 + v * v) : v * v / (1 + v * v);
  })));
  const b = [...storage.map(v => (v - equilibrium) / scale), ...loss.map(v => v / scale)];
  const result = nnls(A, b);
  const model: Spectrum = { equilibrium, times, strengths: result.x.map(v => v * scale), converged: result.converged, rmseStorage: 0, rmseLoss: 0 };
  const predictions = phasePoints.map(p => spectrumAt(model, p.reducedFrequency));
  model.rmseStorage = Math.sqrt(storage.reduce((s, v, i) => s + (Math.log10(v) - Math.log10(predictions[i].storage)) ** 2, 0) / storage.length);
  const positiveLoss = loss.map((v, i) => ({ v, predicted: predictions[i].loss })).filter(p => p.v > 0 && p.predicted > 0);
  model.rmseLoss = positiveLoss.length ? Math.sqrt(positiveLoss.reduce((s, p) => s + (Math.log10(p.v) - Math.log10(p.predicted)) ** 2, 0) / positiveLoss.length) : null;
  return model;
}
export const relaxationAt = (model: Pick<Spectrum, 'equilibrium' | 'times' | 'strengths'>, time: number) =>
  model.equilibrium + model.times.reduce((s, tau, i) => s + model.strengths[i] * Math.exp(-time / tau), 0);

/** Exact rational Maxwell→Kelvin interconversion: zeros of the operational
 * modulus interlace its poles. J(t) = J0 + Σ Jk(1-exp(-λk t)).
 * This is NOT 1/E(t) nor a frequency-to-time relabeling.
 */
export function creepModel(model: Pick<Spectrum, 'equilibrium' | 'times' | 'strengths'>) {
  const peak = Math.max(...model.strengths);
  const terms = model.times.map((t, i) => ({ rate: 1 / t, strength: model.strengths[i] }))
    .filter(p => p.strength > peak * 1e-12 && p.strength > 0).sort((a, b) => a.rate - b.rate);
  const instantaneous = model.equilibrium + terms.reduce((s, p) => s + p.strength, 0);
  const branches = terms.map((p, i) => {
    let lo = i ? terms[i - 1].rate : 0, hi = p.rate;
    for (let step = 0; step < 160; step++) {
      const mid = (lo + hi) / 2;
      if (mid === lo || mid === hi) break;
      const modulus = model.equilibrium + terms.reduce((sum, term) => sum + term.strength * mid / (mid - term.rate), 0);
      if (modulus > 0) lo = mid; else hi = mid;
    }
    const rate = (lo + hi) / 2;
    const derivative = terms.reduce((s, term) => s + term.strength * term.rate / (term.rate - rate) ** 2, 0);
    return { rate, compliance: 1 / (rate * derivative) };
  });
  return { initial: 1 / instantaneous, branches };
}
export const creepAt = (model: ReturnType<typeof creepModel>, time: number) =>
  model.initial + model.branches.reduce((s, p) => s + p.compliance * -Math.expm1(-p.rate * time), 0);
