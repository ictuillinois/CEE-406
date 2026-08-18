// Reliability of an AASHTO flexible design — pure functions, no React.
//
// Huang (2004) Chapter 10. The chapter's argument in one line: a deterministic
// design hides its factor of safety inside judgement, and a probabilistic one
// makes it visible by giving every input a mean and a variance.
//
//   Traffic prediction      Eqs. 10.38-10.40  → mean and variance of log W_T
//   Performance prediction  Eqs. 10.41-10.44  → mean and variance of log W_t
//   Reliability             Eqs. 10.45-10.46  → P(log W_T − log W_t < 0)
//
// Three estimators of the same variance are provided on purpose — Taylor's
// first-order expansion (§10.1.2), Rosenblueth's point estimates (§10.4), and
// Monte Carlo. They agree when the function is nearly linear over ±1σ and
// diverge when it is not, which is the thing worth seeing.
import { normCdf } from '../aashto/equations.ts';

/** (log₁₀ e)² — the factor that converts a relative variance into a variance
 *  of the base-10 logarithm (Huang Eq. 10.30). */
export const LOG10E_SQ = Math.pow(Math.LOG10E, 2);   // 0.1886

/* ───────────────────────── Traffic prediction ──────────────────────────── */

export interface TrafficInputs {
  /** Σ pᵢFᵢ — mean equivalency factor of the axle mix. */
  sumPF: number;
  cvSumPF: number;      // as a decimal, e.g. 0.35
  ADT0: number;
  cvADT: number;
  /** Annual growth rate, decimal. */
  r: number;
  cvR: number;
  /** Fraction of ADT that is trucks. */
  T: number;
  cvT: number;
  /** Axles per truck. */
  A: number;
  cvA: number;
  /** Directional distribution factor. */
  D: number;
  cvD: number;
  /** Lane distribution factor. */
  L: number;
  cvL: number;
  /** Design period, years. */
  Y: number;
}

export interface VarianceTerm {
  name: string;
  /** This term's share of the total variance, absolute. */
  variance: number;
  /** Share of the total, 0-1. */
  share: number;
}

export interface TrafficResult {
  /** Average growth factor, Huang Eq. 6.31: G = ½[1 + (1+r)^Y]. */
  G: number;
  logWT: number;
  varLogWT: number;
  sdLogWT: number;
  terms: VarianceTerm[];
}

export function trafficPrediction(i: TrafficInputs): TrafficResult | null {
  const { sumPF, ADT0, r, T, A, D, L, Y } = i;
  if (!(sumPF > 0 && ADT0 > 0 && T > 0 && A > 0 && D > 0 && L > 0 && Y > 0)) return null;

  const G = 0.5 * (1 + Math.pow(1 + r, Y));

  // Eq. 10.39 — the 2.562 is log₁₀(365).
  const logWT =
    Math.log10(sumPF) + Math.log10(ADT0) + Math.log10(G) + Math.log10(T) +
    Math.log10(A) + Math.log10(D) + Math.log10(L) + Math.log10(Y) + Math.log10(365);

  // V[G] comes from V[r] through dG/dr = ½·Y·(1+r)^(Y−1).
  const varR = Math.pow(i.cvR * r, 2);
  const dGdr = 0.5 * Y * Math.pow(1 + r, Y - 1);
  const varG = dGdr * dGdr * varR;

  // Eq. 10.40: every factor enters as its own squared coefficient of
  // variation, because a product of independent variables has a relative
  // variance equal to the sum of the relative variances.
  const raw: [string, number][] = [
    ['Σ pᵢFᵢ (axle mix)', Math.pow(i.cvSumPF, 2)],
    ['ADT₀', Math.pow(i.cvADT, 2)],
    ['Growth factor G', varG / (G * G)],
    ['Truck fraction T', Math.pow(i.cvT, 2)],
    ['Axles per truck A', Math.pow(i.cvA, 2)],
    ['Directional factor D', Math.pow(i.cvD, 2)],
    ['Lane factor L', Math.pow(i.cvL, 2)],
  ];

  const scaled = raw.map(([name, rel]) => [name, LOG10E_SQ * rel] as [string, number]);
  const varLogWT = scaled.reduce((s, [, v]) => s + v, 0);

  return {
    G,
    logWT,
    varLogWT,
    sdLogWT: Math.sqrt(varLogWT),
    terms: scaled.map(([name, variance]) => ({
      name, variance, share: varLogWT > 0 ? variance / varLogWT : 0,
    })),
  };
}

/* ─────────────────────── Performance prediction ────────────────────────── */

export interface LayerInput {
  name: string;
  /** Layer coefficient aᵢ. */
  a: number;
  cvA: number;
  /** Thickness Dᵢ, in. */
  D: number;
  cvD: number;
  /** Drainage coefficient mᵢ. The surface course has none — pass 1 with cv 0. */
  m: number;
  cvM: number;
}

export interface PerformanceInputs {
  layers: LayerInput[];
  /** Initial serviceability index. */
  p0: number;
  cvP0: number;
  /** Terminal serviceability index — a choice, not a measurement, so no variance. */
  pt: number;
  /** Roadbed soil resilient modulus, psi. */
  MR: number;
  cvMR: number;
}

export interface PerformanceResult {
  SN: number;
  varSN: number;
  logWt: number;
  varLogWt: number;
  sdLogWt: number;
  terms: VarianceTerm[];
}

/** Structural number, Huang Eq. 10.42 / 11.35. */
export const structuralNumber = (layers: LayerInput[]) =>
  layers.reduce((s, l) => s + l.a * l.D * l.m, 0);

/**
 * Variance of the structural number, Huang Eq. 10.44. Each layer contributes
 * three terms because SN is a triple product and all three factors vary.
 */
export function varStructuralNumber(layers: LayerInput[]): number {
  return layers.reduce((s, l) => {
    const va = Math.pow(l.a * l.cvA, 2);
    const vd = Math.pow(l.D * l.cvD, 2);
    const vm = Math.pow(l.m * l.cvM, 2);
    return s
      + Math.pow(l.D * l.m, 2) * va
      + Math.pow(l.a * l.m, 2) * vd
      + Math.pow(l.a * l.D, 2) * vm;
  }, 0);
}

/**
 * Allowable load repetitions, Huang Eq. 10.41 — the AASHTO flexible equation
 * with the reliability term removed, because reliability is what we are
 * computing rather than assuming.
 */
export function logWtOf(SN: number, MR: number, p0: number, pt: number): number {
  const g = Math.log10((p0 - pt) / (4.2 - 1.5));
  const beta = 0.4 + 1094 / Math.pow(SN + 1, 5.19);
  return 9.36 * Math.log10(SN + 1) - 0.2 + g / beta + 2.32 * Math.log10(MR) - 8.07;
}

/** ∂ log Wt / ∂SN — the first bracket of Huang Eq. 10.43. */
export function dLogWtdSN(SN: number, p0: number, pt: number): number {
  const g = Math.log10((p0 - pt) / (4.2 - 1.5));
  const beta = 0.4 + 1094 / Math.pow(SN + 1, 5.19);
  return (9.36 * Math.LOG10E) / (SN + 1)
    + (g * ((1094 * 5.19) / Math.pow(SN + 1, 6.19))) / (beta * beta);
}

/** ∂ log Wt / ∂p₀ — the second bracket of Eq. 10.43. */
export function dLogWtdP0(SN: number, p0: number, pt: number): number {
  const beta = 0.4 + 1094 / Math.pow(SN + 1, 5.19);
  return Math.LOG10E / (beta * (p0 - pt));
}

/** ∂ log Wt / ∂M_R — the third bracket of Eq. 10.43. */
export const dLogWtdMR = (MR: number) => (2.32 * Math.LOG10E) / MR;

/**
 * Performance prediction by Taylor's first-order expansion (§10.1.2): the
 * variance of a function is the sum of (∂f/∂xᵢ)² V[xᵢ] when the inputs are
 * independent.
 */
export function performancePrediction(i: PerformanceInputs): PerformanceResult | null {
  const { layers, p0, pt, MR } = i;
  if (!(layers.length && MR > 0 && p0 > pt)) return null;

  const SN = structuralNumber(layers);
  if (!(SN > 0)) return null;
  const varSN = varStructuralNumber(layers);
  const logWt = logWtOf(SN, MR, p0, pt);

  const tSN = Math.pow(dLogWtdSN(SN, p0, pt), 2) * varSN;
  const tP0 = Math.pow(dLogWtdP0(SN, p0, pt), 2) * Math.pow(p0 * i.cvP0, 2);
  const tMR = Math.pow(dLogWtdMR(MR), 2) * Math.pow(MR * i.cvMR, 2);

  const varLogWt = tSN + tP0 + tMR;
  const terms: VarianceTerm[] = [
    { name: 'Structural number SN', variance: tSN, share: 0 },
    { name: 'Initial serviceability p₀', variance: tP0, share: 0 },
    { name: 'Roadbed modulus M R', variance: tMR, share: 0 },
  ].map(t => ({ ...t, share: varLogWt > 0 ? t.variance / varLogWt : 0 }));

  return { SN, varSN, logWt, varLogWt, sdLogWt: Math.sqrt(varLogWt), terms };
}

/* ──────────────────────────── Reliability ──────────────────────────────── */

export interface ReliabilityResult {
  /** Mean of log D_r = log W_T − log W_t. Negative means the design survives. */
  meanLogDr: number;
  varLogDr: number;
  sdLogDr: number;
  /** Standard normal deviate; reliability is Φ(z). */
  z: number;
  /** Reliability, percent. */
  R: number;
}

/**
 * Reliability as the probability that the damage ratio stays below 1 —
 * Huang Eqs. 10.45-10.46. The two variances add because traffic and
 * performance are predicted independently.
 */
export function reliability(
  logWT: number, varLogWT: number, logWt: number, varLogWt: number
): ReliabilityResult {
  const meanLogDr = logWT - logWt;
  const varLogDr = varLogWT + varLogWt;
  const sd = Math.sqrt(varLogDr);
  const z = sd > 0 ? -meanLogDr / sd : (meanLogDr < 0 ? Infinity : -Infinity);
  return { meanLogDr, varLogDr, sdLogDr: sd, z, R: 100 * normCdf(z) };
}

/* ─────────────────── Rosenblueth point estimates (§10.4) ────────────────── */

/**
 * Rosenblueth's 2ⁿ point-estimate method: evaluate the function at every
 * combination of (mean ± one standard deviation) and take the equally
 * weighted mean of the results and of their squares.
 *
 * It needs no derivatives, so it does not care whether the function is smooth
 * — and it disagrees with Taylor's expansion exactly when the function is
 * curved over ±1σ, which is the diagnostic worth having.
 *
 * @param means  the mean of each variable
 * @param sds    the standard deviation of each
 * @param f      the function under study
 */
export function rosenblueth(
  means: number[], sds: number[], f: (x: number[]) => number
): { mean: number; variance: number } | null {
  const n = means.length;
  if (n === 0 || n > 16 || sds.length !== n) return null;
  const combos = 1 << n;
  const w = 1 / combos;
  let sum = 0, sumSq = 0;
  for (let c = 0; c < combos; c++) {
    const x = means.map((m, i) => m + ((c >> i) & 1 ? sds[i] : -sds[i]));
    const y = f(x);
    if (!Number.isFinite(y)) return null;
    sum += w * y;
    sumSq += w * y * y;
  }
  return { mean: sum, variance: Math.max(0, sumSq - sum * sum) };
}

/* ────────────────────────────── Monte Carlo ─────────────────────────────── */

/** mulberry32 — a small, seeded PRNG. Seeded so a student's run is
 *  reproducible and can be checked against by whoever grades it. */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller: a standard normal from two uniforms. */
export function normalSampler(next: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do {
      u = 2 * next() - 1;
      v = 2 * next() - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
}

export interface MonteCarloResult {
  /** Fraction of trials in which the pavement survived its traffic, percent. */
  R: number;
  meanLogDr: number;
  sdLogDr: number;
  /** log D_r for every trial, for the histogram. */
  samples: number[];
  trials: number;
}

/**
 * Monte Carlo reliability: sample every input from its own distribution,
 * push each sample set through the *full nonlinear* design equation, and
 * count how often the pavement outlives its traffic.
 *
 * This is the estimator with the fewest assumptions — no linearisation, no
 * lognormal assumption on the damage ratio — so it is the reference the other
 * two are judged against.
 */
export function monteCarlo(
  traffic: TrafficInputs, perf: PerformanceInputs, trials = 5000, seed = 406
): MonteCarloResult | null {
  const t0 = trafficPrediction(traffic);
  const p0r = performancePrediction(perf);
  if (!t0 || !p0r) return null;

  const next = rng(seed);
  const z = normalSampler(next);
  const samples: number[] = [];
  let survived = 0;

  // Normal sampling truncated at ±4σ and floored above zero: a negative
  // thickness or modulus is not a tail, it is a broken sample.
  const draw = (mean: number, cv: number) => {
    const s = mean * cv;
    const v = mean + s * Math.max(-4, Math.min(4, z()));
    return Math.max(v, mean * 1e-3);
  };

  for (let k = 0; k < trials; k++) {
    const G = 0.5 * (1 + Math.pow(1 + draw(traffic.r, traffic.cvR), traffic.Y));
    const logWT =
      Math.log10(draw(traffic.sumPF, traffic.cvSumPF)) +
      Math.log10(draw(traffic.ADT0, traffic.cvADT)) +
      Math.log10(G) +
      Math.log10(draw(traffic.T, traffic.cvT)) +
      Math.log10(draw(traffic.A, traffic.cvA)) +
      Math.log10(draw(traffic.D, traffic.cvD)) +
      Math.log10(draw(traffic.L, traffic.cvL)) +
      Math.log10(traffic.Y) + Math.log10(365);

    const layers = perf.layers.map(l => ({
      ...l,
      a: draw(l.a, l.cvA),
      D: draw(l.D, l.cvD),
      m: draw(l.m, l.cvM),
    }));
    const SN = structuralNumber(layers);
    const p0s = draw(perf.p0, perf.cvP0);
    const MRs = draw(perf.MR, perf.cvMR);
    if (!(SN > 0) || p0s <= perf.pt) continue;

    const logWt = logWtOf(SN, MRs, p0s, perf.pt);
    const logDr = logWT - logWt;
    samples.push(logDr);
    if (logDr < 0) survived++;
  }

  if (!samples.length) return null;
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const varr = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / (samples.length - 1 || 1);

  return {
    R: (100 * survived) / samples.length,
    meanLogDr: mean,
    sdLogDr: Math.sqrt(varr),
    samples,
    trials: samples.length,
  };
}

/* ──────────────────── Design chart: reliability vs. SN ─────────────────── */

/**
 * Reliability as a function of the structural number, holding everything else
 * fixed. Scaling every layer thickness by the same factor keeps the section's
 * proportions and lets the curve be read as "what does one more inch buy?".
 */
export function reliabilityVsSN(
  traffic: TrafficInputs, perf: PerformanceInputs, scales: number[]
): { SN: number; R: number }[] {
  const t = trafficPrediction(traffic);
  if (!t) return [];
  const out: { SN: number; R: number }[] = [];
  for (const s of scales) {
    const scaled: PerformanceInputs = {
      ...perf,
      layers: perf.layers.map(l => ({ ...l, D: l.D * s })),
    };
    const p = performancePrediction(scaled);
    if (!p) continue;
    out.push({ SN: p.SN, R: reliability(t.logWT, t.varLogWT, p.logWt, p.varLogWt).R });
  }
  return out;
}
